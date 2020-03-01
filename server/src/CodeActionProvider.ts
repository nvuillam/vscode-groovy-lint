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
				const codeAction = createCommandCodeAction(diagnostic, quickFix);
				codeActions.push(codeAction);
			}
		}
	}
	return codeActions;
}

function createCommandCodeAction(diagnostic: Diagnostic, quickFix: any): CodeAction {
	const action: CodeAction = {
		title: quickFix.label,
		kind: CodeActionKind.QuickFix
	};
	action.command = {
		command: 'groovyLint.quickFix',
		title: quickFix.label,
		arguments: [quickFix.errId]
	};
	action.diagnostics = [diagnostic];
	action.isPreferred = true;
	return action;
}