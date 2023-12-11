import { TextDocuments, Diagnostic, WorkspaceFolder } from 'vscode-languageserver';
import { TextDocument, DocumentUri, TextEdit } from 'vscode-languageserver-textdocument';
import { executeLinter } from './linter';
import { applyQuickFixes, applyQuickFixesInFile, disableErrorWithComment, disableErrorForProject } from './codeActions';
import { isTest, showRuleDocumentation } from './clientUtils';
import { URI } from 'vscode-uri';
import { EOL } from 'os';
import { resolve } from 'path';
import { StatusNotification, VsCodeGroovyLintSettings } from './types';
import { lintFolder } from './folder';
import {
	COMMAND_LINT,
	COMMAND_LINT_FIX,
	COMMAND_LINT_QUICKFIX,
	COMMAND_LINT_QUICKFIX_FILE,
	COMMAND_DISABLE_ERROR_FOR_LINE,
	COMMAND_DISABLE_ERROR_FOR_FILE,
	COMMAND_DISABLE_ERROR_FOR_PROJECT,
	COMMAND_SHOW_RULE_DOCUMENTATION,
	COMMAND_LINT_FOLDER
} from './commands';
const debug = require("debug")("vscode-groovy-lint");

// Documents manager
export class DocumentsManager {

	// list of documents managed by the client
	documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	// connection to client
	connection: any;

	autoFixTabs = false;
	neverFixTabs = false;
	ignoreNotifyCrashes = false;
	ignoreNotifyFixError = false;

	// Counter for job id
	private currentTaskId: number = 0;

	// Cache the settings of all open documents
	private documentSettings: Map<string, Thenable<VsCodeGroovyLintSettings>> = new Map();
	private currentTextDocumentUri: DocumentUri = '';
	private currentWorkspaceFolder: string = process.cwd();

	// Memory stored values
	private docLinters: Map<String, any> = new Map<String, any>();
	private docsDiagnostics: Map<string, Diagnostic[]> = new Map<string, Diagnostic[]>();
	private docsDiagsQuickFixes: Map<String, any[]> = new Map<String, any[]>();
	private ruleDescriptions: Map<String, any[]> = new Map<String, any[]>();

	// Lint/fix queue
	private currentlyLinted: any[] = [];
	private queuedLints: any[] = [];

	// Initialize documentManager
	constructor(cnx: any) {
		this.connection = cnx;
		if (isTest()) {
			this.autoFixTabs = true;
		}
	}

	// Commands execution
	async executeCommand(params: any) {
		debug(`Request execute command ${JSON.stringify(params, null, 2)}`);
		// Set current document URI if sent as parameter
		if (params.arguments && params.arguments[0] && URI.isUri(params.arguments[0])) {
			this.setCurrentDocumentUri(params.arguments[0].toString());
		}

		// Command: Lint
		if (params.command === COMMAND_LINT.command) {
			const document: TextDocument = this.getDocumentFromUri(this.currentTextDocumentUri)!;
			await this.validateTextDocument(document, { force: true });
		}
		// Command: Fix
		else if (params.command === COMMAND_LINT_FIX.command) {
			let document: TextDocument = this.getDocumentFromUri(this.currentTextDocumentUri)!;
			await this.validateTextDocument(document, { fix: true });

			// The content of textDocument.getText() may be out of date, so request
			// a lint when we get the new document content via onDidChangeContent.
			this.updateDocumentSettings(document.uri, {lint: {next: true}});
		}
		// Command: Apply quick fix
		else if (params.command === COMMAND_LINT_QUICKFIX.command) {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await applyQuickFixes([diagnostic], textDocumentUri, this);
		}
		// Command: Apply quick fix in all file
		else if (params.command === COMMAND_LINT_QUICKFIX_FILE.command) {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await applyQuickFixesInFile([diagnostic], textDocumentUri, this);
		}
		// Ignore error
		else if (params.command === COMMAND_DISABLE_ERROR_FOR_LINE.command) {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await disableErrorWithComment(diagnostic, textDocumentUri, 'line', this);
		}
		// Ignore error in entire file
		else if (params.command === COMMAND_DISABLE_ERROR_FOR_FILE.command) {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await disableErrorWithComment(diagnostic, textDocumentUri, 'file', this);
		}
		// Command: Update .groovylintrc.json to ignore error in the future
		else if (params.command === COMMAND_DISABLE_ERROR_FOR_PROJECT.command) {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await disableErrorForProject(diagnostic, textDocumentUri, this);
		}
		// Show rule documentation
		else if (params.command === COMMAND_SHOW_RULE_DOCUMENTATION.command) {
			const [ruleCode] = params.arguments!;
			await showRuleDocumentation(ruleCode, this);
		}
		// Command: Lint folder
		else if (params.command === COMMAND_LINT_FOLDER.command) {
			// First argument is the folder that has been right-clicked
			// Second argument is the list of folders to selected.
			const folders: Array<any> = params.arguments[1];
			await lintFolder(folders, this);
		}
	}

