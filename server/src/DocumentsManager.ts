import { TextDocuments, Diagnostic, DiagnosticSeverity, WorkspaceFolder } from 'vscode-languageserver';
import { TextDocument, DocumentUri, TextEdit } from 'vscode-languageserver-textdocument';
import { executeLinter } from './linter';
import { applyQuickFixes, applyQuickFixesInFile, addSuppressWarning, alwaysIgnoreError } from './codeActions';
import { isTest, showRuleDocumentation } from './clientUtils';
import { URI } from 'vscode-uri';
import path = require('path');
import { StatusNotification, VsCodeGroovyLintSettings } from './types';
import { lintFolder } from './folder';
const debug = require("debug")("vscode-groovy-lint");

// Documents manager
export class DocumentsManager {
	// list of documents managed by the client
	documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	// connection to client
	connection: any;

	indentLength = 4; // TODO: Nice to set as config later... when we'll be able to generate RuleSets from vsCode config
	autoFixTabs = false;

	// Counter for job id
	private currentTaskId: number = 0;

	// Cache the settings of all open documents
	private documentSettings: Map<string, Thenable<VsCodeGroovyLintSettings>> = new Map();
	private currentTextDocumentUri: DocumentUri = '';
	private currentWorkspaceFolder: string = process.cwd();

	// Memory stored values
	private docLinters: Map<String, any> = new Map<String, any>();
	private docsDiagnostics: Map<String, Diagnostic[]> = new Map<String, Diagnostic[]>();
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
		debug(`Request execute command ${JSON.stringify(params)}`);
		// Set current document URI if sent as parameter
		if (params.arguments && params.arguments[0] && URI.isUri(params.arguments[0])) {
			this.setCurrentDocumentUri(params.arguments[0].toString());
		}

