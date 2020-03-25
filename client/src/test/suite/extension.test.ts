import * as assert from 'assert';
import * as path from "path";
import * as vscode from 'vscode';
import { getDiagnosticsCollection } from '../../extension';
import { watchFile } from 'fs';

const testFolderExamplesLocation = '/../../../src/test/examples/';

const extensionId = 'NicolasVuillamy.vscode-groovy-lint';

suite('VsCode GroovyLint Test Suite', async () => {
	vscode.window.showInformationMessage('Start all VsCode Groovy Lint tests');

	// Check extension is available
	test("GroovyLint extension is available", async () => {
		await openDocument();
		const availableExtensions = vscode.extensions.all.map(ext => ext.id);
		console.log('Env arguments:' + JSON.stringify(process.env));
		console.log('Available extensions: ' + JSON.stringify(availableExtensions));
		assert(availableExtensions.includes(extensionId), "GroovyLint extension found");
	}).timeout(10000);

	// Check all commands are here
	test("Check GroovyLint VsCode commands", async () => {
		const allCommands = await vscode.commands.getCommands(true);
		//console.log('Commands found: ' + JSON.stringify(allCommands));
		const groovyLintCommands = allCommands.filter((command) => {
			return command.startsWith('groovyLint');
		});
		assert(groovyLintCommands.length === 7, "GroovyLint commands found");
	}).timeout(5000);

	// Lint document
	test("Lint document", async () => {
		const { document } = await openDocument();
		await vscode.commands.executeCommand('groovyLint.lint');
		await sleepPromise(120000);
		const diagnosticsCollection = getDiagnosticsCollection();
		const docDiagnostics = diagnosticsCollection.get(document.uri);
		assert(docDiagnostics.length > 0, 'Diagnostics are returned');
	}).timeout(180000);


});

async function openDocument() {
	const docUri = vscode.Uri.file(
		path.join(__dirname + testFolderExamplesLocation + 'SampleFile.groovy')
	);
	const document: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);
	await vscode.window.showTextDocument(document);
	await sleepPromise(3000);
	return { document };
}

async function sleepPromise(ms: number) {
	await new Promise(r => setTimeout(r, ms));
}