	// Return TextDocument from uri
	getDocumentFromUri(docUri: string, setCurrent = false, throwError = true): TextDocument {
		const textDocument = this.documents.get(docUri)!;
		// eslint-disable-next-line eqeqeq
		if (textDocument == null && throwError == true) {
			throw new Error(`ERROR: Document not found for URI ${docUri}`);
		}
		// eslint-disable-next-line eqeqeq
		if (textDocument != null && setCurrent) {
			this.setCurrentDocumentUri(docUri);
		}
		return textDocument;
	}
	// Store URI of currently edited document
	setCurrentDocumentUri(uri: string) {
		this.currentTextDocumentUri = uri;
	}

	// Check if document is opened in client
	isDocumentOpenInClient(docUri: string): boolean {
		if (this.documents.get(docUri)) {
			return true;
		}
		return false;
	}

	// Get document settings from workspace configuration or cache
	getDocumentSettings(resource: string): Thenable<VsCodeGroovyLintSettings> {
		let result = this.documentSettings.get(resource);
		if (!result) {
			result = this.connection.workspace.getConfiguration({
				scopeUri: resource,
				section: 'groovyLint'
			});
			this.documentSettings.set(resource, result!);
		}
		return result!;
	}

	async updateDocumentSettings(resource: string, settingUpdate: VsCodeGroovyLintSettings) {
		let docSettings = await this.getDocumentSettings(resource);
		docSettings = Object.assign(docSettings, settingUpdate);
		this.documentSettings.set(resource, docSettings as unknown as any);
		return docSettings;
	}

	// Remove document settings when closed
	removeDocumentSettings(uri: string) {
		if (uri === 'all') {
			this.documentSettings.clear();
		}
		else {
			this.documentSettings.delete(uri);
		}
	}

	// Lint again all open documents (after change of config)
	async lintAgainAllOpenDocuments() {
		await this.refreshDebugMode(false);
		// Reset all cached document settings
		this.removeDocumentSettings('all');
		// Revalidate all open text documents
		for (const doc of this.documents.all()) {
			await this.validateTextDocument(doc, { force: true });
		};
	}

	// Format a text document
	async formatTextDocument(textDocument: TextDocument): Promise<TextEdit[]> {
		return await this.validateTextDocument(textDocument, { format: true });
	}

