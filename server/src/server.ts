/* eslint-disable eqeqeq */
import {
    createConnection,
    Diagnostic,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    DidSaveTextDocumentNotification,
    CodeAction,
    CodeActionKind,
    CodeActionParams,
    ExecuteCommandParams
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
const { performance } = require("perf_hooks");
import { commands } from './linter';
import { provideQuickFixCodeActions } from './codeActions';

import { DocumentsManager } from './DocumentsManager';
const debug = require("debug")("vscode-groovy-lint");
const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Doc manager is a live instance managing the extension all along its execution
const docManager = new DocumentsManager(connection);

let lastChangeConfigEventReceived: number;
const delayBeforeLintAgainAfterConfigUpdate = 10000;

// Return language server capabilities
connection.onInitialize((params: InitializeParams) => {
    debug('GroovyLint: initializing server');
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

// Register workspace actions when server is initialized
connection.onInitialized(() => {
    // Register for the client notifications we can use
    connection.client.register(DidChangeConfigurationNotification.type);
    connection.client.register(DidSaveTextDocumentNotification.type);
    debug('GroovyLint: initialized server');
});

// Kill CodeNarcServer when closing VsCode or deactivate extension
connection.onShutdown(async () => {
    await new NpmGroovyLint({ killserver: true }, {}).run();
});
connection.onExit(async () => {
    await new NpmGroovyLint({ killserver: true }, {}).run();
});

// Lint again all opened documents in configuration changed 
// wait N seconds in case a new config change arrive, run just after the last one
connection.onDidChangeConfiguration(async (change) => {
    lastChangeConfigEventReceived = performance.now();
    setTimeout(async () => {
        if ((lastChangeConfigEventReceived - performance.now()) > delayBeforeLintAgainAfterConfigUpdate) {
            debug(`change configuration event received: lint again all open documents`);
            // Reset all cached document settings
            docManager.removeDocumentSettings('all');
            // Revalidate all open text documents
            for (const doc of docManager.documents.all()) {
                await docManager.validateTextDocument(doc);
            };
        }
    }, delayBeforeLintAgainAfterConfigUpdate);

});

// Handle command requests from client
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    await docManager.executeCommand(params);
});

// Manage to provide code actions (QuickFixes) when the user selects a part of the source code containing diagnostics
connection.onCodeAction(async (codeActionParams: CodeActionParams): Promise<CodeAction[]> => {
    if (!codeActionParams.context.diagnostics.length) {
        return [];
    }
    const document = docManager.getDocumentFromUri(codeActionParams.textDocument.uri);
    if (document == null) {
        return [];
    }
    const docQuickFixes: any = docManager.getDocQuickFixes(codeActionParams.textDocument.uri);
    if (docQuickFixes && Object.keys(docQuickFixes).length > 0) {
        return provideQuickFixCodeActions(document, codeActionParams, docQuickFixes);
    }
    return [];
});

// Lint groovy doc on open
docManager.documents.onDidOpen(async (event) => {
    debug(`file open event received for ${event.document.uri}`);
    const textDocument: TextDocument = docManager.getDocumentFromUri(event.document.uri, true);
    await docManager.validateTextDocument(textDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
docManager.documents.onDidChangeContent(async change => {
    docManager.setCurrentDocumentUri(change.document.uri);
    const settings = await docManager.getDocumentSettings(change.document.uri);
    if (settings.basic.run === 'onType') {
        await docManager.validateTextDocument(change.document);
    }
});

// Lint on save if it has been configured
docManager.documents.onDidSave(async event => {
    debug(`save event received for ${event.document.uri}`);
    const textDocument: TextDocument = docManager.getDocumentFromUri(event.document.uri, true);
    const settings = await docManager.getDocumentSettings(textDocument.uri);
    if (settings.basic.run === 'onSave') {
        await docManager.validateTextDocument(textDocument);
    }
});

// Only keep settings for open documents
docManager.documents.onDidClose(async event => {
    debug(`close event received for ${event.document.uri}`);
    await docManager.resetDiagnostics(event.document.uri);
    docManager.removeDocumentSettings(event.document.uri);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
docManager.documents.listen(connection);

// Listen on the connection
connection.listen();