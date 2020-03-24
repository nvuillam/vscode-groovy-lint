/* eslint-disable eqeqeq */
import { Command, Diagnostic, DiagnosticSeverity, ShowMessageRequestParams, MessageType, NotificationType } from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import * as path from 'path';

import { DocumentsManager } from './DocumentsManager';
import { applyTextDocumentEditOnWorkspace, getUpdatedSource, createTestEdit } from './clientUtils';
const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");
const debug = require("debug")("vscode-groovy-lint");
const { performance } = require('perf_hooks');

// Status notifications
interface StatusParams {
	id: number,
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

// Create commands
const COMMAND_LINT = Command.create('Lint', 'groovyLint.lint');
const COMMAND_LINT_FIX = Command.create('Lint and fix errors', 'groovyLint.lintFix');
const COMMAND_LINT_QUICKFIX = Command.create('Quick fix', 'groovyLint.quickFix');
const COMMAND_LINT_QUICKFIX_FILE = Command.create('Quick fix in file', 'groovyLint.quickFixFile');
const COMMAND_SUPPRESS_WARNING_LINE = Command.create('Ignore this error', 'groovyLint.addSuppressWarning');
const COMMAND_SUPPRESS_WARNING_FILE = Command.create('Ignore this error in file', 'groovyLint.addSuppressWarningFile');
const COMMAND_IGNORE_ERROR_FOR_ALL_FILES = Command.create('Ignore this error in all files', 'groovyLint.alwaysIgnoreError');
export const commands = [
	COMMAND_LINT,
	COMMAND_LINT_FIX,
	COMMAND_LINT_QUICKFIX,
	COMMAND_LINT_QUICKFIX_FILE,
	COMMAND_SUPPRESS_WARNING_LINE,
	COMMAND_SUPPRESS_WARNING_FILE,
	COMMAND_IGNORE_ERROR_FOR_ALL_FILES
];

// Validate a groovy file
export async function executeLinter(textDocument: TextDocument, docManager: DocumentsManager, opts: any = { fix: false, format: false }): Promise<TextEdit[]> {
	const perfStart = performance.now();

	// Get settings and stop if action not enabled
	let settings = await docManager.getDocumentSettings(textDocument.uri);
	// Linter disabled
	if (settings.enable === false) {
		return Promise.resolve([]);
	}
	// Formatter disabled
	if (opts.format && settings.format.enable === false) {
		return Promise.resolve([]);
	}
	// Fixer disabled
	if (opts.fix && settings.fix.enable === false) {
		return Promise.resolve([]);
	}

	// In case lint was queues, get most recent version of textDocument
	textDocument = docManager.getUpToDateTextDocument(textDocument);

	// Propose to replace tabs by spaces if there are, because CodeNarc hates tabs :/
	let source: string = textDocument.getText();
	let fileNm = path.basename(textDocument.uri);
	source = await manageFixSourceBeforeCallingLinter(source, textDocument, docManager);
	// If user was prompted and did not respond, do not lint
	if (source === 'cancel') {
		return Promise.resolve([]);
	}

	// Remove already existing diagnostics except if format
	if (!opts.format) {
		await docManager.resetDiagnostics(textDocument.uri);
	}

	// Get a new task id
	const linterTaskId = docManager.getNewTaskId();

	// Notify client that lint is starting
	debug(`Start linting ${textDocument.uri}`);
	docManager.connection.sendNotification(StatusNotification.type, {
		id: linterTaskId,
		state: 'lint.start' + (opts.fix ? '.fix' : opts.format ? '.format' : ''),
		documents: [{ documentUri: textDocument.uri }],
		lastFileName: fileNm
	});

	// Build NmpGroovyLint config
	const npmGroovyLintConfig: any = {
		source: source,
		loglevel: settings.basic.loglevel,
		output: 'none',
		verbose: settings.basic.verbose
	};
	// Add format param if necessary
	if (opts.format) {
		npmGroovyLintConfig.format = true;
	}
	// Add fix param if necessary
	if (opts.fix) {
		npmGroovyLintConfig.fix = true;
	}

	// Run npm-groovy-lint linter/fixer
	const linter = new NpmGroovyLint(npmGroovyLintConfig, {});
	try {
		await linter.run();
		if (!opts.format) {
			docManager.setDocLinter(textDocument.uri, linter);
		}
	} catch (e) {
		// If error, send notification to client
		console.error('VsCode Groovy Lint error: ' + e.message + '\n' + e.stack);
		debug(`Error linting ${textDocument.uri}` + e.message + '\n' + e.stack);
		docManager.connection.sendNotification(StatusNotification.type, {
			id: linterTaskId,
			state: 'lint.error',
			documents: [{ documentUri: textDocument.uri }],
			lastFileName: fileNm
		});
		return Promise.resolve([]);
	}
	console.info(`Completed linting ${textDocument.uri} in ${(performance.now() - perfStart).toFixed(0)}`);

	// Parse results
	const lintResults = linter.lintResult || {};
	const diagnostics: Diagnostic[] = parseLinterResultsIntoDiagnostics(lintResults, source, textDocument, docManager);

	// Send diagnostics to client except if format
	if (!opts.format) {
		await docManager.updateDiagnostics(textDocument.uri, diagnostics);
	}

	let textEdits: TextEdit[] = [];

	// Send updated sources to client if fix mode
	if (opts.format === true && linter.status === 0) {
		if (opts.applyNow) {
			await applyTextDocumentEditOnWorkspace(docManager, textDocument, getUpdatedSource(linter, source));
		}
		else {
			const textEdit = createTestEdit(docManager, textDocument, getUpdatedSource(linter, source));
			textEdits.push(textEdit);
		}
	}

	// Send updated sources to client if fix mode
	if (opts.fix === true && linter.status === 0) {
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, getUpdatedSource(linter, source));
	}
	// Just Notify client of end of linting 
	docManager.connection.sendNotification(StatusNotification.type, {
		id: linterTaskId,
		state: 'lint.end',
		documents: [{
			documentUri: textDocument.uri
		}],
		lastFileName: fileNm,
		lastLintTimeMs: performance.now() - perfStart
	});
	return Promise.resolve(textEdits);
}

