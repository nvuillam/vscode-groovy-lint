/* eslint-disable eqeqeq */
import {
    createConnection,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    DidSaveTextDocumentNotification,
    CodeAction,
    CodeActionKind,
    CodeActionParams,
    ExecuteCommandParams,
    DocumentFormattingParams,
    TextDocumentChangeEvent
} from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
const { performance } = require('perf_hooks');

import { provideQuickFixCodeActions } from './codeActions';
import { DocumentsManager } from './DocumentsManager';
import { commands } from './commands';
import { ActiveDocumentNotification } from './types';
const debug = require("debug")("vscode-groovy-lint");
const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");

const onTypeDelayBeforeLint = 3000;

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Doc manager is a live instance managing the extension all along its execution
const docManager = new DocumentsManager(connection);

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
            documentFormattingProvider: true,
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
connection.onInitialized(async () => {
    // Register for the client notifications we can use
    connection.client.register(DidChangeConfigurationNotification.type);
    connection.client.register(DidSaveTextDocumentNotification.type);
    //connection.client.register(ActiveDocumentNotification.type);
    debug('GroovyLint: initialized server');
    await docManager.refreshDebugMode();
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
    debug(`change configuration event received: lint again all open documents`);
    await docManager.refreshDebugMode();
    // Reset all cached document settings
    docManager.removeDocumentSettings('all');
    // Revalidate all open text documents
    for (const doc of docManager.documents.all()) {
        await docManager.validateTextDocument(doc);
    };
});

// Handle command requests from client
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    await docManager.executeCommand(params);
});

// Handle formatting request from client
connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const { textDocument } = params;
    debug(`Formatting request received from client for ${textDocument.uri}`);
    const document = docManager.getDocumentFromUri(textDocument.uri);
    const textEdits: TextEdit[] = await docManager.formatTextDocument(document);
    // Lint again the sources
    setTimeout(async () => {
        const documentUpdated = docManager.getDocumentFromUri(textDocument.uri);
        await docManager.validateTextDocument(documentUpdated);
    }, 500);
    // Return textEdits to client that will apply them
    return textEdits;
});

// Manage to provide code actions (QuickFixes) when the user selects a part of the source code containing diagnostics
connection.onCodeAction(async (codeActionParams: CodeActionParams): Promise<CodeAction[]> => {
    if (!codeActionParams.context.diagnostics.length) {
        return [];
    }
    debug(`Code action request received from client for ${codeActionParams.textDocument.uri} with params: ${JSON.stringify(codeActionParams)}`);
    const document = docManager.getDocumentFromUri(codeActionParams.textDocument.uri);
    if (document == null) {
        return [];
    }
    const docQuickFixes: any = docManager.getDocQuickFixes(codeActionParams.textDocument.uri);
    return provideQuickFixCodeActions(document, codeActionParams, docQuickFixes);
});

// Notification from client that active window has changed
connection.onNotification(ActiveDocumentNotification.type, async (params) => {
    docManager.setCurrentDocumentUri(params.uri);
    await docManager.setCurrentWorkspaceFolder(params.uri);
});

// Lint groovy doc on open
docManager.documents.onDidOpen(async (event) => {
    debug(`File open event received for ${event.document.uri}`);
    const textDocument: TextDocument = docManager.getDocumentFromUri(event.document.uri, true);
    await docManager.setCurrentWorkspaceFolder(event.document.uri);
    await docManager.validateTextDocument(textDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let lastCall: string;
docManager.documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    if (change.document.languageId !== 'groovy') {
        return;
    }
    docManager.setCurrentDocumentUri(change.document.uri);
    docManager.deleteDocLinter(change.document.uri);
    const settings = await docManager.getDocumentSettings(change.document.uri);
    const skip = docManager.checkSkipNextOnDidChangeContent(change.document.uri);
    if (settings.lint.trigger === 'onType' && !skip) {
        // Wait 5 seconds to request linting (if new lint for same doc just arrived, just skip linting)
        lastCall = `${change.document.uri}-${performance.now()}`;
        const lastCallLocal = lastCall + '';
        setTimeout(async () => {
            if (lastCall === lastCallLocal) {
                await docManager.validateTextDocument(change.document);
            }
        }, onTypeDelayBeforeLint);
    }
});

// Lint on save if it has been configured
docManager.documents.onDidSave(async event => {
    debug(`Save event received for ${event.document.uri}`);
    const textDocument: TextDocument = docManager.getDocumentFromUri(event.document.uri, true);
    const settings = await docManager.getDocumentSettings(textDocument.uri);
    if (settings.fix.trigger === 'onSave') {
        await docManager.validateTextDocument(textDocument, { fix: true });
    }
    else if (settings.lint.trigger === 'onSave') {
        await docManager.validateTextDocument(textDocument);
    }
});

// Only keep settings for open documents
docManager.documents.onDidClose(async event => {
    debug(`Close event received for ${event.document.uri}`);
    docManager.resetDiagnostics(event.document.uri);
    docManager.removeDocumentSettings(event.document.uri);
    docManager.cancelDocumentValidation(event.document.uri);
});



// Make the text document manager listen on the connection
// for open, change and close text document events
docManager.documents.listen(connection);

// Listen on the connection
connection.listen();
