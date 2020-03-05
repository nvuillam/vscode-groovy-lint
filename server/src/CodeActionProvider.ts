import { CodeAction, CodeActionParams, DiagnosticSeverity, CodeActionKind, TextDocument, Diagnostic } from 'vscode-languageserver';
import { isNullOrUndefined } from "util";

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
			arguments: [diagnostic, quickFix.errId, textDocumentUri]
		},
		diagnostics: [diagnostic],
		isPreferred: true
	};
	return action;
}

function createQuickFixSuppressWarningActions(diagnostic: Diagnostic, textDocumentUri: string) {
	const errorCode = (diagnostic.code as string).split('-')[0];
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
	return [suppressWarningAction, suppressWarningFileAction];
}