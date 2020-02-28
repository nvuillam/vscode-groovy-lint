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
    DiagnosticTag
} from 'vscode-languageserver';
import * as  path from 'path';
import { TextDocument, DocumentUri } from 'vscode-languageserver-textdocument';
const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");

// Status notifications schema
interface StatusParams {
    state: string;
    documents: [
        {
            documentUri: string,
            updatedSource?: string,
            quickFixes?: any[]
        }]
}
namespace StatusNotification {
    export const type = new NotificationType<StatusParams, void>('groovylint/status');
}

// Lint request notification schema
interface LintRequestParams {
    documentUri: DocumentUri;
    fix?: boolean,
    quickFixIds?: number[]
}
namespace LintRequestNotification {
    export const type = new NotificationType<LintRequestParams, void>('groovylint/lint');
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Manage to have only one codenarc running
connection.onInitialize((params: InitializeParams) => {
    console.debug('GroovyLint: initializing server');
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
        }
    };
});

// Actions when server is initialized
connection.onInitialized(() => {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type);
    connection.client.register(DidSaveTextDocumentNotification.type);

    // Trigger linting when requested by the client 
    connection.onNotification(LintRequestNotification.type, (params) => {
        const textDocument: TextDocument = documents.get(params.documentUri)!;
        validateTextDocument(textDocument, { fix: params.fix });
    });

    console.debug('GroovyLint: initialized server');

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

connection.onDidChangeConfiguration(change => {
    // Reset all cached document settings
    documentSettings.clear();
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

// Lint groovy doc on save
connection.onDidSaveTextDocument(async event => {
    const textDocument: TextDocument = documents.get(event.textDocument.uri)!;
    const settings = await getDocumentSettings(textDocument.uri);
    if (settings.run === 'onSave') {
        validateTextDocument(textDocument);
    }
});

// Lint groovy doc on open
documents.onDidOpen(async (event) => {
    const textDocument: TextDocument = documents.get(event.document.uri)!;
    validateTextDocument(textDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async change => {
    const settings = await getDocumentSettings(change.document.uri);
    if (settings.run === 'onType') {
        validateTextDocument(change.document);
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
    // In this simple example we get the settings for every validate run.
    let settings = await getDocumentSettings(textDocument.uri);
    if (settings.enable === false) {
        return;
    }

    // Reinitialize UI Diagnostic for this file
    let diagnostics: Diagnostic[] = [];
    const diagnosticWaiting: Diagnostic = {
        severity: DiagnosticSeverity.Information,
        code: '...',
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
        },
        message: (opts.fix) ? 'fixing...' : 'linting...',
        source: 'GroovyLint'
    };
    diagnostics.push(diagnosticWaiting);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    diagnostics = [];

    // Build NmpGroovyLint config
    const npmGroovyLintConfig = {
        source: textDocument.getText(),
        fix: (opts.fix) ? true : false,
        loglevel: settings.loglevel,
        output: 'none',
        verbose: settings.verbose
    };

    // Process NpmGroovyLint
    const linter = new NpmGroovyLint(npmGroovyLintConfig, {});
    connection.sendNotification(StatusNotification.type, {
        state: 'lint.start' + ((opts.fix === true) ? '.fix' : ''),
        documents: [{ documentUri: textDocument.uri }]
    });
    try {
        await linter.run();
    } catch (e) {
        console.error('VsCode Groovy Lint error: ' + e.message);
        connection.sendNotification(StatusNotification.type, {
            state: 'lint.error',
            documents: [{ documentUri: textDocument.uri }]
        });
        return;
    }

    // Parse results into VsCode diagnostic
    const diffLine = -1; // Difference between CodeNarc line number and VSCode line number
    const allText = textDocument.getText();
    const allTextLines = allText.split('\n');
    const lintResults = linter.lintResult;
    const docQuickFixes: any[] = [];
    if (lintResults.files[0] && lintResults.files[0].errors) {
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
            }
            const diagnostic: Diagnostic = {
                severity: (err.severity === 'error') ? DiagnosticSeverity.Error :
                    (err.severity === 'warning') ? DiagnosticSeverity.Warning :
                        DiagnosticSeverity.Information,
                code: err.rule,
                range: range,
                message: err.msg,
                source: 'GroovyLint'
            };
            if (err.fixable) {
                docQuickFixes.push({
                    label: 'Quick fix',
                    errId: err.id,
                    position: pos
                });
            }
            diagnostics.push(diagnostic);
            pos++;
        }
    }

    // Send updated sources to client 
    if (opts.fix === true && linter.status === 0) {
        linter.lintResult.files[0].updatedSources;
        connection.sendNotification(StatusNotification.type, {
            state: 'lint.end',
            documents: [{ documentUri: textDocument.uri, updatedSource: linter.lintResult.files[0].updatedSource }]
        });
    }
    else { // Just notify end of linting and send list of fixable errors
        connection.sendNotification(StatusNotification.type, {
            state: 'lint.end',
            documents: [{ documentUri: textDocument.uri, quickFixes: docQuickFixes }]
        });
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();