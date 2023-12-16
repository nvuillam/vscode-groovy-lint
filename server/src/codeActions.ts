/* eslint-disable eqeqeq */
import {
	CodeAction,
	CodeActionParams,
	DiagnosticSeverity,
	CodeActionKind,
	Diagnostic,
	MessageType,
	ShowMessageRequestParams
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { isNullOrUndefined } from "util";
import * as fse from "fs-extra";

import { DocumentsManager } from './DocumentsManager';
import { applyTextDocumentEditOnWorkspace, getUpdatedSource, notifyFixFailures } from './clientUtils';
import { parseLinterResults } from './linterParser';
import { StatusNotification, OpenNotification } from './types';
import {
	COMMAND_LINT_QUICKFIX,
	COMMAND_LINT_QUICKFIX_FILE,
	COMMAND_DISABLE_ERROR_FOR_LINE,
	COMMAND_DISABLE_ERROR_FOR_FILE,
	COMMAND_DISABLE_ERROR_FOR_PROJECT,
	COMMAND_SHOW_RULE_DOCUMENTATION
} from './commands';
import { dirname } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
const debug = require("debug")("vscode-groovy-lint");
const trace = require("debug")("vscode-groovy-lint-trace");

/**
 * Provide quick-fixes for a piece of code  *
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} codeActionParams
 * @returns {CodeAction[]}
 */
export function provideQuickFixCodeActions(textDocument: TextDocument, codeActionParams: CodeActionParams, docQuickFixes: any): CodeAction[] {
	const diagnostics = codeActionParams.context.diagnostics;
	const quickFixCodeActions: CodeAction[] = [];
	if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
		return quickFixCodeActions;
	}

	trace(`docQuickFixes: ${JSON.stringify(docQuickFixes, null, 2)}`);
	// Browse diagnostics to get related CodeActions
	for (const diagnostic of codeActionParams.context.diagnostics) {
		// Skip Diagnostics not from VsCodeGroovyLint
		trace(`Diagnostic is ${JSON.stringify(diagnostic, null, 2)}`);
		if (diagnostic.source !== 'GroovyLint') {
			continue;
		}
		// Get corresponding QuickFix if existing and convert it as QuickAction
		const diagCode: string = diagnostic.code + '';
		if (docQuickFixes && docQuickFixes[diagCode]) {
			for (const quickFix of docQuickFixes[diagCode]) {
				const codeActions = createQuickFixCodeActions(diagnostic, quickFix, textDocument.uri);
				debug(`codeActions is ${JSON.stringify(codeActions, null, 2)}`);
				quickFixCodeActions.push(...codeActions);
			}
		}
		// Add Ignores for this error
		const disableActions = createDisableActions(diagnostic, textDocument.uri);
		quickFixCodeActions.push(...disableActions);
		const viewDocAction = createViewDocAction(diagnostic, textDocument.uri);
		if (viewDocAction) {
			quickFixCodeActions.push(viewDocAction);
		}
	}
	debug(`Provided ${quickFixCodeActions.length} codeActions for ${textDocument.uri}`);
	return quickFixCodeActions;
}

