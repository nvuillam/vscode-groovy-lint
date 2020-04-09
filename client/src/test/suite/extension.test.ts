import * as assert from 'assert';
import * as path from "path";
import * as vscode from 'vscode';
//import { TextEdit } from 'vscode-languageclient';
const debug = require("debug")("vscode-groovy-lint");
const { performance } = require('perf_hooks');

// Constants
const testFolderExamplesLocation = '/../../../src/test/examples/';
const extensionId = 'NicolasVuillamy.vscode-groovy-lint';

// Test documents
const testDocs: any = {
	'tinyGroovy': {
		path: 'tinyGroovy.groovy',
		doc: null
	},
	'bigGroovy': {
		path: 'bigGroovy.groovy',
		doc: null
	},
	'Jenkinsfile': {
		path: 'Jenkinsfile',
		doc: null
	}
};

// Results to check
const numberOfGroovyLintCommands = 9;

const numberOfDiagnosticsForBigGroovyLint = 4361;
const numberOfDiagnosticsForBigGroovyLintFix = 683;

const numberOfDiagnosticsForTinyGroovyLint = 39;
const numberOfDiagnosticsForTinyGroovyLintFix = 20;

const numberOfDiagnosticsForJenkinsfileLint = 203;
const numberOfDiagnosticsForJenkinsfileLintFix = 202;