	// Validate a text document by calling linter
	async validateTextDocument(textDocument: TextDocument, opts: any = {
		displayErrorsEvenIfDocumentClosed: false
	}): Promise<TextEdit[]> {
		// Do not validate document if it is not open
		if (opts.displayErrorsEvenIfDocumentClosed !== true && !this.isDocumentOpenInClient(textDocument.uri)) {
			return Promise.resolve([]);
		}
		// Find if document is already being formatted or fixed
		const currentLintsOnDoc = this.currentlyLinted.filter((currLinted) =>
			currLinted.uri === textDocument.uri
		);
		const duplicateLintsOnDoc = currentLintsOnDoc.filter((currLinted) =>
			!this.isUpdateRequest(currLinted.options) &&
			currLinted.source === textDocument.getText()
		);
		const currentActionsOnDoc = currentLintsOnDoc.filter((currLinted) =>
			this.isUpdateRequest(currLinted.options)
		);

		// Duplicate lint request with same doc content: do not trigger a new lint as there is a current one
		if (duplicateLintsOnDoc.length > 0 && !this.isUpdateRequest(opts)) {
			return Promise.resolve([]);
		}

		// Current document is not currently formatted/fixed, let's lint it now !
		if (currentActionsOnDoc.length === 0 &&
			(!(this.isUpdateRequest(opts) && currentLintsOnDoc.length > 0))
		) {
			// Add current lint in currentlyLinted
			const source = textDocument.getText();
			this.currentlyLinted.push({ uri: textDocument.uri, options: opts, source: source });
			const res = await executeLinter(textDocument, this, opts);

			// Remove current lint from currently linted
			const justLintedPos = this.currentlyLinted.findIndex((currLinted) =>
				JSON.stringify({ uri: currLinted.uri, options: currLinted.options }) === JSON.stringify({ uri: textDocument.uri, options: opts }) &&
				currLinted.source === source);
			this.currentlyLinted.splice(justLintedPos, 1);

			// Check if there is another lint in queue for the same file
			const indexNextInQueue = this.queuedLints.findIndex((queuedItem) => queuedItem.uri === textDocument.uri);

			// There is another lint in queue for the same file: process it
			if (indexNextInQueue > -1) {
				const lintToProcess = this.queuedLints[indexNextInQueue];
				this.queuedLints.splice(indexNextInQueue, 1);
				debug(`Run queued lint for ${textDocument.uri} (${JSON.stringify(lintToProcess.options || '{}')})`);
				this.validateTextDocument(textDocument, lintToProcess.options).then(async (resVal) => {
					// If format has not been performed by queue request , lint again after it is processed
					if (lintToProcess.options.format === true, resVal && resVal.length > 0) {
						const documentUpdated = this.getDocumentFromUri(textDocument.uri);
						const newDoc = this.getUpToDateTextDocument(documentUpdated);
						this.validateTextDocument(newDoc);
					}
					// If fix has not been performed by queue request , lint again after it is processed
					else if (lintToProcess.options.fix === true) {
						const documentUpdated = this.getDocumentFromUri(textDocument.uri);
						const newDoc = this.getUpToDateTextDocument(documentUpdated);
						this.validateTextDocument(newDoc);
					}
				});
				return Promise.resolve([]);
			}
			return res;
		}

		// Document is currently formatted or fixed: add the request in queue !
		// gather current lints details
		const currentFormatsOnDoc = currentActionsOnDoc.filter((currLinted) => currLinted.options && currLinted.options.format === true);
		const currentFixesOnDoc = currentActionsOnDoc.filter((currLinted) => currLinted.options && currLinted.options.fix === true);

		// Format request and no current format or fix: add in queue
		if (opts.format === true && currentFormatsOnDoc.length === 0 && currentFixesOnDoc.length === 0) {
			// add applyNow option because TextEdits won't be returned to formatting provided. edit textDocument directly from language server
			opts.applyNow = true;
			this.queuedLints.push({ uri: textDocument.uri, options: opts });
			debug(`Added in queue: ${textDocument.uri} (${JSON.stringify(opts)})`);
		}
		// Fix request and no current fix: add in queue
		else if (opts.fix === true && currentFixesOnDoc.length === 0) {
			this.queuedLints.push({ uri: textDocument.uri, options: opts });
			debug(`Added in queue: ${textDocument.uri} (${JSON.stringify(opts || '{}')})`);
		}
		// All other cases: do not add in queue, else actions would be redundant
		else {
			debug(`WE SHOULD NOT BE HERE : ${textDocument.uri} (${JSON.stringify(opts || '{}')})`);
		}
		return Promise.resolve([]);
	}

	// Returns true if the request is format or fix
	isUpdateRequest(options: any) {
		return [options.format, options.fix].includes(true);
	}

	// Cancel all current and future document validations
	async cancelAllDocumentValidations() {
		this.queuedLints = [];
		for (const currLinted of this.currentlyLinted) {
			await this.cancelDocumentValidation(currLinted.uri);
		}
	}

	// Cancels a document validation
	async cancelDocumentValidation(textDocumentUri: string) {
		// Remove duplicates in queue ( ref: https://stackoverflow.com/a/56757215/7113625 )
		this.queuedLints = this.queuedLints.filter((v, i, a) => a.findIndex(t => (JSON.stringify(t) === JSON.stringify(v))) === i);
		this.queuedLints = this.queuedLints.filter((queuedLint) => queuedLint.uri !== textDocumentUri);
		// Find currently linted document
		this.currentlyLinted = this.currentlyLinted.filter((currLinted) => currLinted.uri !== textDocumentUri);
		this.connection.sendNotification(StatusNotification.type, {
			state: 'lint.cancel',
			documents: [{ documentUri: textDocumentUri }]
		});
	}

	// Return quick fixes associated to a document
	getDocQuickFixes(textDocumentUri: string): any[] {
		return this.docsDiagsQuickFixes.get(textDocumentUri) || [];
	}
	// Set document quick fixes
	setDocQuickFixes(textDocumentUri: string, docQuickFixes: any) {
		this.docsDiagsQuickFixes.set(textDocumentUri, docQuickFixes);
	}

	// Return NpmGroovyLint instance associated to a document
	getDocLinter(textDocumentUri: string): any {
		return this.docLinters.get(textDocumentUri);
	}
	// Set document NpmGroovyLint instance
	setDocLinter(textDocumentUri: string, linter: any) {
		this.docLinters.set(textDocumentUri, linter);
	}
	// Delete stored doc linter
	deleteDocLinter(textDocumentUri: string) {
		this.docLinters.delete(textDocumentUri);
	}

	// Set rule description for later display
	getRuleDescriptions(): any {
		return this.ruleDescriptions;
	}

	// Set rule description for later display
	getRuleDescription(ruleName: string): any {
		return this.ruleDescriptions.get(ruleName);
	}

	// Set rule description for later display
	setRuleDescriptions(rules: any): void {
		Object.keys(rules).forEach(key => {
			this.ruleDescriptions.set(key, rules[key]);
		});
	}