// Parse results into VsCode diagnostic
export function parseLinterResultsIntoDiagnostics(lintResults: any, source: string, textDocument: TextDocument, docManager: DocumentsManager) {
	const allText = source;
	const diffLine = -1; // Difference between CodeNarc line number and VSCode line number

	const allTextLines = allText.split('\n');

	// Build diagnostics
	let diagnostics: Diagnostic[] = [];
	const docQuickFixes: any = {};
	debug(`Parsing results of ${textDocument.uri} (${Object.keys(lintResults.files).length} in lintResults)`);
	if (lintResults.files && lintResults.files[0] && lintResults.files[0].errors) {
		// Get each error for the file
		let pos = 0;
		for (const err of lintResults.files[0].errors) {
			if (err.fixed === true) {
				continue; // Do not display diagnostics for fixed errors
			}
			let range = err.range;
			if (range) {
				range.start.line += diffLine;
				range.end.line += diffLine;
				// Avoid issue from linter if it returns wrong range
				range.start.line = (range.start.line >= 0) ? range.start.line : 0;
				range.start.character = (range.start.character >= 0) ? range.start.character : 0;
				range.end.line = (range.end.line >= 0) ? range.end.line : 0;
				range.end.character = (range.end.character >= 0) ? range.end.character : 0;
			}
			// Build default range (whole line) if not returned by npm-groovy-lint
			// eslint-disable-next-line eqeqeq
			else if (err.line && err.line != null && err.line > 0 && allTextLines[err.line + diffLine]) {
				const line = allTextLines[err.line + diffLine];
				const indent = line.search(/\S/);
				range = {
					start: {
						line: err.line + diffLine,
						character: (indent >= 0) ? indent : 0 // Get first non empty character position
					},
					end: {
						line: err.line + diffLine,
						character: line.length || 0
					}
				};
			} else {
				// Default range (should not really happen)
				range = {
					start: {
						line: 0,
						character: 0 // Get first non empty character position
					},
					end: {
						line: 0,
						character: 0
					}
				};
			}
			// Create vscode Diagnostic
			const diagCode: string = err.rule + '-' + err.id;
			const diagnostic: Diagnostic = {
				severity: (err.severity === 'error') ? DiagnosticSeverity.Error :
					(err.severity === 'warning') ? DiagnosticSeverity.Warning :
						DiagnosticSeverity.Information,
				code: diagCode,
				range: range,
				message: err.msg,
				source: 'GroovyLint'
			};
			// Add quick fix if error is fixable. This will be reused in CodeActionProvider
			if (err.fixable) {
				docQuickFixes[diagCode] = [];
				docQuickFixes[diagCode].push({
					label: err.fixLabel || `Fix ${err.rule}`,
					errId: err.id
				});
			}
			diagnostics.push(diagnostic);
			pos++;
		}
		docManager.setDocQuickFixes(textDocument.uri, docQuickFixes);
	}
	return diagnostics;
}

// If necessary, fix source before sending it to CodeNarc
async function manageFixSourceBeforeCallingLinter(source: string, textDocument: TextDocument, docManager: DocumentsManager): Promise<string> {
	if (source.includes("\t")) {
		let fixTabs = false;
		if (docManager.autoFixTabs === false) {
			const msg: ShowMessageRequestParams = {
				type: MessageType.Info,
				message: "CodeNarc linter doesn't like tabs, let's replace them by spaces ?",
				actions: [
					{ title: "Always (recommended)" },
					{ title: "Yes" },
					{ title: "No" },
					{ title: "Never" }]
			};
			let req: any;
			let msgResponseReceived = false;
			// When message box closes after no action, Promise is never fullfilled, so track that case to unlock linter queue
			setTimeout(async () => {
				if (msgResponseReceived === false) {
					await docManager.cancelDocumentValidation(textDocument.uri);
				}
			}, 10000);
			try {
				req = await docManager.connection.sendRequest('window/showMessageRequest', msg);
				msgResponseReceived = true;
			} catch (e) {
				debug('No response from showMessageRequest: ' + e.message);
				req = null;
			}
			if (req == null) {
				return 'cancel';
			} else if (req.title === "Always (recommended)") {
				docManager.autoFixTabs = true;
			} else if (req.title === "Yes") {
				fixTabs = true;
			}
		}
		if (docManager.autoFixTabs || fixTabs) {
			const replaceChars = " ".repeat(docManager.indentLength);
			source = source.replace(/\t/g, replaceChars);
			await applyTextDocumentEditOnWorkspace(docManager, textDocument, source);
			debug(`Replaces tabs by spaces in ${textDocument.uri}`);
		}
	}
	return source;
}