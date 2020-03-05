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
    MessageType,
    ShowMessageRequestParams,
    WorkspaceEdit,
    TextDocumentEdit,
    ExitNotification,
    ShutdownRequest,
    Range,
    DiagnosticRelatedInformation,
    DiagnosticTag
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
let docsDiagnostics: Map<String, Diagnostic[]> = new Map<String, Diagnostic[]>();
let docsDiagsQuickFixes: any = {};

// Create commands
const COMMAND_LINT = Command.create('GroovyLint: Lint', 'groovyLint.lint');
const COMMAND_LINT_FIX = Command.create('GroovyLint: Lint and fix all', 'groovyLint.lintFix');
const COMMAND_LINT_QUICKFIX = Command.create('GroovyLint: Lint and fix all', 'groovyLint.quickFix');
const COMMAND_SUPPRESS_WARNING_LINE = Command.create('GroovyLint: Ignore this error', 'groovyLint.addSuppressWarning');
const COMMAND_SUPPRESS_WARNING_FILE = Command.create('GroovyLint: Ignore this error type in all file', 'groovyLint.addSuppressWarningFile');
const commands = [
    COMMAND_LINT,
    COMMAND_LINT_FIX,
    COMMAND_LINT_QUICKFIX,
    COMMAND_SUPPRESS_WARNING_LINE,
    COMMAND_SUPPRESS_WARNING_FILE
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
                commands: commands.map(command => command.command),
                dynamicRegistration: true
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
    console.debug('GroovyLint: initialized server');
});

// Kill CodeNarcServer when closing VsCode or deactivate extension
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
connection.onDidChangeConfiguration(async (change) => {
    // Reset all cached document settings
    documentSettings.clear();
    // Revalidate all open text documents
    for (const doc of documents.all()) {
        await validateTextDocument(doc);
    };
});