suite('VsCode GroovyLint Test Suite', async () => {
	vscode.window.showInformationMessage('Start all VsCode Groovy Lint tests');

	// Check extension is available
	test("1.0 GroovyLint extension is available", async () => {
		console.log("Start 1.0 GroovyLint extension is available");
		testDocs['bigGroovy'].doc = await openDocument('bigGroovy');
		console.log(JSON.stringify(testDocs, null, 2));
		const availableExtensions = vscode.extensions.all.map(ext => ext.id);
		debug('Available extensions: ' + JSON.stringify(availableExtensions));

		assert(availableExtensions.includes(extensionId), "GroovyLint extension found");
	}).timeout(10000);

	// Check all commands are here
	test("1.1 Check GroovyLint VsCode commands", async () => {
		console.log("Start 1.1 Check GroovyLint VsCode commands");
		const allCommands = await vscode.commands.getCommands();
		debug('Commands found: ' + JSON.stringify(allCommands));
		const groovyLintCommands = allCommands.filter((command) => {
			return command.startsWith('groovyLint');
		});
		assert(groovyLintCommands.length === numberOfGroovyLintCommands, `${numberOfGroovyLintCommands} GroovyLint commands found (returned ${groovyLintCommands.length})`);
	}).timeout(5000);

	// Lint document
	test("2.0 Lint big document", async () => {
		console.log("Start 2.0 Lint big document");
		await waitUntil(() => diagnosticsChanged(testDocs['bigGroovy'].doc.uri, []), 100000);
		const docDiagnostics = vscode.languages.getDiagnostics(testDocs['bigGroovy'].doc.uri);

		assert(docDiagnostics.length === numberOfDiagnosticsForBigGroovyLint, `${numberOfDiagnosticsForBigGroovyLint} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(120000);

	// Format document without updating diagnostics
	test("2.1. Format big document", async () => {
		console.log("Start 2.1. Format big document");
		const textBefore = getActiveEditorText();
		const prevDiags = vscode.languages.getDiagnostics(testDocs['bigGroovy'].doc.uri);
		const textEdits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', testDocs['bigGroovy'].doc.uri, {});
		await applyTextEditsOnDoc(testDocs['bigGroovy'].doc.uri, textEdits as vscode.TextEdit[]);
		await waitUntil(() => diagnosticsChanged(testDocs['bigGroovy'].doc.uri, prevDiags), 100000); // Wait for linter to lint again after fix
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after format');
	}).timeout(120000);

	// Fix document
	test("2.2. Fix big document", async () => {
		console.log("Start 2.2. Fix big document");
		const textBefore = getActiveEditorText();
		const prevDiags = vscode.languages.getDiagnostics(testDocs['bigGroovy'].doc.uri);
		vscode.commands.executeCommand('groovyLint.lintFix');
		await waitUntil(() => documentHasBeenUpdated(testDocs['bigGroovy'].doc.uri, textBefore), 100000);
		await waitUntil(() => diagnosticsChanged(testDocs['bigGroovy'].doc.uri, []), 100000);
		const docDiagnostics = vscode.languages.getDiagnostics(testDocs['bigGroovy'].doc.uri);
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after fix');
		assert(docDiagnostics.length === numberOfDiagnosticsForBigGroovyLintFix, `${numberOfDiagnosticsForBigGroovyLintFix} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(200000);

	// Lint tiny document
	test("3.0 Lint tiny document", async () => {
		console.log("Start 3.0 Lint tiny document");
		testDocs['tinyGroovy'].doc = await openDocument('tinyGroovy');
		await waitUntil(() => diagnosticsChanged(testDocs['tinyGroovy'].doc.uri, []), 60000);
		const docDiagnostics = vscode.languages.getDiagnostics(testDocs['tinyGroovy'].doc.uri);

		assert(docDiagnostics.length === numberOfDiagnosticsForTinyGroovyLint, `${numberOfDiagnosticsForTinyGroovyLint} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(60000);

	// Format tiny document
	test("3.1. Format tiny document", async () => {
		console.log("Start 3.1. Format tiny document");
		const textBefore = getActiveEditorText();
		const textEdits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', testDocs['tinyGroovy'].doc.uri, {});
		await applyTextEditsOnDoc(testDocs['tinyGroovy'].doc.uri, textEdits as vscode.TextEdit[]);
		await sleepPromise(5000);
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after format');
	}).timeout(30000);

	// Fix document
	test("3.2. Fix tiny document", async () => {
		console.log("Start 3.2. Fix tiny document");
		const textBefore = getActiveEditorText();
		const prevDiags = vscode.languages.getDiagnostics(testDocs['tinyGroovy'].doc.uri);
		vscode.commands.executeCommand('groovyLint.lintFix');
		await waitUntil(() => documentHasBeenUpdated(testDocs['tinyGroovy'].doc.uri, textBefore), 60000);
		await waitUntil(() => diagnosticsChanged(testDocs['tinyGroovy'].doc.uri, prevDiags), 60000);
		const docDiagnostics = vscode.languages.getDiagnostics(testDocs['tinyGroovy'].doc.uri);
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after fix');
		assert(docDiagnostics.length === numberOfDiagnosticsForTinyGroovyLintFix, `${numberOfDiagnosticsForTinyGroovyLintFix} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(60000);

	// Lint Jenkinsfile
	test("4.0 Lint Jenkinsfile", async () => {
		console.log("Start 4.0 Lint Jenkinsfile");
		testDocs['Jenkinsfile'].doc = await openDocument('Jenkinsfile');
		await waitUntil(() => diagnosticsChanged(testDocs['Jenkinsfile'].doc.uri, []), 60000);
		const docDiagnostics = vscode.languages.getDiagnostics(testDocs['Jenkinsfile'].doc.uri);

		assert(docDiagnostics.length === numberOfDiagnosticsForJenkinsfileLint, `${numberOfDiagnosticsForJenkinsfileLint} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(60000);


	// Format Jenkinsfile
	test("4.1. Format Jenkinsfile", async () => {
		console.log("Start 4.1. Format Jenkinsfile");
		const textBefore = getActiveEditorText();
		const prevDiags = vscode.languages.getDiagnostics(testDocs['Jenkinsfile'].doc.uri);
		const textEdits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', testDocs['Jenkinsfile'].doc.uri, {});
		await applyTextEditsOnDoc(testDocs['Jenkinsfile'].doc.uri, textEdits as vscode.TextEdit[]);
		await waitUntil(() => diagnosticsChanged(testDocs['Jenkinsfile'].doc.uri, prevDiags), 100000); // Wait for linter to lint again after fix
		const textAfter = getActiveEditorText();

		assert(textBefore !== textAfter, 'TextDocument text must be updated after format');
	}).timeout(100000);

	// Fix Jenkinsfile (no errors fixed)
	test("4.2. Fix Jenkinsfile", async () => {
		console.log("Start 4.2. Fix Jenkinsfile");
		const textBefore = getActiveEditorText();
		vscode.commands.executeCommand('groovyLint.lintFix');
		await waitUntil(() => diagnosticsChanged(testDocs['Jenkinsfile'].doc.uri, []), 100000);
		const docDiagnostics = vscode.languages.getDiagnostics(testDocs['Jenkinsfile'].doc.uri);
		assert(docDiagnostics.length === numberOfDiagnosticsForJenkinsfileLintFix, `${numberOfDiagnosticsForJenkinsfileLintFix} GroovyLint diagnostics found after lint (${docDiagnostics.length} returned)`);
	}).timeout(100000);


	// Lint a folder
	test("5.1. Lint folder", async () => {
		console.log("4.1. Lint folder");
		const docFolderUri = vscode.Uri.file(
			path.join(__dirname + testFolderExamplesLocation)
		);
		const bigGroovyUri = testDocs['bigGroovy'].doc.uri;
		const tinyGroovyUri = testDocs['tinyGroovy'].doc.uri;
		const JenkinsfileUri = testDocs['Jenkinsfile'].doc.uri;
		await vscode.commands.executeCommand('groovyLint.lintFolder', [docFolderUri]);
		await waitUntil(() => diagnosticsChanged(bigGroovyUri, []), 120000);
		await waitUntil(() => diagnosticsChanged(tinyGroovyUri, []), 60000);
		await waitUntil(() => diagnosticsChanged(JenkinsfileUri, []), 120000);
		// Compute total of UI diagnostics
		const bigDiags = vscode.languages.getDiagnostics(bigGroovyUri);
		const tinyDiags = vscode.languages.getDiagnostics(tinyGroovyUri);
		const jkfDiags = vscode.languages.getDiagnostics(JenkinsfileUri);
		const totalDiags = bigDiags.length + tinyDiags.length + jkfDiags.length;
		// Compute expected total
		const numberOfDiagnosticsForFolderLint = numberOfDiagnosticsForBigGroovyLintFix + numberOfDiagnosticsForTinyGroovyLintFix + numberOfDiagnosticsForJenkinsfileLintFix;

		assert(totalDiags === numberOfDiagnosticsForFolderLint, `${numberOfDiagnosticsForFolderLint} GroovyLint diagnostics found after lint (${totalDiags} returned)`);
	}).timeout(180000);
});

// Open a textDocument and show it in editor
async function openDocument(docExample: string) {
	const docName = testDocs[docExample].path;
	const docUri = vscode.Uri.file(
		path.join(__dirname + testFolderExamplesLocation + docName)
	);
	const document: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(document);
	await waitUntil(groovyLintExtensionIsActive, 10000) === true;
	return document;
}

function getActiveEditorText() {
	return vscode.window.activeTextEditor.document.getText();
}

async function applyTextEditsOnDoc(docUri: vscode.Uri, textEdits: vscode.TextEdit[]) {
	const workspaceEdit = new vscode.WorkspaceEdit();
	workspaceEdit.set(docUri, textEdits);
	const applyRes = await vscode.workspace.applyEdit(workspaceEdit);
	assert(applyRes === true, 'Edits have been applied. Err: applyRes=' + applyRes);
	console.log(`Applied ${textEdits.length} textEdits`);
	return applyRes;
}

// Wait until the promise returned by testFunction is resolved or rejected
async function waitUntil(testFunction: Function, timeout_ms = 20 * 1000): Promise<any> {
	return new Promise(async (resolve, reject) => {
		let start = performance.now();
		let freq = 300;
		let result: any;
		// wait until the result is truthy, or timeout
		while (result === undefined || result === false || result === null || result.length === 0) {  // for non arrays, length is undefined, so != 0
			if ((performance.now() - start) > timeout_ms) {
				console.error('Timeout : ' + testFunction);
				reject('Timeout after ' + parseInt(performance.now(), 10) + 'ms: ' + testFunction);
				return;
			}
			await sleepPromise(freq);
			result = await testFunction();
		}
		// return result if testFunction passed
		debug('Waiting time: ' + performance.now() + ' for ' + testFunction);
		resolve(result);
	});
}

function diagnosticsChanged(docUri: vscode.Uri, prevDiags: vscode.Diagnostic[]): Promise<boolean> {
	return new Promise(async (resolve, reject) => {
		let diagsChanged = false;
		const docDiags = vscode.languages.getDiagnostics(docUri);
		if (diagsChanged === false && docDiags && docDiags.length > 0 &&
			docDiags.length !== prevDiags.length && !isWaitingDiagnostic(docDiags)
		) {
			diagsChanged = true;
			console.log(`Diagnostics changed for ${docUri} (${docDiags.length}) `);
			resolve(true);
		}
		const disposable = vscode.languages.onDidChangeDiagnostics((e: vscode.DiagnosticChangeEvent) => {
			if (diagsChanged === false && e.uris.filter(uriX => uriX.toString() === docUri.toString()).length > 0) {
				const docDiags = vscode.languages.getDiagnostics(docUri);
				if (docDiags && docDiags.length > 0 && !isWaitingDiagnostic(docDiags)) {
					diagsChanged = true;
					console.log(`Diagnostics changed for ${docUri} (${docDiags.length}) `);
				}
			}
		});
		await sleepPromise(500);
		disposable.dispose();
		resolve(diagsChanged);
	});
}

async function groovyLintExtensionIsActive() {
	const allCommands = await vscode.commands.getCommands(true);
	return allCommands.includes('groovyLint.lint');
}

function documentHasBeenUpdated(docUri: vscode.Uri, prevDocSource: string): Promise<boolean> {
	const res = prevDocSource !== getActiveEditorText();
	if (res === true) {
		console.log(`${docUri} has been updated`);
	}
	return Promise.resolve(res);
}

// Check if the only diagnostic is the waiting one
function isWaitingDiagnostic(diags: vscode.Diagnostic[]) {
	return diags && diags.length === 1 && diags[0].code === 'GroovyLintWaiting';
}

async function sleepPromise(ms: number) {
	await new Promise(r => setTimeout(r, ms));
}