import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { TextDocumentEdit, WorkspaceEdit } from 'vscode-languageserver';
import { DocumentsManager } from './DocumentsManager';

// Apply updated source into the client TextDocument
export async function applyTextDocumentEditOnWorkspace(docManager: DocumentsManager, textDocument: TextDocument, updatedSource: string, where: any = {}) {
	textDocument = docManager.getUpToDateTextDocument(textDocument);
	const textDocEdit: TextDocumentEdit = createTextDocumentEdit(docManager, textDocument, updatedSource, where);
	const applyWorkspaceEdits: WorkspaceEdit = {
		documentChanges: [textDocEdit]
	};
	const applyEditResult = await docManager.connection.workspace.applyEdit(applyWorkspaceEdits);
	console.debug(`Updated ${textDocument.uri} using WorkspaceEdit (${JSON.stringify(applyEditResult)})`);
}

// Create a TextDocumentEdit that will be applied on client workspace
export function createTextDocumentEdit(docManager: DocumentsManager, textDocument: TextDocument, updatedSource: string, where: any = {}): TextDocumentEdit {
	const textEdit: TextEdit = createTestEdit(docManager, textDocument, updatedSource, where);
	const textDocEdit: TextDocumentEdit = TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [textEdit]);
	return textDocEdit;
}

export function createTestEdit(docManager: DocumentsManager, textDocument: TextDocument, updatedSource: string, where: any = {}): TextEdit {
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
			newText: allLines.join('\r\n')
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

// Check if we are in test mode
export function isTest() {
	return (process.env.npm_lifecycle_event && process.env.npm_lifecycle_event === 'test') ||
		(process.env.NYC_COVERAGE && process.env.NYC_COVERAGE === 'activated');
}
