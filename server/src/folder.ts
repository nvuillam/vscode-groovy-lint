import { DocumentsManager } from './DocumentsManager';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as fse from "fs-extra";
import * as path from "path";
import { ShowMessageRequestParams, MessageType } from 'vscode-languageserver';

const debug = require("debug")("vscode-groovy-lint");
const glob = require("glob-promise");

const timeToDisplayWaitingMessageMs = 5000;

export async function lintFolder(folders: Array<any>, docManager: DocumentsManager) {

	let isLinting = true;
	let continueLinting = true;

	// Function to lint all applicable files of a folder
	async function processLintFolder() {
		const folderList = folders.map(folder => folder.path);
		debug(`Start analyzing folder(s): ${folderList.join(',')}`);
		// Browse each folder
		for (const folder of folderList) {
			// List applicable files of folder
			const pathFilesPatternGroovy = path.join(folder, '/**/*.groovy');
			const pathFilesPatternJenkins = path.join(folder, '/**/Jenkins*');
			const files = [];
			for (const pathFilesPattern of [pathFilesPatternGroovy, pathFilesPatternJenkins]) {
				const pathFiles = await glob(pathFilesPattern);
				files.push(...pathFiles);
			}
			// Trigger a lint for each of the found documents
			for (const file of files) {
				const docUri = URI.file(file).toString();
				let textDocument: TextDocument = docManager.getDocumentFromUri(docUri, false, false);
				// eslint-disable-next-line eqeqeq
				if (textDocument == null) {
					const content = await fse.readFile(file, "utf8");
					textDocument = TextDocument.create(docUri, 'groovy', 1, content.toString());
				}
				// Lint one doc after another , to do not busy too much the processor
				if (continueLinting === true) {
					await docManager.validateTextDocument(textDocument, { displayErrorsEvenIfDocumentClosed: true });
				}
			}
		}
		debug(`Completed analyzing folder(s): ${folderList.join(',')}`);
		isLinting = false;
	}

	// Request lint folders
	const lintFoldersPromise = processLintFolder();

	// Wait some seconds: if the lint is still processing, display an info message
	setTimeout(async () => {
		if (isLinting === true) {
			const msg: ShowMessageRequestParams = {
				type: MessageType.Info,
				message: `'Analyzing all files of a folder can be long, please be patient :)'`,
				actions: [
					{ title: "Ok, keep going" },
					{ title: "Cancel analysis of folder files" }
				]
			};
			const req = await docManager.connection.sendRequest('window/showMessageRequest', msg);
			if (req?.title === "Cancel lint of folders") {
				continueLinting = false;
			}
		}
	}, timeToDisplayWaitingMessageMs);

	// Await folders are linted
	await lintFoldersPromise;
}

