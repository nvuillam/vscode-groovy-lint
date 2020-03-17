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

const DIAGNOSTICS_COLLECTION_NAME = 'GroovyLint';

let client: LanguageClient;
let statusBarItem: vscode.StatusBarItem;

interface StatusParams {
	state: string;
	documents: [
		{
			documentUri: string,
			updatedSource?: string
		}];
	lastFileName?: string
	lastLintTimeMs?: number
}
namespace StatusNotification {
	export const type = new NotificationType<StatusParams, void>('groovylint/status');
}

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
			options: {
				execArgv: ['--nolazy', '--inspect=6009'],
				env: { "DEBUG": "vscode-groovy-lint,npm-groovy-lint" }
			}
		}
	};
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for groovy documents
		documentSelector: [{ scheme: 'file', language: 'groovy' }],
		diagnosticCollectionName: DIAGNOSTICS_COLLECTION_NAME,
		progressOnInitialization: true,
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
	statusBarItem.text = 'Starting GroovyLint $(clock~spin)';
	statusBarItem.show();

	client.registerProposedFeatures();

	context.subscriptions.push(
		client.start(),
	);

	// Actions after client is ready
	client.onReady().then(() => {

		// Show status bar item to display & run groovy lint
		statusBarItem.command = 'groovyLint.lint';
		statusBarItem.text = 'GroovyLint $(zap)';

		context.subscriptions.push(statusBarItem);

		// Manage status notifications
		client.onNotification(StatusNotification.type, (status) => {
			updateClient(status);
		});

		// Open file in workspace when language server requests it
		client.onNotification("vscode-groovy-lint/openDocument", async (notifParams: any) => {
			const openPath = vscode.Uri.parse("file:///" + notifParams.file); //A request file path
			const doc = await vscode.workspace.openTextDocument(openPath);
			await vscode.window.showTextDocument(doc);
		});

	});
}

// Stop client when extension is deactivated
export function deactivate(): Thenable<void> {
	// Remove status bar
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
		statusBarItem.tooltip = 'GroovyLint is analyzing ' + status.lastFileName;
		statusBarItem.color = new vscode.ThemeColor('statusBar.debuggingForeground');
	}
	else if (status.state === 'lint.start.fix') {
		statusBarItem.text = `GroovyLint $(circuit-board~spin)`;
		statusBarItem.tooltip = 'GroovyLint is fixing ' + status.lastFileName;
		statusBarItem.color = new vscode.ThemeColor('statusBar.debuggingForeground');
	}
	// End linting:  and 
	else if (status.state === 'lint.end') {
		// update status bar
		statusBarItem.text = 'GroovyLint $(zap)';
		statusBarItem.tooltip = 'Groovylint analyzed ' + status.lastFileName + ' in ' + Math.floor(status.lastLintTimeMs) + 'ms';
		statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
	}
	else {
		statusBarItem.text = 'GroovyLint $(error)';
		statusBarItem.tooltip = 'There has been an error during linting ' + status.lastFileName;
		statusBarItem.color = new vscode.ThemeColor('errorForeground');
	}
}
