import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	NotificationType
} from 'vscode-languageclient';

let client: LanguageClient;
let statusBarItem: vscode.StatusBarItem;

interface StatusParams {
	state: string;
	documents: [
		{
			documentUri: string,
			updatedSource?: string
		}]
}
namespace StatusNotification {
	export const type = new NotificationType<StatusParams, void>('groovylint/status');
}

interface LintRequestParams {
	documentUri: string,
	fix?: boolean
}
namespace LintRequestNotification {
	export const type = new NotificationType<LintRequestParams, void>('groovylint/lint');
}

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// Register commands
	const lintCommand = 'groovyLint.lint';
	context.subscriptions.push(vscode.commands.registerCommand(lintCommand, executeLintCommand));
	const lintFixCommand = 'groovyLint.lintFix';
	context.subscriptions.push(vscode.commands.registerCommand(lintFixCommand, executeLintFixCommand));

	// Manage status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = lintCommand;
	statusBarItem.text = 'GroovyLint $(zap)';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'groovy' }],
		diagnosticCollectionName: 'GroovyLint',
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'groovyLint',
		'Groovy Lint',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	// Actions after client is ready
	client.onReady().then(() => {

		// Manage status notifications
		client.onNotification(StatusNotification.type, (status) => {
			updateClient(status);
		});
	});
}

// Stop client when extension is deactivated
export function deactivate(): Thenable<void> {
	if (statusBarItem) {
		statusBarItem.dispose();
	}
	return client.stop();
}

// Request lint & fix to server 
function executeLintCommand(_commandParams) {
	client.sendNotification(LintRequestNotification.type, { documentUri: vscode.window.activeTextEditor.document.uri.toString() });
};
// Request lint & fix to server
function executeLintFixCommand(_commandParams) {
	client.sendNotification(LintRequestNotification.type, { documentUri: vscode.window.activeTextEditor.document.uri.toString(), fix: true });
};

// Update text editor & status bar
async function updateClient(status: StatusParams): Promise<any> {

	// Start linting: update status bar and freeze text editors while fixing (if fix requested)
	if (status.state === 'lint.start') {
		statusBarItem.text = 'GroovyLint $(sync~spin)';
	}
	else if (status.state === 'lint.start.fix') {
		statusBarItem.text = `GroovyLint $(sync~spin)`;
	}
	// End linting: update status bar and update textEditors if fixes has been performed
	else if (status.state === 'lint.end') {
		statusBarItem.text = 'GroovyLint $(zap)';
		for (const doc of status.documents) {
			if (doc.updatedSource) {
				const textEditor = getDocumentTextEditor(doc.documentUri);
				await textEditor.edit((texteditorEdit: vscode.TextEditorEdit) => {
					const firstLine = textEditor.document.lineAt(0);
					const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
					const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
					texteditorEdit.replace(textRange, doc.updatedSource);
				});
			}
		}
	}
	else {
		statusBarItem.text = 'GroovyLint $(error)';
	}
}

function getDocumentTextEditor(documentUri: string) {
	const textEditors = vscode.window.visibleTextEditors.filter(textEditor => textEditor.document && textEditor.document.uri.toString() === documentUri);
	if (textEditors.length > 0) {
		return textEditors[0];
	}
	return null;
}