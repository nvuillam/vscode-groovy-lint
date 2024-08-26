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
} from 'vscode-languageserver/node';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { performance } from 'perf_hooks';
import { provideQuickFixCodeActions } from './codeActions';
import { DocumentsManager } from './DocumentsManager';
import { commands } from './commands';
import { ActiveDocumentNotification } from './types';
import * as NpmGroovyLint from 'npm-groovy-lint';
import Debug from "debug";

const debug = Debug('vscode-groovy-lint');
const trace = Debug("vscode-groovy-lint-trace");

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
    await docManager.refreshDebugMode(true);
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
    debug(`change configuration event received: restart server and lint again all open documents ${JSON.stringify(change, null, 2)}`);
    await docManager.cancelAllDocumentValidations();
    await new NpmGroovyLint({ killserver: true }, {}).run();
    await docManager.lintAgainAllOpenDocuments();
});

// Handle command requests from client
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    await docManager.executeCommand(params);
});

// Handle formatting request from client
connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const { textDocument } = params;
    debug(`Formatting request received from client for ${textDocument.uri} with params ${JSON.stringify(params)}`);
    if (params && params.options.tabSize) {
        await docManager.updateDocumentSettings(textDocument.uri, { tabSize: params.options.tabSize });
    }
    const document = docManager.getDocumentFromUri(textDocument.uri);
    return await docManager.formatTextDocument(document);
});

// Manage to provide code actions (QuickFixes) when the user selects a part of the source code containing diagnostics
connection.onCodeAction(async (codeActionParams: CodeActionParams): Promise<CodeAction[]> => {
    if (!codeActionParams.context.diagnostics.length) {
        return [];
    }
    debug(`Code action request received from client for ${codeActionParams.textDocument.uri}`);
    trace(`codeActionParams: ${JSON.stringify(codeActionParams, null, 2)}`);
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
    if (settings.lint.next) {
        // Previous requested lint.
        docManager.updateDocumentSettings(change.document.uri, {lint: {next: false}});
        await docManager.validateTextDocument(change.document);
        return;
    }

    if (settings.lint.trigger === 'onType') {
        // Wait to request linting.
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
    debug(`Save event received for: ${event.document.uri}`);
    const textDocument: TextDocument = docManager.getDocumentFromUri(event.document.uri, true);
    const settings = await docManager.getDocumentSettings(textDocument.uri);
    if (settings.fix.trigger === 'onSave') {
        debug(`Save trigger fix for: ${textDocument.uri}`);
        await docManager.validateTextDocument(textDocument, { fix: true });
    }
    else if (settings.lint.trigger === 'onSave') {
        debug(`Save trigger lint for: ${textDocument.uri}`);
        await docManager.validateTextDocument(textDocument);
    } else {
        debug(`Save no action for: ${textDocument.uri}`);
    }
});

// Only keep settings for open documents
docManager.documents.onDidClose(async event => {
    await docManager.deleteDiagnostics(event.document.uri);
    docManager.removeDocumentSettings(event.document.uri);
    await docManager.cancelDocumentValidation(event.document.uri);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
docManager.documents.listen(connection);

// Listen on the connection
connection.listen();