		// Command: Lint
		if (params.command === 'groovyLint.lint') {
			const document: TextDocument = this.getDocumentFromUri(this.currentTextDocumentUri)!;
			await this.validateTextDocument(document);
		}
		// Command: Fix
		else if (params.command === 'groovyLint.lintFix') {
			let document: TextDocument = this.getDocumentFromUri(this.currentTextDocumentUri)!;
			await this.validateTextDocument(document, { fix: true });
			// Then lint again
			const newDoc = this.getUpToDateTextDocument(document);
			this.validateTextDocument(newDoc); // After fix, lint again
		}
		// Command: Apply quick fix
		else if (params.command === 'groovyLint.quickFix') {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await applyQuickFixes([diagnostic], textDocumentUri, this);
		}
		// Command: Apply quick fix in all file
		else if (params.command === 'groovyLint.quickFixFile') {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await applyQuickFixesInFile([diagnostic], textDocumentUri, this);
		}
		// NV: not working yet 
		else if (params.command === 'groovyLint.addSuppressWarning') {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await addSuppressWarning(diagnostic, textDocumentUri, 'line', this);
		}
		// NV: not working yet 
		else if (params.command === 'groovyLint.addSuppressWarningFile') {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await addSuppressWarning(diagnostic, textDocumentUri, 'file', this);
		}
		// Command: Update .groovylintrc.json to ignore error in the future
		else if (params.command === 'groovyLint.alwaysIgnoreError') {
			const [textDocumentUri, diagnostic] = params.arguments!;
			await alwaysIgnoreError(diagnostic, textDocumentUri, this);
		}
		// Show rule documentation
		else if (params.command === 'groovyLint.showRuleDocumentation') {
			const [ruleCode] = params.arguments!;
			await showRuleDocumentation(ruleCode, this);
		}
		// Command: Lint folder
		else if (params.command === 'groovyLint.lintFolder') {
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

	// Remove document settings when closed
	removeDocumentSettings(uri: string) {
		if (uri === 'all') {
			this.documentSettings.clear();
		}
		else {
			this.documentSettings.delete(uri);
		}
	}

	// Format a text document
	async formatTextDocument(textDocument: TextDocument): Promise<TextEdit[]> {
		return await this.validateTextDocument(textDocument, { format: true });
	}

	// Validate a text document by calling linter
	async validateTextDocument(textDocument: TextDocument, opts: any = {}): Promise<TextEdit[]> {
		// Find if document is already been linted
		const currentActionsOnDoc = this.currentlyLinted.filter((currLinted) => currLinted.uri === textDocument.uri);
		// Current document is not already linted, let's lint it now !
		if (currentActionsOnDoc.length === 0) {
			// Add current lint in currentlyLinted
			this.currentlyLinted.push({ uri: textDocument.uri, options: opts });
			const res = await executeLinter(textDocument, this, opts);
			// Remove current lint from currently linter
			const justLintedPos = this.currentlyLinted.findIndex((currLinted) => JSON.stringify({ uri: currLinted.uri, options: currLinted.options }) === JSON.stringify({ uri: textDocument.uri, options: opts }));
			this.currentlyLinted.splice(justLintedPos, 1);
			// Check if there is another lint in queue for the same file
			const indexNextInQueue = this.queuedLints.findIndex((queuedItem) => queuedItem.uri === textDocument.uri);
			// There is another lint in queue for the same file: process it
			if (indexNextInQueue > -1) {
				const lintToProcess = this.queuedLints[indexNextInQueue];
				this.queuedLints.splice(indexNextInQueue, 1);
				debug(`Run queued lint for ${textDocument.uri} (${JSON.stringify(lintToProcess.options || '{}')})`);
				this.validateTextDocument(textDocument, lintToProcess.options).then(async (resVal) => {
					// If format has not been performed directly , lint again after it is processes
					if (lintToProcess.options.format === true, resVal && resVal.length > 0) {
						const documentUpdated = this.getDocumentFromUri(textDocument.uri);
						this.validateTextDocument(documentUpdated);
					}
				});
				return Promise.resolve([]);
			} else {
				return res;
			}
		}
		else {
			// gather current lints details
			const currentFormatsOnDdoc = currentActionsOnDoc.filter((currLinted) => currLinted.options && currLinted.options.format === true);
			const currentFixesOnDdoc = currentActionsOnDoc.filter((currLinted) => currLinted.options && currLinted.options.format === true);

			// Format request and no current format or fix: add in queue
			if (opts.format === true && currentFormatsOnDdoc.length === 0 && currentFixesOnDdoc.length === 0) {
				// add applyNow option because TextEdits won't be returned to formatting provided. edit textDocument directly from language server
				opts.applyNow = true;
				this.queuedLints.push({ uri: textDocument.uri, options: opts });
				debug(`Added in queue: ${textDocument.uri} (${JSON.stringify(opts)})`);
			}
			// Fix request and no current fix: add in queue
			else if (opts.fix === true && currentFixesOnDdoc.length === 0) {
				this.queuedLints.push({ uri: textDocument.uri, options: opts });
				debug(`Added in queue: ${textDocument.uri} (${JSON.stringify(opts || '{}')})`);
			}
			// All other cases: do not add in queue, else actions would be redundant
			else {
				debug(`Skipped request : ${textDocument.uri} (${JSON.stringify(opts || '{}')})`);
			}
			return Promise.resolve([]);
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
		const uriCompare = path.resolve(URI.parse(textDocumentUri).fsPath);
		for (const wsFolder of workspaceFolders) {
			if (uriCompare.includes(path.resolve(URI.parse(wsFolder.uri).fsPath))) {
				this.currentWorkspaceFolder = path.resolve(URI.parse(wsFolder.uri).fsPath);
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
	getTextDocumentLines(textDocument: TextDocument) {
		return textDocument.getText()
			.replace(/\r?\n/g, "\r\n")
			.split("\r\n");
	}

	// Update diagnostics on client and store them in docsDiagnostics field
	async updateDiagnostics(docUri: string, diagnostics: Diagnostic[]): Promise<void> {
		debug(`Update diagnostics for ${docUri}: ${diagnostics.length} diagnostics sent`);
		await this.connection.sendDiagnostics({ uri: docUri, diagnostics: diagnostics });
		this.docsDiagnostics.set(docUri, diagnostics);
	}

	// Reset diagnostics (if current action, indicate it as a single diagnostic info)
	async resetDiagnostics(docUri: string, optns: any = { deleteDocLinter: true }): Promise<void> {
		debug(`Reset diagnostics for ${docUri}`);
		const emptyDiagnostics: Diagnostic[] = [];
		const diagsAreNotEmpty = (this.docsDiagnostics.get(docUri) &&
			this.docsDiagnostics.get(docUri)!.length > 0
			&& this.docsDiagnostics.get(docUri)![0].code !== 'GroovyLintWaiting');
		if (optns.verb && optns.verb !== 'formatting' && diagsAreNotEmpty) {
			const waitingDiagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Information,
				code: `GroovyLintWaiting`,
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 }
				},
				message: `GroovyLint is ${optns.verb}...`,
				source: 'GroovyLint'
			};
			await this.connection.sendDiagnostics({ uri: docUri, diagnostics: [waitingDiagnostic] });
		}
		else {
			await this.connection.sendDiagnostics({ uri: docUri, diagnostics: emptyDiagnostics });
		}
		this.docsDiagnostics.set(docUri, emptyDiagnostics);
		this.docsDiagsQuickFixes.set(docUri, []);
		if (optns.deleteDocLinter === true) {
			this.deleteDocLinter(docUri);
		}
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
	async refreshDebugMode() {
		const settings = await this.connection.workspace.getConfiguration({
			section: 'groovyLint'
		});
		// Enable debug logs if setting is set
		const debugLib = require("debug");
		if (settings.debug && settings.debug.enable === true) {
			debugLib.enable('vscode-groovy-lint,npm-groovy-lint');
		}
		// Disable if not set
		else {
			debugLib.disable('vscode-groovy-lint,npm-groovy-lint');
		}
	}
}