	// Return current workspace folder
	getCurrentWorkspaceFolder(): string {
		return this.currentWorkspaceFolder;
	}

	// Set current workspace folder
	async setCurrentWorkspaceFolder(textDocumentUri: string) {
		const workspaceFolders: WorkspaceFolder[] = await this.connection.workspace.getWorkspaceFolders() || [];
		const uriCompare = resolve(URI.parse(textDocumentUri).fsPath);
		for (const wsFolder of workspaceFolders) {
			if (uriCompare.includes(resolve(URI.parse(wsFolder.uri).fsPath))) {
				this.currentWorkspaceFolder = resolve(URI.parse(wsFolder.uri).fsPath);
				break;
			}
		}
	}

	// Get task id from counter
	getNewTaskId(): number {
		this.currentTaskId++;
		return this.currentTaskId;
	}

	// If document has been updated during an operation, get its most recent state
	getUpToDateTextDocument(textDocument: TextDocument): TextDocument {
		return this.documents.get(textDocument.uri) || textDocument; // Or expression, in case the textDocument is not opened yet
	}

	// Split source string into array of lines
	getTextDocumentLines(textDocument: TextDocument): string[] {
		// TODO(steve): Use TextDocument.eol instead of EOL so we
		// maintain the original line endings.
		let normalizedString = textDocument.getText() + "";
		normalizedString = normalizedString.replace(/\r/g, "");
		normalizedString = normalizedString.replace(/\n/g, EOL);
		return normalizedString.split(EOL);
	}

	// Update diagnostics on client and store them in docsDiagnostics field
	async updateDiagnostics(docUri: string, diagnostics: Diagnostic[]): Promise<void> {
		debug(`Update diagnostics for ${docUri}: ${diagnostics.length} diagnostics sent`);
		await this.connection.sendDiagnostics({ uri: docUri, diagnostics: diagnostics });
		this.docsDiagnostics.set(docUri, diagnostics);
	}

	/**
	 * Deletes diagnostics for a document.
	 *
	 * @param docUri The document URI to rest.
	 * @returns A Promise which resolved once the reset is complete.
	 **/
	async deleteDiagnostics(docUri: string): Promise<void> {
		const diags = this.docsDiagnostics.get(docUri);
		debug(`Delete diagnostics for ${docUri} was: ${diags?.length}`);
		if (diags === undefined) {
			// Nothing to do, so don't trigger an extra notification.
			return;
		}

		this.deleteDocLinter(docUri);
		this.docsDiagnostics.delete(docUri);
		this.docsDiagsQuickFixes.delete(docUri);
		await this.connection.sendDiagnostics({ uri: docUri, diagnostics: [] });
	}

	// Remove diagnostic after it has been cleared
	async removeDiagnostics(diagnosticsToRemove: Diagnostic[], textDocumentUri: string, removeAll?: boolean, recalculateRangeLinePos?: number): Promise<void> {
		let docDiagnostics: Diagnostic[] = this.docsDiagnostics.get(textDocumentUri) || [];
		for (const diagnosticToRemove of diagnosticsToRemove) {
			// Keep only diagnostics not matching diagnosticToRemove ()
			const diagnosticCodeNarcCode = (diagnosticToRemove.code as string).split('-')[0];
			docDiagnostics = docDiagnostics?.filter(diag =>
				(removeAll) ?
					(diag.code as string).split('-')[0] !== diagnosticCodeNarcCode :
					diag.code !== diagnosticToRemove.code);
			// Recalculate diagnostic ranges if line number has changed
			if (recalculateRangeLinePos || recalculateRangeLinePos === 0) {
				docDiagnostics = docDiagnostics?.map(diag => {
					if (diag?.range?.start?.line >= recalculateRangeLinePos) {
						diag.range.start.line = diag.range.start.line + 1;
						diag.range.end.line = diag.range.end.line + 1;
					}
					return diag;
				});
			}
		}
		await this.updateDiagnostics(textDocumentUri, docDiagnostics);
	}

	// Enable/Disable debug mode depending on VsCode GroovyLint setting groovyLint.debug.enable
	async refreshDebugMode(onInitialized: boolean) {
		if (onInitialized && process.env.DEBUG) {
			// Use DEBUG env var if configured on initialization, so Run and Debug -> Play works as expected.
			return;
		}

		const settings = await this.connection.workspace.getConfiguration({
			section: 'groovyLint'
		});

		// Enable debug logs if setting is set
		const debugLib = require("debug");
		if (settings.debug && settings.debug.enable === true) {
			debugLib.enable('vscode-groovy-lint');
			debugLib.enable('npm-groovy-lint');
		}
		// Disable if not set
		else {
			debugLib.disable('vscode-groovy-lint');
			debugLib.disable('npm-groovy-lint');
		}
	}
}
