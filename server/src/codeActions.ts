import { CodeAction, CodeActionParams, DiagnosticSeverity, CodeActionKind, TextDocument, Diagnostic } from 'vscode-languageserver';
import { isNullOrUndefined } from "util";
import { DocumentsManager } from './DocumentsManager';
import { applyTextDocumentEditOnWorkspace } from './clientUtils';
import { parseLinterResultsIntoDiagnostics } from './linter';

/**
 * Provide quickfix  *
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
	const codeActions: CodeAction[] = [];
	for (const diagnostic of codeActionParams.context.diagnostics) {
		// Get corresponding QuickFix if existing and convert it as QuickAction
		const diagCode: string = diagnostic.code + '';
		if (docQuickFixes && docQuickFixes[diagCode]) {
			for (const quickFix of docQuickFixes[diagCode]) {
				const codeAction = createQuickFixCodeAction(diagnostic, quickFix, textDocument.uri);
				codeActions.push(codeAction);
			}
		}
		// Add @SuppressWarnings('ErrorCode') for this error
		const suppressWarningActions = createQuickFixSuppressWarningActions(diagnostic, textDocument.uri);
		codeActions.push(...suppressWarningActions);
	}
	return codeActions;

}

function createQuickFixCodeAction(diagnostic: Diagnostic, quickFix: any, textDocumentUri: string): CodeAction {
	const action: CodeAction = {
		title: quickFix.label,
		kind: CodeActionKind.QuickFix,
		command: {
			command: 'groovyLint.quickFix',
			title: quickFix.label,
			arguments: [diagnostic, textDocumentUri]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	return action;
}

function createQuickFixSuppressWarningActions(diagnostic: Diagnostic, textDocumentUri: string) {
	const suppressWarningActions: CodeAction[] = [];
	const errorCode = (diagnostic.code as string).split('-')[0];
	if (diagnostic.severity === DiagnosticSeverity.Warning ||
		diagnostic.severity === DiagnosticSeverity.Error ||
		diagnostic.severity === DiagnosticSeverity.Information) {

		// Ignore only this error
		const suppressWarningAction: CodeAction = {
			title: `Ignore ${errorCode}`,
			kind: CodeActionKind.QuickFix,
			command: {
				command: 'groovyLint.addSuppressWarning',
				title: `Ignore ${errorCode}`,
				arguments: [diagnostic, textDocumentUri]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		suppressWarningActions.push(suppressWarningAction);

		// ignore this error type in all file
		const suppressWarningFileAction: CodeAction = {
			title: `Ignore ${errorCode} in all file`,
			kind: CodeActionKind.QuickFix,
			command: {
				command: 'groovyLint.addSuppressWarningFile',
				title: `Ignore ${errorCode} in all file`,
				arguments: [diagnostic, textDocumentUri]
			},
			diagnostics: [diagnostic],
			isPreferred: false
		};
		suppressWarningActions.push(suppressWarningFileAction);
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
	const docLinter = docManager.getDocLinter(textDocument.uri);
	await docLinter.fixErrors(errorIds);
	if (docLinter.status === 0) {
		await applyTextDocumentEditOnWorkspace(docManager, textDocument, docLinter.lintResult.files[0].updatedSource);
		const diagnostics: Diagnostic[] = parseLinterResultsIntoDiagnostics(docLinter.lintResults,
			docLinter.lintResult.files[0].updatedSource, textDocument, docManager);
		// Send diagnostics to client
		docManager.updateDiagnostics(textDocument.uri, diagnostics);
	}
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