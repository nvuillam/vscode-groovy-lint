import {
	CodeAction,
	CodeActionParams,
	DiagnosticSeverity,
	CodeActionKind,
	TextDocument,
	Diagnostic,
	MessageType,
	ShowMessageRequestParams,
	NotificationType
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { isNullOrUndefined } from "util";
import * as fse from "fs-extra";
import { DocumentsManager } from './DocumentsManager';
import { applyTextDocumentEditOnWorkspace, getUpdatedSource } from './clientUtils';
import { parseLinterResultsIntoDiagnostics } from './linter';
import path = require('path');
const debug = require("debug")("vscode-groovy-lint");

const lintAgainAfterQuickFix: boolean = true; // Lint after fix is performed by npm-groovy-lint fixer

// Status notifications
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

/**
 * Provide quickfixes for a piece of code  *
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} parms
 * @returns {CodeAction[]}
 */
export function provideQuickFixCodeActions(textDocument: TextDocument, codeActionParams: CodeActionParams, docQuickFixes: any): CodeAction[] {
	const diagnostics = codeActionParams.context.diagnostics;
	if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
		return [];
	}
	const quickFixCodeActions: CodeAction[] = [];
	for (const diagnostic of codeActionParams.context.diagnostics) {
		// Get corresponding QuickFix if existing and convert it as QuickAction
		const diagCode: string = diagnostic.code + '';
		if (docQuickFixes && docQuickFixes[diagCode]) {
			for (const quickFix of docQuickFixes[diagCode]) {
				const codeActions = createQuickFixCodeActions(diagnostic, quickFix, textDocument.uri);
				quickFixCodeActions.push(...codeActions);
			}
		}
		// Add @SuppressWarnings('ErrorCode') for this error
		const suppressWarningActions = createQuickFixSuppressWarningActions(diagnostic, textDocument.uri);
		quickFixCodeActions.push(...suppressWarningActions);
	}
	debug(`Provided ${quickFixCodeActions.length} codeActions for ${textDocument.uri}`);
	return quickFixCodeActions;

}

// Create QuickFix codeActions for diagnostic
function createQuickFixCodeActions(diagnostic: Diagnostic, quickFix: any, textDocumentUri: string): CodeAction[] {
	const codeActions: CodeAction[] = [];

	// Quick fix only this error
	const quickFixAction: CodeAction = {
		title: 'Fix: ' + quickFix.label,
		kind: CodeActionKind.QuickFix,
		command: {
			command: 'groovyLint.quickFix',
			title: 'Fix: ' + quickFix.label,
			arguments: [diagnostic, textDocumentUri]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	codeActions.push(quickFixAction);

	// Quick fix error in file
	const quickFixActionAllFile: CodeAction = {
		title: 'Fix: ' + quickFix.label + ' in file',
		kind: CodeActionKind.QuickFix,
		command: {
			command: 'groovyLint.quickFixFile',
			title: 'Fix: ' + quickFix.label + ' in file',
			arguments: [diagnostic, textDocumentUri]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	codeActions.push(quickFixActionAllFile);

	return codeActions;
}

function createQuickFixSuppressWarningActions(diagnostic: Diagnostic, textDocumentUri: string) {
	const suppressWarningActions: CodeAction[] = [];
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
		const suppressWarningAlwaysAction: CodeAction = {
			title: `Ignore ${errorLabel} in all files`,
			kind: CodeActionKind.QuickFix,
			command: {
				command: 'groovyLint.alwaysIgnoreError',
				title: `Ignore ${errorLabel} in all files`,
				arguments: [diagnostic, textDocumentUri]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		suppressWarningActions.push(suppressWarningAlwaysAction);
	}
	return suppressWarningActions;
}

// Apply quick fixes
export async function applyQuickFixes(diagnostics: Diagnostic[], textDocumentUri: string, docManager: DocumentsManager) {
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
	await docLinter.fixErrors(errorIds);
	if (docLinter.status === 0) {
		// Apply updates to textDocument
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, getUpdatedSource(docLinter, textDocument.getText()));

		if (lintAgainAfterQuickFix === true) {
			await docManager.validateTextDocument(textDocument);
		}
		else {
			// NV: Faster but experimental... does not work that much so let's lint again after a fix
			const diagnostics: Diagnostic[] = parseLinterResultsIntoDiagnostics(docLinter.lintResult,
				getUpdatedSource(docLinter, textDocument.getText()),
				textDocument, docManager);
			// Send diagnostics to client
			await docManager.updateDiagnostics(textDocument.uri, diagnostics);
		}
	}
	// Just Notify client of end of linting 
	docManager.connection.sendNotification(StatusNotification.type, {
		state: 'lint.end',
		documents: [{
			documentUri: textDocument.uri
		}],
		lastFileName: textDocument.uri
	});
}

// Quick fix in the whole file
export async function applyQuickFixesInFile(diagnostics: Diagnostic[], textDocumentUri: string, docManager: DocumentsManager) {
	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	const fixRules = (diagnostics[0].code as string).split('-')[0];
	debug(`Request apply QuickFixes in file for all ${fixRules} error in ${textDocumentUri}`);
	await docManager.validateTextDocument(textDocument, { fix: true, fixrules: fixRules });
}

// Add suppress warning
export async function addSuppressWarning(diagnostic: Diagnostic, textDocumentUri: string, scope: string, docManager: DocumentsManager) {
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
	const textDocument: TextDocument = docManager.getDocumentFromUri(textDocumentUri);
	// Get line to check or create
	const errorCode: string = (diagnostic.code as string).split('-')[0];

	// Get or create configuration file path using NpmGroovyLint instance associated to this document
	const docLinter = docManager.getDocLinter(textDocument.uri);
	const textDocumentFilePath: string = URI.parse(textDocument.uri).fsPath;
	const startPath = path.dirname(textDocumentFilePath);
	let configFilePath: string = await docLinter.getConfigFilePath(startPath);
	let configFileContent = JSON.parse(fse.readFileSync(configFilePath, "utf8").toString());
	if (configFilePath.endsWith(".groovylintrc-recommended.json")) {
		configFilePath = process.cwd() + '/.groovylintrc.json';
		configFileContent = { extends: "recommended", rules: {} };
	}
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
			await docManager.connection.sendNotification('vscode-groovy-lint/openDocument', { file: configFilePath });
		}
	} catch (e) {
		debug(`Error with window/showMessageRequest or Opening config file: ${e.message}`);
	}
}