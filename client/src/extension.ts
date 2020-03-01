import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	NotificationType,
	TextDocument
} from 'vscode-languageclient';

const DIAGNOSTICS_COLLECTION_NAME = 'GroovyLint';

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

/*
interface LintRequestParams {
	documentUri: string,
	fix?: boolean
}
namespace LintRequestNotification {
	export const type = new NotificationType<LintRequestParams, void>('groovylint/lint');
} */

export function activate(context: ExtensionContext) {

	///////////////////////////////////////////////
	/////////////// Server + client ///////////////
	///////////////////////////////////////////////

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { execArgv: ['--nolazy', '--inspect=6009'] }
		}
	};
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for groovy documents
		documentSelector: [{ scheme: 'file', language: 'groovy' }],
		diagnosticCollectionName: DIAGNOSTICS_COLLECTION_NAME,
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

	// Manage status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'groovyLint.lint';
	statusBarItem.text = 'GroovyLint $(zap)';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

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

// Update text editor & status bar
async function updateClient(status: StatusParams): Promise<any> {

	// Start linting: update status bar and freeze text editors while fixing (if fix requested)
	if (status.state === 'lint.start') {
		statusBarItem.text = 'GroovyLint $(sync~spin)';
	}
	else if (status.state === 'lint.start.fix') {
		statusBarItem.text = `GroovyLint $(sync~spin)`;
	}
	// End linting:  and 
	else if (status.state === 'lint.end') {
		// update status bar
		statusBarItem.text = 'GroovyLint $(zap)';

	}
	else {
		statusBarItem.text = 'GroovyLint $(error)';
	}
}

