/* eslint-disable eqeqeq */
import {
	CodeAction,
	CodeActionParams,
	DiagnosticSeverity,
	CodeActionKind,
	TextDocument,
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
import path = require('path');
const debug = require("debug")("vscode-groovy-lint");

/**
 * Provide quick-fixes for a piece of code  *
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} parms
 * @returns {CodeAction[]}
 */
export function provideQuickFixCodeActions(textDocument: TextDocument, codeActionParams: CodeActionParams, docQuickFixes: any): CodeAction[] {
	const diagnostics = codeActionParams.context.diagnostics;
	const quickFixCodeActions: CodeAction[] = [];
	if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
		return quickFixCodeActions;
	}
	// Browse diagnostics to get related CodeActions
	for (const diagnostic of codeActionParams.context.diagnostics) {
		// Skip Diagnostics not from VsCodeGroovyLint
		if (diagnostic.source !== 'GroovyLint') {
			continue;
		}
		// Get corresponding QuickFix if existing and convert it as QuickAction
		const diagCode: string = diagnostic.code + '';
		if (docQuickFixes && docQuickFixes[diagCode]) {
			for (const quickFix of docQuickFixes[diagCode]) {
				const codeActions = createQuickFixCodeActions(diagnostic, quickFix, textDocument.uri);
				quickFixCodeActions.push(...codeActions);
			}
		}
		// Add Ignores for this error
		const ignoreActions = createIgnoreActions(diagnostic, textDocument.uri);
		quickFixCodeActions.push(...ignoreActions);
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
			command: 'groovyLint.quickFix',
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
		title: `${quickFix.label} in the entire file`,
		kind: CodeActionKind.Source,
		command: {
			command: 'groovyLint.quickFixFile',
			title: `${quickFix.label} in the entire file`,
			arguments: [textDocumentUri, diagnostic]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	codeActions.push(quickFixActionAllFile);
	codeActions.push(Object.assign(Object.assign({}, quickFixActionAllFile), { kind: CodeActionKind.QuickFix }));
	return codeActions;
}

function createIgnoreActions(diagnostic: Diagnostic, textDocumentUri: string): CodeAction[] {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in createIgnoreActions as there is no diagnostic set');
		return [];
	}
	const ignoreActions: CodeAction[] = [];
	let errorLabel = (diagnostic.code as string).split('-')[0].replace(/([A-Z])/g, ' $1').trim();

	if (diagnostic.severity === DiagnosticSeverity.Warning ||
		diagnostic.severity === DiagnosticSeverity.Error ||
		diagnostic.severity === DiagnosticSeverity.Information) {


		// NVUILLAMY: not working very well yet ... let's disable it for now
		/*		// Ignore only this error
				const suppressWarningAction: CodeAction = {
					title: `Ignore ${errorLabel}`,
					kind: CodeActionKind.QuickFix,
					command: {
						command: 'groovyLint.addSuppressWarning',
						title: `Ignore ${errorLabel}`,
						arguments: [diagnostic, textDocumentUri]
					},
					diagnostics: [diagnostic],
					isPreferred: false
				};
				suppressWarningActions.push(suppressWarningAction);
		
				// ignore this error type in all file
				const suppressWarningFileAction: CodeAction = {
					title: `Ignore ${errorLabel} in file`,
					kind: CodeActionKind.QuickFix,
					command: {
						command: 'groovyLint.addSuppressWarningFile',
						title: `Ignore ${errorLabel} in file`,
						arguments: [diagnostic, textDocumentUri]
					},
					diagnostics: [diagnostic],
					isPreferred: false
				};
				suppressWarningActions.push(suppressWarningFileAction); */

		// ignore this error type in all file
		const ignoreInWorkspaceAction: CodeAction = {
			title: `Disable ${errorLabel} in the entire workspace`,
			kind: CodeActionKind.QuickFix,
			command: {
				command: 'groovyLint.alwaysIgnoreError',
				title: `Disable ${errorLabel} in the entire workspace`,
				arguments: [textDocumentUri, diagnostic]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		ignoreActions.push(ignoreInWorkspaceAction);
	}
	return ignoreActions;
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
	const viewCodeAction: CodeAction = {
		title: `Show documentation for ${errorLabel}`,
		kind: CodeActionKind.QuickFix,
		command: {
			command: 'groovyLint.showRuleDocumentation',
			title: `Show documentation for ${errorLabel}`,
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
	if (docLinter.status === 0) {
		// Apply updates to textDocument
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, getUpdatedSource(docLinter, textDocument.getText()));
		docManager.validateTextDocument(textDocument);
	}
	// Just Notify client of end of linting 
	docManager.connection.sendNotification(StatusNotification.type, {
		state: 'lint.end',
		documents: [{
			documentUri: textDocument.uri
		}],
		lastFileName: textDocument.uri
	});
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
	docManager.validateTextDocument(textDocument);
}

// Add suppress warning
export async function addSuppressWarning(diagnostic: Diagnostic, textDocumentUri: string, scope: string, docManager: DocumentsManager) {
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in addSuppressWarning as there is no diagnostic set');
		return;
	}

	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	const allLines = docManager.getTextDocumentLines(textDocument);
	// Get line to check or create
	let linePos: number = 0;
	let removeAll = false;
	switch (scope) {
		case 'line': linePos = (diagnostic?.range?.start?.line) || 0; break;
		case 'file': linePos = 0; removeAll = true; break;
	}
	const line: string = allLines[linePos];
	const prevLine: string = allLines[(linePos === 0) ? 0 : linePos - 1] || '';
	const indent = " ".repeat(line.search(/\S/));
	const errorCode = (diagnostic.code as string).split('-')[0];
	// Create updated @SuppressWarnings line
	if (prevLine.includes('@SuppressWarnings')) {
		const alreadyExistingWarnings = prevLine.trimLeft().replace('@SuppressWarnings', '')
			.replace('(', '').replace(')', '')
			.replace('[', '').replace(']', '')
			.replace(/'/g, '').split(',');
		alreadyExistingWarnings.push(errorCode);
		alreadyExistingWarnings.sort();
		const suppressWarningLine = indent + `@SuppressWarnings(['${[...new Set(alreadyExistingWarnings)].join("','")}'])`;
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, suppressWarningLine, { replaceLinePos: (linePos === 0) ? 0 : linePos - 1 });
		docManager.removeDiagnostics([diagnostic], textDocument.uri, removeAll);
	}
	else {
		// Add new @SuppressWarnings line
		const suppressWarningLine = indent + `@SuppressWarnings(['${errorCode}'])`;
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, suppressWarningLine, { insertLinePos: linePos });
		docManager.removeDiagnostics([diagnostic], textDocument.uri, removeAll, linePos);
	}
}

// Add suppress warning
export async function alwaysIgnoreError(diagnostic: Diagnostic, textDocumentUri: string, docManager: DocumentsManager) {
	debug(`Request ignore error in all workspace from ${textDocumentUri}`);
	// Sometimes it comes there whereas it shouldn't ... let's avoid a crash
	if (diagnostic == null) {
		console.warn('Warning: we should not be in alwaysIgnoreError as there is no diagnostic set');
		return [];
	}
	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	// Get line to check or create
	const errorCode: string = (diagnostic.code as string).split('-')[0];
	debug(`Error code to be ignored is ${errorCode}`);
	// Get or create configuration file path using NpmGroovyLint instance associated to this document
	const docLinter = docManager.getDocLinter(textDocument.uri);
	const textDocumentFilePath: string = URI.parse(textDocument.uri).fsPath;
	const startPath = path.dirname(textDocumentFilePath);
	let configFilePath: string = await docLinter.getConfigFilePath(startPath);
	let configFileContent = JSON.parse(fse.readFileSync(configFilePath, "utf8").toString());
	if (configFilePath.endsWith(".groovylintrc-recommended.json")) {
		const workspaceFolder = docManager.getCurrentWorkspaceFolder();
		configFilePath = `${workspaceFolder}/.groovylintrc.json`;
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
		debug(`Error with window/showMessageRequest or Opening config file: ${e.message}`);
	}
}