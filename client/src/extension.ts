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
let quickFixes: {};

const DIAGNOSTICS_COLLECTION_NAME = 'GroovyLint';

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

interface LintRequestParams {
	documentUri: string,
	fix?: boolean,
	quickFixIds?: number[]
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
	const quickFixCommand = 'groovyLint.quickFix';
	context.subscriptions.push(vscode.commands.registerCommand(quickFixCommand, executeQuickFixCommand));

	// Register CodeAction providers
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('groovy', new GroovyLintCodeActionProvider(), {
			providedCodeActionKinds: GroovyLintCodeActionProvider.providedCodeActionKinds
		}));

	// Create diagnostics collection
	const groovyLintDiagnostics = vscode.languages.createDiagnosticCollection(DIAGNOSTICS_COLLECTION_NAME);
	context.subscriptions.push(groovyLintDiagnostics);

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
	client.sendNotification(LintRequestNotification.type, {
		documentUri: vscode.window.activeTextEditor.document.uri.toString()
	});
};
// Request lint & fix to server
function executeLintFixCommand(_commandParams) {
	client.sendNotification(LintRequestNotification.type, {
		documentUri: vscode.window.activeTextEditor.document.uri.toString(),
		fix: true
	});
};
// Request lint & fix to server
function executeQuickFixCommand(commandParams: any) {
	client.sendNotification(LintRequestNotification.type, {
		documentUri: vscode.window.activeTextEditor.document.uri.toString(),
		quickFixIds: [commandParams.errId]
	});
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
	// End linting:  and 
	else if (status.state === 'lint.end') {
		// update status bar
		statusBarItem.text = 'GroovyLint $(zap)';

		// Update document fixable errors list
		for (const doc of status.documents) {
			quickFixes[doc.documentUri] = doc.quickFixes;
		}

		// update textEditors if fixes has been performed
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

/**
 * Provides code actions corresponding to diagnostic problems.
 */
export class GroovyLintCodeActionProvider implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		// for each diagnostic entry that has the matching `code`, create a code action command
		let pos = 0;
		return context.diagnostics
			.filter(diagnostic => {
				pos++;
			})
			.map(diagnostic => this.createCommandCodeAction(diagnostic));
	}

	private createCommandCodeAction(diagnostic: vscode.Diagnostic): vscode.CodeAction {
		const action = new vscode.CodeAction('Learn more...', vscode.CodeActionKind.QuickFix);
		action.command = { command: 'groovyLint.quickFix', title: 'Quick fix', tooltip: 'This will fix the error found by GroovyLint.' };
		action.diagnostics = [diagnostic];
		action.isPreferred = true;
		return action;
	}
}