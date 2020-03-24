import { TextDocuments, Diagnostic, TextDocumentIdentifier } from 'vscode-languageserver';
import { TextDocument, DocumentUri, TextEdit } from 'vscode-languageserver-textdocument';
import { executeLinter } from './linter';
import { applyQuickFixes, applyQuickFixesInFile, addSuppressWarning, alwaysIgnoreError } from './codeActions';
const debug = require("debug")("vscode-groovy-lint");

// Usable settings
export interface VsCodeGroovyLintSettings {
	enable: boolean;
	lint: any;
	fix: any;
	format: any;
	basic: any;
}

// Documents manager
export class DocumentsManager {
	// list of documents managed by the client
	documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
	// connection to client
	connection: any;
	// Counter for job id
	currentTaskId: number = 0;

	indentLength = 4; // TODO: Nice to set as config later... when we'll be able to generate RuleSets from vsCode config
	autoFixTabs = false;

	// Cache the settings of all open documents
	private documentSettings: Map<string, Thenable<VsCodeGroovyLintSettings>> = new Map();
	private currentTextDocumentUri: DocumentUri = '';

	// Memory stored values
	private docLinters: Map<String, any> = new Map<String, any>();
	private docsDiagnostics: Map<String, Diagnostic[]> = new Map<String, Diagnostic[]>();
	private docsDiagsQuickFixes: Map<String, any[]> = new Map<String, any[]>();
	// Lint/fix queue
	private currentlyLinted: any[] = [];
	private queuedLints: any[] = [];

	// Initialize documentManager
	constructor(cnx: any) {
		this.connection = cnx;
	}

	// Commands execution
	async executeCommand(params: any) {
		debug(`Request execute command ${JSON.stringify(params)}`);
		if (params.command === 'groovyLint.lint') {
			const document: TextDocument = this.getDocumentFromUri(this.currentTextDocumentUri)!;
			await this.validateTextDocument(document);
		}
		else if (params.command === 'groovyLint.lintFix') {
			const document: TextDocument = this.getDocumentFromUri(this.currentTextDocumentUri)!;
			await this.validateTextDocument(document, { fix: true });
		}
		else if (params.command === 'groovyLint.quickFix') {
			const [diagnostic, textDocumentUri] = params.arguments!;
			await applyQuickFixes([diagnostic], textDocumentUri, this);
		}
		else if (params.command === 'groovyLint.quickFixFile') {
			const [diagnostic, textDocumentUri] = params.arguments!;
			await applyQuickFixesInFile([diagnostic], textDocumentUri, this);
		}
		else if (params.command === 'groovyLint.addSuppressWarning') {
			const [diagnostic, textDocumentUri] = params.arguments!;
			await addSuppressWarning(diagnostic, textDocumentUri, 'line', this);
		}
		else if (params.command === 'groovyLint.addSuppressWarningFile') {
			const [diagnostic, textDocumentUri] = params.arguments!;
			await addSuppressWarning(diagnostic, textDocumentUri, 'file', this);
		}
		else if (params.command === 'groovyLint.alwaysIgnoreError') {
			const [diagnostic, textDocumentUri] = params.arguments!;
			await alwaysIgnoreError(diagnostic, textDocumentUri, this);
		}
	}

	// Return TextDocument from uri
	getDocumentFromUri(docUri: string, setCurrent = false): TextDocument {
		const textDocument = this.documents.get(docUri)!;
		if (setCurrent) {
			this.setCurrentDocumentUri(docUri);
		}
		return textDocument;
	}
	// Store URI of currently edited document
	setCurrentDocumentUri(uri: string) {
		this.currentTextDocumentUri = uri;
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
	async validateTextDocument(textDocument: TextDocument, opts: any = undefined): Promise<TextEdit[]> {
		// Remove duplicates in queue ( ref: https://stackoverflow.com/a/56757215/7113625 )
		this.queuedLints = this.queuedLints.filter((v, i, a) => a.findIndex(t => (JSON.stringify(t) === JSON.stringify(v))) === i);

		const currentlyLintDocPos = this.currentlyLinted.findIndex((currLinted) => currLinted.uri === textDocument.uri);
		// Current document is not already linted, let's lint it now !
		if (currentlyLintDocPos < 0) {
			// Add current lint in currentlyLinted
			this.currentlyLinted.push({ uri: textDocument.uri, options: opts });
			const res = await executeLinter(textDocument, this, opts);
			// Remove current lint frrom currently linter
			const justLintedPos = this.currentlyLinted.findIndex((currLinted) => JSON.stringify(currLinted) === JSON.stringify({ uri: textDocument.uri, options: opts }));
			this.currentlyLinted.splice(justLintedPos, 1);
			// Check if there is another lint in queue for the same file
			const indexNextInQueue = this.queuedLints.findIndex((queuedItem) => queuedItem.uri === textDocument.uri);
			// There is another lint in queue for the same file: process it
			if (indexNextInQueue > -1) {
				const lintToProcess = this.queuedLints[indexNextInQueue];
				this.queuedLints.splice(indexNextInQueue, 1);
				debug(`Run queued lint for ${textDocument.uri} (${JSON.stringify(lintToProcess.options || '{}')})`);
				return await this.validateTextDocument(textDocument, lintToProcess);
			}
			else {
				return res;
			}
		}
		else {
			// This file is already linted: add lint in queue , it will be processed when the response will arrive
			this.queuedLints.push({ uri: textDocument.uri, options: opts });
			debug(`${textDocument.uri} is already being linted: add request in queue`);
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
	// Get task id from counter
	getNewTaskId() {
		this.currentTaskId++;
		return this.currentTaskId;
	}

	// If document has been updated during an operation, get its most recent state
	getUpToDateTextDocument(textDocument: TextDocument): TextDocument {
		return this.documents.get(textDocument.uri)!;
	}

	// Split source string into array of lines
	getTextDocumentLines(textDocument: TextDocument) {
		return textDocument.getText()
			.replace(/\r?\n/g, "\r\n")
			.split("\r\n");
	}

	// Update diagnostics on client and store them in docsDiagnostics field
	async updateDiagnostics(docUri: string, diagnostics: Diagnostic[]) {
		debug(`Update diagnostics for ${docUri}: ${diagnostics.length} diagnostics sent`);
		await this.connection.sendDiagnostics({ uri: docUri, diagnostics: diagnostics });
		this.docsDiagnostics.set(docUri, diagnostics);
	}

	// Update diagnostics on client and store them in docsDiagnostics field
	async resetDiagnostics(docUri: string) {
		debug(`Reset diagnostics for ${docUri}`);
		const emptydiagnostics: Diagnostic[] = [];
		await this.connection.sendDiagnostics({ uri: docUri, diagnostics: emptydiagnostics });
		this.docsDiagnostics.set(docUri, emptydiagnostics);
		this.docsDiagsQuickFixes.set(docUri, []);
		this.deleteDocLinter(docUri);
	}

	// Remove diagnostic after it has been cleared
	async removeDiagnostics(diagnosticsToRemove: Diagnostic[], textDocumentUri: string, removeAll?: boolean, recalculateRangeLinePos?: number) {
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
}