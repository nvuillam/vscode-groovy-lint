import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	TextDocumentEdit,
	WorkspaceEdit,
	ShowMessageRequestParams,
	MessageType,
	ShowMessageRequest,
	TextEdit,
	Range,
} from 'vscode-languageserver';
import { DocumentsManager } from './DocumentsManager';
import { OpenNotification } from './types';
import Debug from "debug";
const debug = Debug("vscode-groovy-lint");

// RegExp to find and capture End Of Line (EOL) sequences.
export const eolCaptureRegExp: RegExp = new RegExp(/(\r?\n)/);

// RegExp to replace End Of Line (EOL) sequences.
export const eolReplaceRegExp: RegExp = new RegExp(/\r?\n/g);

// End of Line sequences.
export const dosEOL: string = '\r\n';
export const unixEOL: string = '\n';

const defaultDocUrl = "https://codenarc.github.io/CodeNarc/codenarc-rule-index.html";

// Apply updated source into the client TextDocument
export async function applyTextDocumentEditOnWorkspace(docManager: DocumentsManager, textDocument: TextDocument, textEdit: TextEdit) {
	const textDocEdit: TextDocumentEdit = TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [textEdit]);
	const applyWorkspaceEdits: WorkspaceEdit = {
		documentChanges: [textDocEdit]
	};
	const applyEditResult = await docManager.connection.workspace.applyEdit(applyWorkspaceEdits);
	debug(`Updated ${textDocument.uri} using WorkspaceEdit (${JSON.stringify(applyEditResult)})`);
}

/**
 * Create text edit to replace the whole file maintaining line endings.
 *
 * @param originalText the original text.
 * @param newText the new text.
 * @returns a TextEdit which replaces currentText with newText.
 */
export function createTextEditReplaceAll(originalText: string, newText: string): TextEdit {
	const [eol, lines]: [string, string[]] = eolAndLines(originalText);

	// Pop is faster than indexed access and also avoids having to check the index going negative.
	const lastLine: string = lines.pop() || "";
	const range: Range = Range.create(0, 0, lines.length, lastLine.length);
	return TextEdit.replace(range, newText.replace(eolReplaceRegExp, eol));
}

/**
 * Returns the predominant end of line sequence and lines of a string.
 *
 * @param text the string to process.
 * @returns the predominant end of line sequence and the lines.
 */
export function eolAndLines(text: string): [string, string[]] {
	const parts: string[] = text.split(eolCaptureRegExp);
	let dos: number = 0;
	let unix: number = 0;
	const lines: string[] = [];
	parts.forEach(val => {
		switch (val) {
			case dosEOL:
				dos++;
				break;
			case unixEOL:
				unix++;
				break;
			default:
				lines.push(val);
				break;
		}
	});

	return [unix > dos ? unixEOL : dosEOL, lines];
}

// Return updated source
export function getUpdatedSource(docLinter: any, prevSource: string) {
	if (docLinter?.lintResult?.files && docLinter.lintResult.files[0]) {
		return docLinter.lintResult.files[0].updatedSource;
	}

	return prevSource;
}

// Shows the documentation of a rule
export async function showRuleDocumentation(ruleCode: string, docManager: DocumentsManager): Promise<void> {
	debug(`Request showRuleDocumentation on ${ruleCode}`);
	const ruleDesc = docManager.getRuleDescription(ruleCode);
	// Show documentation as info message, and propose to open codenarc website rule page
	const readMoreLabel = 'Read More';
	const msg: ShowMessageRequestParams = {
		type: MessageType.Info,
		message: `${ruleCode}: ${ruleDesc.description}`,
		actions: [
			{ title: readMoreLabel }
		]
	};
	const res = await docManager.connection.sendRequest(ShowMessageRequest.type, msg);
	if (res.title === readMoreLabel) {
		docManager.connection.sendNotification(OpenNotification.type, { url: ruleDesc.docUrl || defaultDocUrl });
	}
}

// Display failed fixes if returned
export async function notifyFixFailures(fixFailures: any[], docManager: DocumentsManager): Promise<void> {
	if (fixFailures.length === 0 || docManager.ignoreNotifyFixError === true) {
		return;
	}
	const failedErrorTypes = Array.from(new Set(fixFailures.map(failedFixErr => failedFixErr.rule)));
	failedErrorTypes.sort();
	debug(`Notify fix failures of errors: ${failedErrorTypes.join(',')}`);
	const doNotDisplayAgain = 'Do not display again';
	const dismiss = 'Dismiss';
	const msg: ShowMessageRequestParams = {
		type: MessageType.Warning,
		message: `Some error fixes have failed, please fix them manually: ${failedErrorTypes.join(',')}`,
		actions: [
			{ title: dismiss },
			{ title: doNotDisplayAgain }
		]
	};
	docManager.connection.sendRequest(ShowMessageRequest.type, msg).then((res: any) => {
		if (res && res.title === doNotDisplayAgain) {
			docManager.ignoreNotifyFixError = true;
		}
	});
}

// Check if we are in test mode
export function isTest() {
	return (process.env.npm_lifecycle_event && process.env.npm_lifecycle_event === 'test') ||
		(process.env.AUTO_ACCEPT_REPLACE_TABS && process.env.AUTO_ACCEPT_REPLACE_TABS === 'activated');
}
