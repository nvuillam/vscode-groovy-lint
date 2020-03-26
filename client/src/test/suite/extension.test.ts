import * as assert from 'assert';
import * as path from "path";
import * as vscode from 'vscode';
import { TextEdit } from 'vscode-languageclient';
const debug = require("debug")("vscode-groovy-lint");
const { performance } = require('perf_hooks');

const testFolderExamplesLocation = '/../../../src/test/examples/';

const extensionId = 'NicolasVuillamy.vscode-groovy-lint';
const numberOfCommands = 7;
const numberOfDiagnosticsForTinyGroovyLint = 46;

const numberOfDiagnosticsForBigGroovyLint = 1725;
const numberOfDiagnosticsForBigGroovyLintFix = 23;

let bigDocument: any;
let tinyDocument: any;

suite('VsCode GroovyLint Test Suite', async () => {
	vscode.window.showInformationMessage('Start all VsCode Groovy Lint tests');

	// Check extension is available
	test("1.0 GroovyLint extension is available", async () => {
		bigDocument = await openDocument('bigGroovy');
		const availableExtensions = vscode.extensions.all.map(ext => ext.id);
		debug('Available extensions: ' + JSON.stringify(availableExtensions));

		assert(availableExtensions.includes(extensionId), "GroovyLint extension found");
	}).timeout(10000);

	// Check all commands are here
	test("1.1 Check GroovyLint VsCode commands", async () => {
		const allCommands = await vscode.commands.getCommands();
		debug('Commands found: ' + JSON.stringify(allCommands));
		const groovyLintCommands = allCommands.filter((command) => {
			return command.startsWith('groovyLint');
		});

		assert(groovyLintCommands.length === numberOfCommands, `${numberOfCommands} GroovyLint commands found`);
	}).timeout(5000);

	// Lint document
	test("2.0 Lint big document", async () => {
		await vscode.window.showTextDocument(bigDocument);
		await vscode.commands.executeCommand('groovyLint.lint');
		await waitUntil(() => diagnosticsReceived(bigDocument.uri), 'sync', 120000);
		const docDiagnostics = vscode.languages.getDiagnostics(bigDocument.uri);

		assert(docDiagnostics.length === numberOfDiagnosticsForBigGroovyLint, `${numberOfDiagnosticsForBigGroovyLint} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(180000);

	// Format document without updating diagnostics
	test("2.1. Format big document", async () => {
		await vscode.window.showTextDocument(bigDocument);
		const textBefore = getActiveEditorText();
		const textEdits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', bigDocument.uri, {});
		await applyTextEditsOnDoc(bigDocument.uri, textEdits as vscode.TextEdit[]);
		await waitUntil(() => documentHasBeenUpdated(bigDocument.uri, textBefore), 'async', 120000);
		await sleepPromise(2000);
		await waitUntil(() => diagnosticsReceived(bigDocument.uri), 'sync', 60000); // Wait for linter to lint again after fix
		const textAfter = getActiveEditorText();
		assert(textBefore !== textAfter, 'TextDocument text must be updated after format');
	}).timeout(180000);

	// Fix document
	test("2.2. Fix big document", async () => {
		await vscode.window.showTextDocument(bigDocument);
		const textBefore = getActiveEditorText();
		await vscode.commands.executeCommand('groovyLint.lintFix');
		await waitUntil(() => documentHasBeenUpdated(bigDocument.uri, textBefore), 'async', 120000);
		await sleepPromise(2000);
		await waitUntil(() => diagnosticsReceived(bigDocument.uri), 'sync', 80000); // Wait for linter to lint again after fix
		const docDiagnostics = vscode.languages.getDiagnostics(bigDocument.uri);
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after fix');
		assert(docDiagnostics.length === numberOfDiagnosticsForBigGroovyLintFix, `${numberOfDiagnosticsForBigGroovyLintFix} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(180000);

	// Lint tiny document
	test("3.0 Lint tiny document", async () => {
		tinyDocument = await openDocument('tinyGroovy');
		await vscode.commands.executeCommand('groovyLint.lint');
		await waitUntil(() => diagnosticsReceived(tinyDocument.uri), 'sync', 100000);
		const docDiagnostics = vscode.languages.getDiagnostics(tinyDocument.uri);

		assert(docDiagnostics.length === numberOfDiagnosticsForTinyGroovyLint, `${numberOfDiagnosticsForTinyGroovyLint} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(180000);

	// Format tiny document
	test("3.1. Format tiny document", async () => {
		await vscode.window.showTextDocument(tinyDocument);
		const textBefore = getActiveEditorText();
		const textEdits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', tinyDocument.uri, {});
		console.debug('Returned textEdits: ' + JSON.stringify(textEdits));
		await applyTextEditsOnDoc(tinyDocument.uri, textEdits as vscode.TextEdit[]);
		await waitUntil(() => documentHasBeenUpdated(tinyDocument.uri, textBefore), 'async', 100000);
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after format');
	}).timeout(180000);
});

async function openDocument(docExample: string) {
	const docName = (docExample === 'bigGroovy') ? 'bigGroovy.groovy' :
		(docExample === 'tinyGroovy') ? 'tinyGroovy.groovy' : '';
	const docUri = vscode.Uri.file(
		path.join(__dirname + testFolderExamplesLocation + docName)
	);
	const document: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(document);
	await waitUntil(groovyLintExtensionIsActive, 'async', 20000) === true;
	return document;
}

function getActiveEditorText() {
	return vscode.window.activeTextEditor.document.getText();
}

function getDocument(docUri: vscode.Uri) {
	const doc = vscode.workspace.textDocuments.filter(docX => docX.uri === docUri);
	assert(doc && doc.length > 0, `Document ${docUri} should be found`);
	return doc[0];
}

async function applyTextEditsOnDoc(docUri: vscode.Uri, textEdits: vscode.TextEdit[]) {
	const workspaceEdit = new vscode.WorkspaceEdit();
	workspaceEdit.set(docUri, textEdits);
	const applyRes = await vscode.workspace.applyEdit(workspaceEdit);
	assert(applyRes === true, 'Edits have been applied. Err: applyRes=' + applyRes);
	return applyRes;
}

async function waitUntil(test: Function, mode = 'sync', timeout_ms = 20 * 1000): Promise<boolean> {
	return new Promise(async (resolve, reject) => {
		let start = performance.now();
		let freq = 300;
		let result;
		// wait until the result is truthy, or timeout
		while (result === undefined || result === false || result === null || result.length === 0) {  // for non arrays, length is undefined, so != 0
			if ((performance.now() - start) > timeout_ms) {
				console.error('Timeout : ' + test);
				reject(false);
				return;
			}
			await sleepPromise(freq);
			if (mode === 'async') {
				result = await test();
			}
			else {
				result = test();
			}
		}
		// return result if test passed
		resolve(result);
	});
}

function diagnosticsReceived(docUri: vscode.Uri): boolean {
	const docDiags = vscode.languages.getDiagnostics(docUri);
	return docDiags && docDiags.length > 0;
}

/*
function diagnosticsChanged(docUri: vscode.Uri): Promise<boolean> {
	return new Promise(async (resolve, reject) => {
		let diagsChanged = false;
		const disposable = vscode.languages.onDidChangeDiagnostics((e: vscode.DiagnosticChangeEvent) => {
			if (e.uris.filter(uriX => uriX.toString() === docUri.toString()).length > 0) {
				diagsChanged = true;
				console.log('Diagnostics changed for' + docUri);
			}
		});
		await sleepPromise(500);
		disposable.dispose();
		resolve(diagsChanged);
	});
}*/

async function groovyLintExtensionIsActive() {
	const allCommands = await vscode.commands.getCommands(true);
	return allCommands.includes('groovyLint.lint');
}

function documentHasBeenUpdated(docUri: vscode.Uri, prevDocSource: string): Promise<boolean> {
	const doc = getDocument(docUri);
	return Promise.resolve(doc.getText() !== prevDocSource);
}

async function sleepPromise(ms: number) {
	await new Promise(r => setTimeout(r, ms));
}