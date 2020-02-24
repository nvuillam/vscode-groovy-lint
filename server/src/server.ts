import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    DidSaveTextDocumentNotification,
    DiagnosticRelatedInformation,
    NotificationType
} from 'vscode-languageserver';
import * as  path from 'path';
import { TextDocument, DocumentUri } from 'vscode-languageserver-textdocument';
const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");

interface StatusParams {
    state: string;
}
namespace StatusNotification {
    export const type = new NotificationType<StatusParams, void>('groovylint/status');
}
interface LintRequestParams {
    documentUri: DocumentUri;
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
let isNpmGroovyLintRunning = false;

connection.onInitialize((params: InitializeParams) => {
    console.debug('GLS: Initializing Groovy Lint Server');
    let capabilities = params.capabilities;
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
        }
    };
});

connection.onInitialized(() => {
    console.debug('GLS: Initialized Groovy Lint Server');
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type);
    connection.client.register(DidSaveTextDocumentNotification.type);

    connection.workspace.onDidChangeWorkspaceFolders(_event => {
        connection.console.log('Workspace folder change event received.');
    });

    // Trigger linting when requested by the client 
    connection.onNotification(LintRequestNotification.type, (params) => {
        const textDocument: TextDocument = documents.get(params.documentUri)!;
        validateTextDocument(textDocument);
    });

});

// The example settings
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

// Lint on open
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    let settings = await getDocumentSettings(textDocument.uri);
    if (settings.enable === false) {
        return;
    }

    // Build NmpGroovyLint config
    const decodedURIFile = decodeURIComponent(textDocument.uri).replace('file:///', '');
    const textDocFileDtl = path.parse(decodedURIFile);
    const npmGroovyLintConfig = {
        path: textDocFileDtl.dir,
        files: '**/' + textDocFileDtl.base,
        loglevel: settings.loglevel,
        output: 'none',
        verbose: settings.verbose
    };

    // Process NpmGroovyLint
    const linter = new NpmGroovyLint(npmGroovyLintConfig, {});
    connection.sendNotification(StatusNotification.type, { state: 'lint.start' });
    isNpmGroovyLintRunning = true;
    try {
        await linter.run();
        isNpmGroovyLintRunning = false;
    } catch (e) {
        console.error('VsCode Groovy Lint error: ' + e.message);
        connection.sendNotification(StatusNotification.type, { state: 'lint.error' });
        isNpmGroovyLintRunning = false;
        return;
    }
    connection.sendNotification(StatusNotification.type, { state: 'lint.end' });

    // Parse results into VsCode diagnostic
    const allText = textDocument.getText();
    const allTextLines = allText.split('\n');
    const lintResults = linter.lintResult;
    let diagnostics: Diagnostic[] = [];
    if (lintResults.files[decodedURIFile] && lintResults.files[decodedURIFile].errors) {
        // Get each error for the file
        for (const err of lintResults.files[decodedURIFile].errors) {
            let range = {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 }
            };
            // Build range
            // eslint-disable-next-line eqeqeq
            if (err.line && err.line != null && err.line > 0 && allTextLines[err.line - 1]) {
                const line = allTextLines[err.line - 1];
                const indent = line.search(/\S/);
                range = {
                    start: {
                        line: err.line - 1,
                        character: (indent >= 0) ? indent : 0 // Get first non empty character position
                    },
                    end: {
                        line: err.line - 1,
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
            diagnostics.push(diagnostic);

        }
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();