/* eslint-disable eqeqeq */
import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    DidSaveTextDocumentNotification,
    NotificationType,
    CodeAction,
    CodeActionKind,
    Command,
    CodeActionParams,
    ExecuteCommandParams,
    ShowMessageRequest,
    MessageType,
    ShowMessageRequestParams,
    ApplyWorkspaceEditParams,
    WorkspaceEdit,
    TextDocumentEdit,
    ExitNotification,
    ShutdownRequest
} from 'vscode-languageserver';
import * as path from 'path';
import { provideQuickFixCodeActions } from './CodeActionProvider';
import { TextDocument, DocumentUri, TextEdit } from 'vscode-languageserver-textdocument';
const { performance } = require('perf_hooks');
const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");

// Status notifications schema
interface StatusParams {
    state: string;
    documents: [
        {
            documentUri: string,
            updatedSource?: string
        }],
    lastFileName?: string
    lastLintTimeMs?: number
}
namespace StatusNotification {
    export const type = new NotificationType<StatusParams, void>('groovylint/status');
}

// Globals
const indentLength = 4; // TODO: Nice to set as config later... when we'll be able to generate RuleSets from vsCode config

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let currentTextDocumentUri: DocumentUri;

let autoFixTabs = false;
let docsDiagsQuickFixes: any = {};

// Create commands
const COMMAND_LINT = Command.create('GroovyLint: Lint', 'groovyLint.lint');
const COMMAND_LINT_FIX = Command.create('GroovyLint: Lint and fix all', 'groovyLint.lintFix');
const commands = [
    COMMAND_LINT,
    COMMAND_LINT_FIX
];

// Manage to have only one codenarc running
connection.onInitialize((params: InitializeParams) => {
    console.debug('GroovyLint: initializing server');
    return {
        capabilities: {
            textDocumentSync: {
                change: TextDocumentSyncKind.Incremental,
                openClose: true,
                willSaveWaitUntil: true
            },
            executeCommandProvider: {
                commands: commands.map(command => command.command)
            },
            codeActionProvider: {
                codeActionKinds: [CodeActionKind.QuickFix]
            }
        }
    };
});

// Actions when server is initialized
connection.onInitialized(() => {
    // Register for the client notifications we can use
    connection.client.register(DidChangeConfigurationNotification.type);
    connection.client.register(DidSaveTextDocumentNotification.type);
    connection.client.register(ExitNotification.type);
    connection.client.register(ShutdownRequest.type);
    console.debug('GroovyLint: initialized server');
});

// Kill server when closing VsCode or deactivate extension
connection.onShutdown(async () => {
    await new NpmGroovyLint({ killserver: true }, {}).run();
});
connection.onExit(async () => {
    await new NpmGroovyLint({ killserver: true }, {}).run();
});

// Usable settings
interface VsCodeGroovyLintSettings {
    enable: boolean;
    loglevel: string;
    run: string;
    verbose?: boolean
}

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<VsCodeGroovyLintSettings>> = new Map();

// Lint again all opened documents in configuration changed
connection.onDidChangeConfiguration(change => {
    // Reset all cached document settings
    documentSettings.clear();
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

// Handle command requests from client
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    const document: TextDocument = documents.get(currentTextDocumentUri)!;
    if (params.command === 'groovyLint.lint') {
        validateTextDocument(document);
    }
    else if (params.command === 'groovyLint.lintFix') {
        validateTextDocument(document, { fix: true });
    }
});

// Manage to provide code actions (QuickFixes) when the user selects a part of the source code containing diagnostics
connection.onCodeAction(async (codeActionParams: CodeActionParams): Promise<CodeAction[]> => {
    if (!codeActionParams.context.diagnostics.length) {
        return [];
    }
    const document = documents.get(codeActionParams.textDocument.uri);
    if (document == null) {
        return [];
    }
    const docQuickFixes = docsDiagsQuickFixes[codeActionParams.textDocument.uri];
    if (docQuickFixes == null) {
        return [];
    }
    return provideQuickFixCodeActions(document, codeActionParams, docQuickFixes);
});

