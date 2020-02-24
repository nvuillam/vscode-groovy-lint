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
}
namespace StatusNotification {
	export const type = new NotificationType<StatusParams, void>('groovylint/status');
}

interface LintRequestParams {
	documentUri: string
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

	const lintCommand = 'groovyLint.lint';
	context.subscriptions.push(vscode.commands.registerCommand(lintCommand, executeLintCommand));

	// Manage status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = lintCommand;
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


		// Manage status bar notifications
		client.onNotification(StatusNotification.type, (status) => {
			updateStatusBarItem(status);
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

// Catch Groovy lint command
function executeLintCommand(commandParams) {
	client.sendNotification(LintRequestNotification.type, { documentUri: vscode.window.activeTextEditor.document.uri.toString() });
};

// Update status bar item
function updateStatusBarItem(status: StatusParams): void {
	if (status.state === 'lint.start') {
		statusBarItem.text = `Linting...`;
		statusBarItem.show();
	} else if (status.state === 'lint.end') {
		statusBarItem.text = `Groovy linter`;
	} else {
		statusBarItem.text = `Groovy lint error`;
		statusBarItem.show();
	}
}