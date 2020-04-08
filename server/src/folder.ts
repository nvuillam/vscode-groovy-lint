import { DocumentsManager } from './DocumentsManager';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as fse from "fs-extra";
import * as path from "path";

const debug = require("debug")("vscode-groovy-lint");
const glob = require("glob-promise");

// Lint all applicable files of a folder
export async function lintFolder(folders: Array<any>, docManager: DocumentsManager) {
	const folderList = folders.map(fldr => fldr.fsPath);
	debug(`Start linting folder(s) ${folderList.join(',')}`);
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
			let textDocument: TextDocument = docManager.getDocumentFromUri(docUri);
			// eslint-disable-next-line eqeqeq
			if (textDocument == null) {
				const content = await fse.readFile(file, "utf8");
				textDocument = TextDocument.create(docUri, 'groovy', 1, content.toString());
			}
			docManager.validateTextDocument(textDocument, { showDocumentIfErrors: true });
		}
	}
}