// Lint groovy doc on open
documents.onDidOpen(async (event) => {
    const textDocument: TextDocument = documents.get(event.document.uri)!;
    currentTextDocumentUri = textDocument.uri;
    validateTextDocument(textDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async change => {
    currentTextDocumentUri = change.document.uri;
    const settings = await getDocumentSettings(change.document.uri);
    if (settings.run === 'onType') {
        validateTextDocument(change.document);
    }
});

// Lint on save if it has been configured
documents.onDidSave(async event => {
    const textDocument: TextDocument = documents.get(event.document.uri)!;
    const settings = await getDocumentSettings(textDocument.uri);
    if (settings.run === 'onSave') {
        validateTextDocument(textDocument);
    }
});

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// Get document settings from workspace configuration or cache
function getDocumentSettings(resource: string): Thenable<VsCodeGroovyLintSettings> {
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'groovyLint'
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Validate a groovy file
async function validateTextDocument(textDocument: TextDocument, opts: any = { fix: false }): Promise<void> {
    const perfStart = performance.now();

    // In this simple example we get the settings for every validate run.
    let settings = await getDocumentSettings(textDocument.uri);
    if (settings.enable === false) {
        return;
    }

    // Propose to replace tabs by spaces if there are, because CodeNarc hates tabs :/
    let source: string = textDocument.getText();
    let fileNm = path.basename(textDocument.uri);
    source = await managePreFixSource(source, textDocument);

    // Initialize diagnostics for this file
    let diagnostics: Diagnostic[] = [];

    // Build NmpGroovyLint config
    const npmGroovyLintConfig = {
        source: source,
        fix: (opts.fix) ? true : false,
        loglevel: settings.loglevel,
        output: 'none',
        verbose: settings.verbose
    };

    // Process NpmGroovyLint
    const linter = new NpmGroovyLint(npmGroovyLintConfig, {});
    connection.sendNotification(StatusNotification.type, {
        state: 'lint.start' + ((opts.fix === true) ? '.fix' : ''),
        documents: [{ documentUri: textDocument.uri }],
        lastFileName: fileNm
    });

    try {
        await linter.run();
    } catch (e) {
        console.error('VsCode Groovy Lint error: ' + e.message);
        connection.sendNotification(StatusNotification.type, {
            state: 'lint.error',
            documents: [{ documentUri: textDocument.uri }],
            lastFileName: fileNm
        });
        return;
    }

    // Parse results into VsCode diagnostic
    textDocument = getUpToDateTextDocument(textDocument);
    const diffLine = -1; // Difference between CodeNarc line number and VSCode line number
    const allText = source;
    const allTextLines = allText.split('\n');
    const lintResults = linter.lintResult || {};
    const docQuickFixes: any = {};
    if (lintResults.files && lintResults.files[0] && lintResults.files[0].errors) {
        // Get each error for the file
        let pos = 0;
        for (const err of lintResults.files[0].errors) {
            let range = err.range;
            if (range) {
                range.start.line += diffLine;
                range.end.line += diffLine;
                // Avoid issue from linter if it returns wrong range
                range.start.line = (range.start.line >= 0) ? range.start.line : 0;
                range.start.character = (range.start.character >= 0) ? range.start.character : 0;
                range.end.line = (range.end.line >= 0) ? range.end.line : 0;
                range.end.character = (range.end.character >= 0) ? range.end.character : 0;
            }
            // Build default range (whole line) if not returned by npm-groovy-lint
            // eslint-disable-next-line eqeqeq
            else if (err.line && err.line != null && err.line > 0 && allTextLines[err.line + diffLine]) {
                const line = allTextLines[err.line + diffLine];
                const indent = line.search(/\S/);
                range = {
                    start: {
                        line: err.line + diffLine,
                        character: (indent >= 0) ? indent : 0 // Get first non empty character position
                    },
                    end: {
                        line: err.line + diffLine,
                        character: line.length || 0
                    }
                };
            } else {
                // Default range (should not really happen)
                range = {
                    start: {
                        line: 0,
                        character: 0 // Get first non empty character position
                    },
                    end: {
                        line: 0,
                        character: 0
                    }
                };
            }
            // Create vscode Diagnostic
            const diagCode: string = err.rule + '-' + err.id;
            const diagnostic: Diagnostic = {
                severity: (err.severity === 'error') ? DiagnosticSeverity.Error :
                    (err.severity === 'warning') ? DiagnosticSeverity.Warning :
                        DiagnosticSeverity.Information,
                code: diagCode,
                range: range,
                message: err.msg,
                source: 'GroovyLint'
            };
            // Add quick fix if error is fixable. This will be reused in CodeActionProvider
            if (err.fixable) {
                docQuickFixes[diagCode] = [];
                docQuickFixes[diagCode].push({
                    label: err.fixLabel || `Fix ${err.rule}`,
                    errId: err.id
                });
            }
            diagnostics.push(diagnostic);
            pos++;
        }
        docsDiagsQuickFixes[textDocument.uri] = docQuickFixes;
    }

    // Send diagnostics to client
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

    // Send updated sources to client 
    if (opts.fix === true && linter.status === 0) {
        applyTextDocumentEditOnWorkspace(textDocument, linter.lintResult.files[0].updatedSource);
    }
    // Just Notify client of end of linting 
    connection.sendNotification(StatusNotification.type, {
        state: 'lint.end',
        documents: [{
            documentUri: textDocument.uri
        }],
        lastFileName: fileNm,
        lastLintTimeMs: performance.now() - perfStart
    });
}

async function managePreFixSource(source: string, textDocument: TextDocument): Promise<string> {
    if (source.includes("\t")) {
        let fixTabs = false;
        if (autoFixTabs === false) {
            const msg: ShowMessageRequestParams = {
                type: MessageType.Info,
                message: "CodeNarc linter doesn't like tabs, let's replace them by spaces ?",
                actions: [
                    { title: "Always (recommended)" },
                    { title: "Yes" },
                    { title: "No" },
                    { title: "Never" }]
            };
            let req: any = await connection.sendRequest('window/showMessageRequest', msg);
            if (req.title === "Always (recommended)") {
                autoFixTabs = true;
            } else if (req.title === "Yes") {
                fixTabs = true;
            }
        }
        if (autoFixTabs || fixTabs) {
            const replaceChars = " ".repeat(indentLength);
            source = source.replace(/\t/g, replaceChars);
            await applyTextDocumentEditOnWorkspace(textDocument, source);
        }
    }
    return source;
}

// Apply updated source into the client TextDocument
async function applyTextDocumentEditOnWorkspace(textDocument: TextDocument, updatedSource: string) {
    textDocument = getUpToDateTextDocument(textDocument);
    const textDocEdit: TextDocumentEdit = createTextDocumentEdit(textDocument, updatedSource);
    const applyWorkspaceEdits: WorkspaceEdit = {
        documentChanges: [textDocEdit]
    };
    const applyEditResult = await connection.workspace.applyEdit(applyWorkspaceEdits);
    console.debug(`Updated ${textDocument.uri} using WorkspaceEdit (${JSON.stringify(applyEditResult)})`);
}

// Create a TextDocumentEdit that will be applied on client workspace
function createTextDocumentEdit(textDocument: TextDocument, updatedSource: string): TextDocumentEdit {
    const allLines = textDocument.getText().replace(/\r?\n/g, "\r\n").split("\r\n");
    const range = {
        start: { line: 0, character: 0 },
        end: { line: allLines.length - 1, character: allLines[allLines.length - 1].length }
    };
    const textEdit: TextEdit = {
        range: range,
        newText: updatedSource
    };

    const textDocEdit: TextDocumentEdit = TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [textEdit]);

    return textDocEdit;
}

// If document has been updated during an operation, get its most recent state
function getUpToDateTextDocument(textDocument: TextDocument): TextDocument {
    return documents.get(textDocument.uri)!;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();