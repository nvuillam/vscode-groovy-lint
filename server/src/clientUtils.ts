import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { TextDocumentEdit, WorkspaceEdit, ShowMessageRequestParams, MessageType, ShowMessageParams, ShowMessageRequest } from 'vscode-languageserver';
import { DocumentsManager } from './DocumentsManager';
import { OpenNotification } from './types';
const debug = require("debug")("vscode-groovy-lint");
import os = require("os");

const defaultDocUrl = "https://codenarc.github.io/CodeNarc/codenarc-rule-index.html";

// Apply updated source into the client TextDocument
export async function applyTextDocumentEditOnWorkspace(docManager: DocumentsManager, textDocument: TextDocument, updatedSource: string, where: any = {}) {
	textDocument = docManager.getUpToDateTextDocument(textDocument);
	const textDocEdit: TextDocumentEdit = createTextDocumentEdit(docManager, textDocument, updatedSource, where);
	const applyWorkspaceEdits: WorkspaceEdit = {
		documentChanges: [textDocEdit]
	};
	const applyEditResult = await docManager.connection.workspace.applyEdit(applyWorkspaceEdits);
	debug(`Updated ${textDocument.uri} using WorkspaceEdit (${JSON.stringify(applyEditResult)})`);
}

// Create a TextDocumentEdit that will be applied on client workspace
export function createTextDocumentEdit(docManager: DocumentsManager, textDocument: TextDocument, updatedSource: string, where: any = {}): TextDocumentEdit {
	const textEdit: TextEdit = createTextEdit(docManager, textDocument, updatedSource, where);
	const textDocEdit: TextDocumentEdit = TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [textEdit]);
	return textDocEdit;
}

// Create text edit for the whole file from updated source
export function createTextEdit(docManager: DocumentsManager, textDocument: TextDocument, updatedSource: string, where: any = {}): TextEdit {
	const allLines = docManager.getTextDocumentLines(textDocument);
	// If range is not sent, replace all file lines
	let textEdit: TextEdit;
	// Insert at position
	if (where.insertLinePos || where.insertLinePos === 0) {
		allLines.splice(where.insertLinePos, 0, updatedSource);
		textEdit = {
			range: {
				start: { line: 0, character: 0 },
				end: { line: allLines.length - 1, character: allLines[allLines.length - 1].length }
			},
			newText: allLines.join(os.EOL)
		};
	}
	// Replace line at position
	else if (where.replaceLinePos || where.replaceLinePos === 0) {
		textEdit = {
			range: {
				start: { line: where.replaceLinePos, character: 0 },
				end: { line: where.replaceLinePos, character: allLines[where.replaceLinePos].length }
			},
			newText: updatedSource
		};
	}
	// Replace all source
	else if (!where?.range) {
		textEdit = {
			range: {
				start: { line: 0, character: 0 },
				end: { line: allLines.length - 1, character: allLines[allLines.length - 1].length }
			},
			newText: updatedSource
		};
	}
	// Provided range
	else {
		textEdit = {
			range: where.range,
			newText: updatedSource
		};
	}
	return textEdit;
}

// Return updated source
export function getUpdatedSource(docLinter: any, prevSource: string) {
	if (docLinter && docLinter.lintResult && docLinter.lintResult.files && docLinter.lintResult.files[0]) {
		return docLinter.lintResult.files[0].updatedSource;
	}
	else {
		return prevSource;
	}
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
		if (res.title === doNotDisplayAgain) {
			docManager.ignoreNotifyFixError = true;
		}
	});
}

// Check if we are in test mode
export function isTest() {
	return (process.env.npm_lifecycle_event && process.env.npm_lifecycle_event === 'test') ||
		(process.env.AUTO_ACCEPT_REPLACE_TABS && process.env.AUTO_ACCEPT_REPLACE_TABS === 'activated');
}