// Create QuickFix codeActions for diagnostic
function createQuickFixCodeActions(diagnostic: Diagnostic, quickFix: any, textDocumentUri: string): CodeAction[] {
	const codeActions: CodeAction[] = [];

	// Quick fix only this error
	const quickFixAction: CodeAction = {
		title: quickFix.label,
		kind: CodeActionKind.RefactorRewrite,
		command: {
			command: COMMAND_LINT_QUICKFIX.command,
			title: quickFix.label,
			arguments: [textDocumentUri, diagnostic]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	codeActions.push(quickFixAction);
	codeActions.push(Object.assign(Object.assign({}, quickFixAction), { kind: CodeActionKind.QuickFix }));

	// Quick fix error in file
	const quickFixActionAllFile: CodeAction = {
		title: `${quickFix.label} for this entire file`,
		kind: CodeActionKind.Source,
		command: {
			command: COMMAND_LINT_QUICKFIX_FILE.command,
			title: `${quickFix.label} for this entire file`,
			arguments: [textDocumentUri, diagnostic]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	codeActions.push(quickFixActionAllFile);
	codeActions.push(Object.assign(Object.assign({}, quickFixActionAllFile), { kind: CodeActionKind.QuickFix }));
	return codeActions;
}

function createDisableActions(diagnostic: Diagnostic, textDocumentUri: string): CodeAction[] {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in createDisableActions as there is no diagnostic set');
		return [];
	}
	const disableActions: CodeAction[] = [];
	let errorLabel = (diagnostic.code as string).split('-')[0].replace(/([A-Z])/g, ' $1').trim();

	if (diagnostic.severity === DiagnosticSeverity.Warning ||
		diagnostic.severity === DiagnosticSeverity.Error ||
		diagnostic.severity === DiagnosticSeverity.Information) {

		// Ignore only this error
		const titleDisableLine = `${errorLabel}: disable for this line`;
		const disableErrorAction: CodeAction = {
			title:titleDisableLine,
			kind: CodeActionKind.QuickFix,
			command: {
				command: COMMAND_DISABLE_ERROR_FOR_LINE.command,
				title: titleDisableLine,
				arguments: [textDocumentUri, diagnostic]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		disableActions.push(disableErrorAction);

		// disable this error type in all file
		const titleDisableAllFile = `${errorLabel}: disable for the entire file`;
		const disableErrorInFileAction: CodeAction = {
			title: titleDisableAllFile,
			kind: CodeActionKind.QuickFix,
			command: {
				command: COMMAND_DISABLE_ERROR_FOR_FILE.command,
				title: titleDisableAllFile,
				arguments: [textDocumentUri, diagnostic]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		disableActions.push(disableErrorInFileAction);

		// disable this error type in all project (will update .groovylintrc.json)
		const titleDisableProject = `${errorLabel}: disable for entire project`;
		const disableInProjectAction: CodeAction = {
			title: titleDisableProject,
			kind: CodeActionKind.QuickFix,
			command: {
				command: COMMAND_DISABLE_ERROR_FOR_PROJECT.command,
				title: titleDisableProject,
				arguments: [textDocumentUri, diagnostic]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		disableActions.push(disableInProjectAction);
	}
	return disableActions;
}

// Create action to view documentation
function createViewDocAction(diagnostic: Diagnostic, textDocumentUri: string): CodeAction | null {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in createViewDocAction as there is no diagnostic set');
		return null;
	}
	const ruleCode = (diagnostic.code as string).split('-')[0];
	let errorLabel = ruleCode.replace(/([A-Z])/g, ' $1').trim();
	const titleShowDoc = `${errorLabel}: show documentation`;
	const viewCodeAction: CodeAction = {
		title: titleShowDoc,
		kind: CodeActionKind.QuickFix,
		command: {
			command: COMMAND_SHOW_RULE_DOCUMENTATION.command,
			title: titleShowDoc,
			arguments: [ruleCode]
		},
		diagnostics: [diagnostic],
		isPreferred: false
	};
	return viewCodeAction;
}

// Apply quick fixes
export async function applyQuickFixes(diagnostics: Diagnostic[], textDocumentUri: string, docManager: DocumentsManager) {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostics == null || diagnostics.length === 0) {
		console.warn('Warning: we should not be in applyQuickFixes as there is no diagnostics set');
		return;
	}

	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	const errorIds: number[] = [];
	for (const diagnostic of diagnostics) {
		errorIds.push(parseInt((diagnostic.code as string).split('-')[1], 10));
	}
	debug(`Request apply QuickFixes for ${textDocumentUri}: ${errorIds.join(',')}`);

	// Call NpmGroovyLint instance fixer
	const docLinter = docManager.getDocLinter(textDocument.uri);
	debug(`Start fixing ${textDocument.uri}`);
	docManager.connection.sendNotification(StatusNotification.type, {
		state: 'lint.start.fix',
		documents: [{ documentUri: textDocument.uri }],
		lastFileName: textDocument.uri
	});
	await docLinter.fixErrors(errorIds, { nolintafter: true });
	// Parse fix results
	const { fixFailures } = parseLinterResults(docLinter.lintResult, textDocument.getText(), textDocument, docManager);
	// Notify user of failures if existing
	await notifyFixFailures(fixFailures, docManager);
	// Just Notify client of end of fixing
	await docManager.connection.sendNotification(StatusNotification.type, {
		state: 'lint.end',
		documents: [{
			documentUri: textDocument.uri
		}],
		lastFileName: textDocument.uri
	});
	// Apply updates to textDocument
	if (docLinter.status !== 0) {
		debug(`Error while fixing ${textDocument.uri} status: ${docLinter.status} error: ${docLinter.error ? docLinter.error.msg : 'unknown'}}`);
	} else if (docLinter.lintResult.summary.totalFixedNumber > 0) {
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, getUpdatedSource(docLinter, textDocument.getText()));
		setTimeout(() => { // Wait 500ms so we are more sure that the textDocument is already updated
			const newDoc = docManager.getUpToDateTextDocument(textDocument);
			docManager.validateTextDocument(newDoc, { force: true });
		}, 500);
	}
	debug(`End fixing ${textDocument.uri}`);
}

// Quick fix in the whole file
export async function applyQuickFixesInFile(diagnostics: Diagnostic[], textDocumentUri: string, docManager: DocumentsManager) {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostics == null || diagnostics.length === 0) {
		console.warn('Warning: we should not be in applyQuickFixesInFile as there is no diagnostics set');
		return;
	}

	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	const fixRule = (diagnostics[0].code as string).split('-')[0];
	debug(`Request apply QuickFixes in file for ${fixRule} error in ${textDocumentUri}`);
	// Fix call
	await docManager.validateTextDocument(textDocument, { fix: true, fixrules: [fixRule] });
	// Lint after call
	debug(`Request new lint of ${textDocumentUri} after fix action`);
	setTimeout(() => { // Wait 500ms so we are more sure that the textDocument is already updated
		const newDoc = docManager.getUpToDateTextDocument(textDocument);
		docManager.validateTextDocument(newDoc, { force: true });
	}, 500);
}

// Disable error with comment groovylint-disable
export async function disableErrorWithComment(diagnostic: Diagnostic, textDocumentUri: string, scope: string, docManager: DocumentsManager) {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in disableErrorWithComment as there is no diagnostic set');
		return;
	}

	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	const allLines = docManager.getTextDocumentLines(textDocument);
	// Get line to check or create
	let linePos: number = 0;
	let disableKey: string = '';
	switch (scope) {
		// Get single error line position
		case 'line':
			linePos = getDiagnosticRangeInfo(diagnostic.range, 'start').line || 0;
			disableKey = 'groovylint-disable-next-line';
			break;
		// Manage shebang case ( https://en.wikipedia.org/wiki/Shebang_(Unix) ): use first or second line if shebang
		case 'file':
			linePos = (allLines[0] && allLines[0].startsWith('#!')) ? 1 : 0;
			disableKey = 'groovylint-disable';
			break;
	}
	const line: string = allLines[linePos];
	const prevLinePos = (linePos === 0) ? 0 : (linePos === 1) ? 1 : linePos - 1;
	const prevLine: string = allLines[prevLinePos] || '';
	const indent = " ".repeat(line.search(/\S/));
	const errorCode = (diagnostic.code as string).split('-')[0];
	const commentRules = parseGroovyLintComment(disableKey, prevLine);
	if (commentRules) {
		// Update existing /* groovylint-disable */ or /* groovylint-disable-next-line */
		commentRules.push(errorCode);
		commentRules.sort();
		const disableLine = indent + `/* ${disableKey} ${[...new Set(commentRules)].join(", ")} */`;
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, disableLine, { replaceLinePos: prevLinePos });
	}
	else {
		// Add new /* groovylint-disable */ or /* groovylint-disable-next-line */
		const disableLine = indent + `/* ${disableKey} ${errorCode} */`;
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, disableLine, { insertLinePos: linePos });
	}

	// The content of textDocument.getText() will be out of date, so request
	// a lint when we get the new document content via onDidChangeContent.
	docManager.updateDocumentSettings(textDocument.uri, {lint: {next: true}});
}

/* Depending of context, diagnostic.range can be
{ start : {line: 1, character:1}, end : {line: 2, character:2} }
or
[ {line: 1, character:1}, {line: 2, character:2] ]
*/
function getDiagnosticRangeInfo(range: any, startOrEnd: string): any {
	if (Array.isArray(range)) {
		return (startOrEnd === 'start') ? range[0] : range[1];
	}
	return range[startOrEnd];
}

// Parse groovylint comment
function parseGroovyLintComment(type: string, line: string) {
	if (line.includes(type) &&
		!(type === 'groovylint-disable' && line.includes('groovylint-disable-next-line'))) {
		const typeDetail = line
			.replace("/*", "")
			.replace("//", "")
			.replace("*/", "")
			.replace(type, "")
			.trim();
		if (typeDetail) {
			const errors = typeDetail.split(",").map((errType: string) => errType.trim());
			return errors;
		}
		return [];
	}
	return false;
}


// Create/ Update .groovylintrc.json file
export async function disableErrorForProject(diagnostic: Diagnostic, textDocumentUri: string, docManager: DocumentsManager) {
	debug(`Request disable error in all project from ${textDocumentUri}`);
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in alwaysIgnoreError as there is no diagnostic set');
		return [];
	}
	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	// Get line to check or create
	const errorCode: string = (diagnostic.code as string).split('-')[0];
	debug(`Error code to be disabled is ${errorCode}`);
	// Get or create configuration file path using NpmGroovyLint instance associated to this document
	const docLinter = docManager.getDocLinter(textDocument.uri);
	const textDocumentFilePath: string = URI.parse(textDocument.uri).fsPath;
	const startPath = dirname(textDocumentFilePath);
	let configFilePath: string = await docLinter.getConfigFilePath(startPath);
	let configFileContent = JSON.parse(fse.readFileSync(configFilePath, "utf8").toString());
	if (configFilePath.endsWith(".groovylintrc-recommended.json")) {
		const projectFolder = docManager.getCurrentWorkspaceFolder();
		configFilePath = `${projectFolder}/.groovylintrc.json`;
		configFileContent = { extends: "recommended", rules: {} };
	}
	debug(`Config file to be created/updated is ${configFilePath}`);
	// Find / Create disabled rule
	const newRuleContent = { enabled: false };
	let existingRule: Array<any> = Object.entries(configFileContent.rules).filter(mapElt => {
		mapElt[0].includes(errorCode);
	});
	if (existingRule.length > 0) {
		if (typeof configFileContent.rules[existingRule[0]] === 'string') { // ex: "warning"
			Object.assign(newRuleContent, { severity: configFileContent.rules[existingRule[0]] });
		} else { // ex: 'indentationLevel: 4'
			delete configFileContent.rules[existingRule[0]].enabled;
			delete configFileContent.rules[existingRule[0]].disabled;
			Object.assign(newRuleContent, configFileContent.rules[existingRule[0]]);
		}
		delete configFileContent.rules[existingRule[0]];
	}
	configFileContent.rules[errorCode] = newRuleContent;

	// Reorder rules
	const rulesSorted: any = {};
	for (const ruleKey of Object.keys(configFileContent.rules).sort()) {
		rulesSorted[ruleKey] = configFileContent.rules[ruleKey];
	}
	configFileContent.rules = rulesSorted;

	// Write new JSON config
	await fse.writeFile(configFilePath, JSON.stringify(configFileContent, null, 4));
	debug(`Updated file ${configFilePath}`);

	// Remove Diagnostics corresponding to this error
	const removeAll = true;
	docManager.removeDiagnostics([diagnostic], textDocument.uri, removeAll);

	// Lint again all open documents
	docManager.lintAgainAllOpenDocuments();

	// Show message to user and propose to open the configuration file
	const msg: ShowMessageRequestParams = {
		type: MessageType.Info,
		message: `Disabled rule ${errorCode} in config file`,
		actions: [
			{ title: "Open" }
		]
	};
	try {
		const req = await docManager.connection.sendRequest('window/showMessageRequest', msg);
		if (req.title === "Open") {
			await docManager.connection.sendNotification(OpenNotification.type, { file: configFilePath });
		}
	} catch (e) {
		debug(`Error with window/showMessageRequest or Opening config file: ${(e as any).message}`);
	}
}