// Handle command requests from client
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    const document: TextDocument = documents.get(currentTextDocumentUri)!;
    if (params.command === 'groovyLint.lint') {
        await validateTextDocument(document);
    }
    else if (params.command === 'groovyLint.lintFix') {
        await validateTextDocument(document, { fix: true });
    }
    /*    else if (params.command === 'groovyLint.quickFix') {
            addSuppressWarning(params, 'line');
        } */
    else if (params.command === 'groovyLint.addSuppressWarning') {
        await addSuppressWarning(params, 'line');
    }
    else if (params.command === 'groovyLint.addSuppressWarningFile') {
        await addSuppressWarning(params, 'file');
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
    await validateTextDocument(textDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async change => {
    currentTextDocumentUri = change.document.uri;
    const settings = await getDocumentSettings(change.document.uri);
    if (settings.run === 'onType') {
        await validateTextDocument(change.document);
    }
});

// Lint on save if it has been configured
documents.onDidSave(async event => {
    const textDocument: TextDocument = documents.get(event.document.uri)!;
    const settings = await getDocumentSettings(textDocument.uri);
    if (settings.run === 'onSave') {
        await validateTextDocument(textDocument);
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
        console.error('VsCode Groovy Lint error: ' + e.message + '\n' + e.stack);
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
            if (err.fixed === true) {
                continue; // Do not display diagnostics for fixed errors
            }
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
    docsDiagnostics.set(textDocument.uri, diagnostics);

    // Send updated sources to client 
    if (opts.fix === true && linter.status === 0) {
        await applyTextDocumentEditOnWorkspace(textDocument, linter.lintResult.files[0].updatedSource);
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

// Add suppress warning
async function addSuppressWarning(params: any, scope: string) {
    const [diagnostic, textDocumentUri] = params.arguments;
    const textDocument: TextDocument = documents.get(textDocumentUri)!;
    const allLines = getTextDocumentLines(textDocument);
    // Get line to check or create
    let linePos: number = 0;
    let removeAll = false;
    switch (scope) {
        case 'line': linePos = (diagnostic?.range?.start?.line) || 0; break;
        case 'file': linePos = 0; removeAll = true; break;
    }
    const line: string = allLines[linePos];
    const prevLine: string = allLines[(linePos === 0) ? 0 : linePos - 1] || '';
    const indent = " ".repeat(line.search(/\S/));
    const errorCode = diagnostic.code.split('-')[0];
    // Create updated @SuppressWarnings line
    if (prevLine.includes('@SuppressWarnings')) {
        const alreadyExistingWarnings = prevLine.trimLeft().replace('@SuppressWarnings', '')
            .replace('(', '').replace(')', '')
            .replace('[', '').replace(']', '')
            .replace(/'/g, '').split(',');
        alreadyExistingWarnings.push(errorCode);
        alreadyExistingWarnings.sort();
        const suppressWarningLine = indent + `@SuppressWarnings(['${[...new Set(alreadyExistingWarnings)].join("','")}'])`;
        await applyTextDocumentEditOnWorkspace(textDocument, suppressWarningLine, { replaceLinePos: (linePos === 0) ? 0 : linePos - 1 });
        removeDiagnostic(diagnostic, textDocument.uri, removeAll);
    }
    else {
        // Add new @SuppressWarnings line
        const suppressWarningLine = indent + `@SuppressWarnings(['${errorCode}'])`;
        await applyTextDocumentEditOnWorkspace(textDocument, suppressWarningLine, { insertLinePos: linePos });
        removeDiagnostic(diagnostic, textDocument.uri, removeAll, linePos);
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: docsDiagnostics.get(textDocument.uri)! });
}

// Remove diagnostic after it has been cleared
function removeDiagnostic(diagnostic: Diagnostic, textDocumentUri: string, removeAll?: boolean, recalculateRangeLinePos?: number) {
    let diagnostics: Diagnostic[] = docsDiagnostics.get(textDocumentUri) || [];
    const diagnosticCodeNarcCode = (diagnostic.code as string).split('-')[0];
    diagnostics = diagnostics?.filter(diag =>
        (removeAll) ?
            (diag.code as string).split('-')[0] !== diagnosticCodeNarcCode :
            diag.code !== diagnostic.code);
    // Recalculate diagnostic ranges if line number has changed
    if (recalculateRangeLinePos || recalculateRangeLinePos === 0) {
        diagnostics = diagnostics?.map(diag => {
            if (diag?.range?.start?.line >= recalculateRangeLinePos) {
                diag.range.start.line = diag.range.start.line + 1;
                diag.range.end.line = diag.range.end.line + 1;
            }
            return diag;
        });
    }
    docsDiagnostics.set(textDocumentUri, diagnostics);
}

// If necessary, fix source before sending it to CodeNarc
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
async function applyTextDocumentEditOnWorkspace(textDocument: TextDocument, updatedSource: string, where: any = {}) {
    textDocument = getUpToDateTextDocument(textDocument);
    const textDocEdit: TextDocumentEdit = createTextDocumentEdit(textDocument, updatedSource, where);
    const applyWorkspaceEdits: WorkspaceEdit = {
        documentChanges: [textDocEdit]
    };
    const applyEditResult = await connection.workspace.applyEdit(applyWorkspaceEdits);
    console.debug(`Updated ${textDocument.uri} using WorkspaceEdit (${JSON.stringify(applyEditResult)})`);
}

// Create a TextDocumentEdit that will be applied on client workspace
function createTextDocumentEdit(textDocument: TextDocument, updatedSource: string, where: any = {}): TextDocumentEdit {
    const allLines = getTextDocumentLines(textDocument);
    // If range is not sent, replace all file lines
    let textEdit: TextEdit;
    // Insert at position
    if (where.insertLinePos || where.insertLinePos === 0) {
        allLines.splice(where.insertLinePos, 0, updatedSource);
        textEdit = {
            range: {
                start: { line: 0, character: 0 },
                end: { line: allLines.length - 1, character: allLines[allLines.length - 1].length }
            },
            newText: allLines.join('\r\n')
        };
    }
    // Replace line at position
    else if (where.replaceLinePos || where.replaceLinePos === 0) {
        textEdit = {
            range: {
                start: { line: where.replaceLinePos, character: 0 },
                end: { line: where.replaceLinePos, character: allLines[where.replaceLinePos].length }
            },
            newText: updatedSource
        };
    }
    // Replace all source
    else if (!where?.range) {
        textEdit = {
            range: {
                start: { line: 0, character: 0 },
                end: { line: allLines.length - 1, character: allLines[allLines.length - 1].length }
            },
            newText: updatedSource
        };
    }
    // Provided range
    else {
        textEdit = {
            range: where.range,
            newText: updatedSource
        };
    }

    const textDocEdit: TextDocumentEdit = TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [textEdit]);

    return textDocEdit;
}

// If document has been updated during an operation, get its most recent state
function getUpToDateTextDocument(textDocument: TextDocument): TextDocument {
    return documents.get(textDocument.uri)!;
}

// Split source string into array of lines
function getTextDocumentLines(textDocument: TextDocument) {
    return textDocument.getText().replace(/\r?\n/g, "\r\n").split("\r\n");
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();