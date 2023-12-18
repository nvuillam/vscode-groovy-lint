/* eslint-disable eqeqeq */
import * as assert from 'assert';
import { join } from 'path';
import * as vscode from 'vscode';
import * as temp from 'temp';
import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { test } from 'mocha';

// Workaround: https://github.com/microsoft/vscode/issues/197494.
process.env['DEBUG'] = process.env['NPM_DEBUG'];
const debug = require('debug')('vscode-groovy-lint');

// Track temporary files and directories.
temp.track();

// Constants
const second = 1000; // 1 second in milliseconds.
const defaultTimeout = 5 * second;
const testsFolder = '../../../src/test';
const examples = 'examples';
const testConfig = '.groovylintrc.json';
const extensionId = 'NicolasVuillamy.vscode-groovy-lint';
const tinyGroovy = 'tiny-crlf.groovy';
const validGroovy = 'valid.groovy';
const numberOfGroovyLintCommands = 9;

// Additional timeout for the first test to
// allow for server startup timeout.
let additionalTimeout = defaultTimeout;

// RegExp to determine predominate End Of Line (EOL) sequence.
const eolCaptureRegExp: RegExp = new RegExp(/(\r?\n)/g);

// End of Line sequences.
const unixEOL = '\n';
const dosEOL = '\r\n';

/**
 * testDocumentDetails represents the expected results for a testDocument.
 */
class testDocumentDetails {
	// Document settings.
	readonly name: string;
	readonly lint: number;
	readonly lintFix: number;
	readonly formats: boolean;
	timeout: number;

	constructor(name: string, lint: number, lintFix: number, formats: boolean = true, timeout: number = defaultTimeout) {
		this.name = name;
		this.lint = lint;
		this.lintFix = lintFix;
		this.timeout = timeout;
		this.formats = formats;
	};
}

// Test documents details.
const documentDetails = new Map<string, testDocumentDetails>();
[
	new testDocumentDetails(validGroovy, 0, 0, false),
	new testDocumentDetails(tinyGroovy, 50, 19),
	new testDocumentDetails('tiny-lf.groovy', 50, 19),
	new testDocumentDetails('big.groovy', 4114, 789, true, 10 * second),
	new testDocumentDetails('Jenkinsfile', 380, 151, true, 10 * second),
	new testDocumentDetails('parseError.groovy', 2, 1, false),
	new testDocumentDetails('file with spaces.groovy', 50, 19),
].forEach(details => documentDetails.set(details.name, details));

/**
 * Profiler is used to measure time between events.
 */
class Profiler {
	// Map profile id to start times.
	private startTimes: Map<string, number> = new Map();

	/**
	 * Returns the time since the profile was started.
	 *
	 * @param id The identified of the profile.
	 * @returns The time in milliseconds since the profile was started.
	 */
	private since(id: string = 'default'): number {
		const start = this.startTimes.get(id);
		if (start === undefined) {
			return 0;
		}
		return Math.round(performance.now() - start);
	}

	/**
	 * Returns the time since the profile id was started as a string.
	 *
	 * @param id The identified of the profile.
	 * @returns The time since the profile id was started as a string.
	 */
	private sinceSting(id: string = 'default'): string {
		let since = this.since(id);
		let seconds = Math.round(since / second);
		let ms = since % second;
		let sinceSting = (seconds > 0) ? `${seconds}s ` : '';
		return `${sinceSting}${ms}ms`;
	}

	/**
	 * Records a start time for the given id.
	 *
	 * @param id The identifier to record the start for.
	 */
	start(id: string = 'default') {
		this.startTimes.set(id, performance.now());
	}

	/**
	 * Ends a given profile and returns the time since it was started as string.
	 *
	 * @param id The identifier to record the start for.
	 * @returns The time since the profile was started.
	 */
	end(id: string = 'default') {
		const since = this.sinceSting(id);
		this.startTimes.delete(id);
		return since;
	}
}

// Global profiler.
const profiler = new Profiler();

/**
 * testDocument represents a document used for testing.
 * The document is stored in a temporary directory to
 * ensure uniqueness.
 */
class testDocument extends testDocumentDetails {
	// Promise names.
	static readonly diagnosticPromise = 'Diagnostics';
	static readonly documentEditPromise = 'DocumentEdit';

	// Document settings.
	readonly uri: vscode.Uri;
	readonly uriString: string;

	// Document state.
	doc: vscode.TextDocument = null;
	diags: vscode.Diagnostic[];

	// Promise handling.
	private resolvers: Map<string, (value: void | PromiseLike<void>) => void> = new Map();
	private rejecters: Map<string, (reason?: any) => void> = new Map();

	constructor(tempDirectory: string, details: testDocumentDetails) {
		super(details.name, details.lint, details.lintFix, details.formats, details.timeout);

		// We use copies in temporary files to ensure each test is independent.
		const data = fs.readFileSync(join(__dirname, testsFolder, examples, details.name));
		const tmpFile = join(tempDirectory, details.name);
		fs.writeFileSync(tmpFile, data);

		this.uri = vscode.Uri.file(tmpFile);
		this.uriString = this.uri.toString();
	};

	/**
	 * Opens the document and waits for diagnostics to be sent.
	 *
	 * @returns A promise which resolves when the document is open and diagnostics have been sent.
	 */
	async setupTest(): Promise<testDocument> {
		const diagsUpdated = this.wait(testDocument.diagnosticPromise); // Must be defined before open() is called.
		await Promise.all([this.open(), diagsUpdated]);

		return this;
	}

	/**
	 * Opens the document and shows it in editor.
	 *
	 * @returns A promise which resolves when the document is open.
	 */
	async open(): Promise<void> {
		let profileID = this.profileID('open');
		profiler.start(profileID);

		if (this.doc) {
			// Document already opened.
			await vscode.window.showTextDocument(this.doc);
			debug(`Open already: "${this.name}" took: ${profiler.end(profileID)}`);
			return;
		}

		this.doc = await vscode.workspace.openTextDocument(this.uri);
		await vscode.window.showTextDocument(this.doc);

		debug(`Open: "${this.name}" took: ${profiler.end(profileID)}`);
	}

	/**
	 * Applies the given text edits to the document and waits for diagnostics to be sent.
	 *
	 * @param textEdits The text edits to apply.
	 * @returns A promise which resolves when the edits have been applied.
	 * @throws An error if the edits have not been applied or if the textEdits are invalid.
	 */
	async applyEdits(textEdits: vscode.TextEdit[]): Promise<void> {
		if (!textEdits) {
			throw new Error(`Apply edits invalid value: ${JSON.stringify(textEdits)}`);
		}

		let profileID = this.profileID('applyEdits');
		profiler.start(profileID);

		const diagsUpdated = this.wait(testDocument.diagnosticPromise);
		const workspaceEdit = new vscode.WorkspaceEdit();
		workspaceEdit.set(this.uri, textEdits);
		const applyRes = await vscode.workspace.applyEdit(workspaceEdit);
		if (applyRes === false) {
			throw new Error(`Apply edits: ${textEdits.length} failed after: ${profiler.end(profileID)}`);
		}

		await diagsUpdated;

		debug(`Applied edits: ${textEdits.length} took: ${profiler.end(profileID)}`);
	}

	/**
	 * Creates a promise which resolves when triggered externally.
	 *
	 * @param name The name of the promise.
	 * @returns A promise which resolves when resolved.
	 */
	wait(name: string): Promise<void> {
		const profileID = this.profileID(name);
		profiler.start(profileID);

		return new Promise<void>(async (resolve, reject) => {
			this.rejecters.set(name, (reason?: any) => {
				debug(`Rejected ${name}: "${this.name}" took: ${profiler.end(profileID)}`);
				reject(reason);
			});
			this.resolvers.set(name, () => {
				debug(`Resolved ${name}: "${this.name}" took: ${profiler.end(profileID)}`);
				resolve();
			});
		}).finally(() => {
			this.rejecters.delete(name);
			this.resolvers.delete(name);
		});
	}

	/**
	 * Disables the given rule on the given line with cmd and waits for diagnostics to be sent.
	 *
	 * @param cmd The command to run to disable the rule.
	 * @param ruleName The name of the rule to disable.
	 * @param line The line on which to disable the rule (0 indexed).
	 */
	async disableRule(cmd: string, ruleName: string, line: number = null): Promise<void> {
		let profileID = this.profileID('disableRule');
		profiler.start(profileID);

		const diagnostic = this.diags.find(diag =>
			(diag.code as string).startsWith(ruleName) && (line == null || diag.range.start.line === line)
		);

		debug(`Diagnostic ${ruleName} identified: ${JSON.stringify(diagnostic)}`);
		if (!diagnostic) {
			if (line == null) {
				throw new Error(`Diagnostic ${ruleName} not found: "${this.name}" took: ${profiler.end(profileID)}`);
			}
			throw new Error(`Diagnostic ${ruleName} not found line: ${line} text: ${this.doc.lineAt(line).text}) took: ${profiler.end(profileID)}`);
		}

		const diagsPromise = this.wait(testDocument.diagnosticPromise);
		const docPromise = this.wait(testDocument.documentEditPromise);

		// Request code actions.
		const codeActions = await executeCommand('vscode.executeCodeActionProvider', this.uri, diagnostic.range);
		debug(`Returned codeActions: ${codeActions.length}`);

		// Apply Quick Fix.
		await Promise.all([executeCommand(cmd, this.uriString, diagnostic), diagsPromise, docPromise]);

		debug(`Disable rule: ${cmd} took: ${profiler.end(profileID)}`);
	}

	/**
	 * Executes a command and waits for the named promises to be resolved.
	 *
	 * @param promiseNames The names of the promises to wait for.
	 * @param command The command to execute.
	 * @param args The arguments to pass to the command.
	 * @returns A promise which resolves when diagnostics have been sent.
	 */
	async execute(promiseNames: string[], command: string, ...args: any[]): Promise<void> {
		debug(`wait: ${promiseNames} execute: ${command} with args ${JSON.stringify(args)}`);
		const promises: Promise<void>[] = [];
		for (const name of promiseNames) {
			promises.push(this.wait(name));
		}
		promises.push(vscode.commands.executeCommand(command, ...args) as Promise<void>);

		await Promise.all(promises);
	}

	/**
	 * Returns a profile identifier for the given action.
	 *
	 * @returns The profileID for the given action.
	 */
	private profileID(action: string): string {
		return `${action} ${this.name}`;
	}

	/**
	 * Returns the text of the document.
	 */
	get text(): string {
		return this.doc.getText();
	}

	/**
	 * Resolves the named promise if it exists.
	 *
	 * @param name The name of the promise to resolve.
	 */
	resolve(name: string): void {
		debug(`Resolve: "${this.name}" promise: ${name}`);
		this.resolvers.get(name)?.();
	}

	/**
	 * Reject all pending promises.
	 */
	reject(): void {
		this.rejecters.forEach((reject, name) => {
			const profileID = this.profileID(name);
			reject(new Error(`${name} timeout: "${this.name}" waited: ${profiler.end(profileID)}`));
		});
	}
}

/**
 * Provides the ability run an independent test for specified documents.
 */
class testDocuments extends Map<string, testDocument> {
	// State.
	private disposables: vscode.Disposable[] = [];
	private nameToPath: Map<string, string> = new Map();
	readonly directory: string;

    constructor(...files: string[]) {
		super();

		this.directory = temp.mkdirSync({prefix: 'vscode-groovy-lint-test-'});
		debug(`testDocuments ${files} directory: "${this.directory}"`);

		// Copy the test config, so it will be found.
		const data = fs.readFileSync(join(__dirname, testsFolder, testConfig));
		const tmpFile = join(this.directory, testConfig);
		fs.writeFileSync(tmpFile, data);

		// Copy each requested file so they are unique per test.
		files.forEach(file => {
			const doc = new testDocument(this.directory, documentDetails.get(file));
			this.set(doc.uri.fsPath, doc);
			this.nameToPath.set(doc.name, doc.uri.fsPath);
		});

		// Listen for diagnostic change events, resolving promises as needed.
		this.disposables.push(vscode.languages.onDidChangeDiagnostics((e: vscode.DiagnosticChangeEvent) => {
			e.uris.forEach(uri => {
				debug(`Diagnostics changes "${uri.fsPath}"`);
				const doc = this.get(uri.fsPath);
				if (!doc) {
					// Not one of our documents.
					debug(`Ignoring diagnostics changes "${uri.fsPath}" directory: "${this.directory}"`);
					return;
				}

				doc.diags = vscode.languages.getDiagnostics(uri);

				debug(`Diagnostics changed "${doc.name}" length: ${doc.diags.length}`);

				doc.resolve(testDocument.diagnosticPromise);
			});
		}));

		// Listens for text document change events, resolving promises as needed.
		this.disposables.push(vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
			const doc = this.get(e.document.uri.fsPath);
			if (!doc) {
				// Not one of our documents.
				debug(`Ignoring document changes "${e.document.uri.fsPath}" directory: "${this.directory}"`);
				return;
			}

			debug(`TextDocument changed "${doc.name}" length: ${e.contentChanges.length}`);

			doc.resolve(testDocument.documentEditPromise);
		}));
    }

	/**
	 * Runs a test, opening the named file so that our extension is loaded.
	 *
	 * @param context The text context.
	 * @param name The name of the file to use.
	 * @param action The action to call with the testDocument which matches name.
	 * @param timeout The timeout override.
	 * @returns A promise which resolves when the test is setup.
	 */
	async run(context: Mocha.Context, name: string, action?: (doc: testDocument, testDocs: testDocuments) => Promise<void>, timeout: number = 0): Promise<void> {
		// Disable mocha timeout as it doesn't handle promises cleanly.
		// This is done for each test so its compatible with Test Explorer
		// runs of selected tests which doesn't run the global handlers.
		context.timeout(0);

		const profileID = `run ${name}`;
		profiler.start(profileID);

		const fsPath = this.nameToPath.get(name);
		let doc = this.get(fsPath);
		timeout = timeout || doc.timeout;
		if (additionalTimeout) {
			// This is the first test, allow additional time for the server to start up.
			timeout += additionalTimeout;
			additionalTimeout = 0;
		}

		let timer: NodeJS.Timeout;
		return new Promise<void>(async (resolve, reject) => {
			timer = setTimeout(() => {
				reject(new Error(`run timeout: "${name}" waited: ${profiler.end(profileID)}`));
				this.forEach(doc => doc.reject());
			}, timeout);

			try {
				// Close stale editors.
				await executeCommand('workbench.action.closeAllEditors');

				doc = await doc.setupTest();
				if (action) {
					await action(doc, this);
				}

				resolve();
			} catch (err) {
				reject(err);
			}
		}).finally(async () => {
			clearTimeout(timer);
			await this.cleanup();
		});
	}

	/**
	 * Resets the diagnostics and closes all test documents.
	 */
	async cleanup() {
		const cleanupProfileID = `cleanup: ${this.directory}`;
		profiler.start(cleanupProfileID);
		await executeCommand('workbench.action.closeAllEditors');
		this.disposables.forEach(disposable => disposable.dispose());

		// Remove temporary files per test.
		await temp.cleanup();

		debug(`Clean up: took ${profiler.end(cleanupProfileID)}`);
	}
}

async function testSingle(context: Mocha.Context, name: string, action?: (doc: testDocument) => Promise<void>, timeout: number = 0): Promise<void> {
	await testMulti(context, [name], action, timeout);
}

async function testMulti(context: Mocha.Context, names: string[], action?: (doc: testDocument, testDocs: testDocuments) => Promise<void>, timeout: number = 0): Promise<void> {
	const testDocs = new testDocuments(...names);
	await testDocs.run(context, names[0], action, timeout);
}

suite('VsCode GroovyLint Test Suite', async function() {
	// Check extension is available.
	test('Extension is available', async function() {
		await testSingle(this, validGroovy);

		assert(vscode.extensions.getExtension(extensionId), 'GroovyLint extension not found');
	});

	// Check all commands are available.
	test('Available commands', async function() {
		await testSingle(this, validGroovy, async function(): Promise<void> {
			const allCommands = await vscode.commands.getCommands();
			const groovyLintCommands = allCommands.filter((command) => {
				return command.startsWith('groovyLint');
			});

			assert(groovyLintCommands.length === numberOfGroovyLintCommands,
				`Found ${groovyLintCommands.length} GroovyLint commands expected ${numberOfGroovyLintCommands}`
			);
		});
	});

	// Lint documents.
	documentDetails.forEach(async (_, name) => {
		test(`Lint "${name}"`, async function() {
			await testSingle(this, name, async function(doc: testDocument): Promise<void> {
				const diagsLen = doc.diags.length;
				assert(diagsLen === doc.lint, `Found ${diagsLen} diagnostics expected ${doc.lint}`);
			});
		});
	});

	// Format documents.
	documentDetails.forEach(async (_, name) => {
		test(`Format "${name}"`, async function() {
			// Total process requires two passes so double the timeout.
			const docDetails = documentDetails.get(name);
			await testSingle(this, name, async function(doc: testDocument): Promise<void> {
				const textBefore = doc.text;
				const origEOL: string = textEOL(textBefore);
				const textEdits = await executeCommand('vscode.executeFormatDocumentProvider', doc.uri, {});
				if (!doc.formats) {
					// Not expected for format.
					assert(textEdits === undefined, `Unexpected textEdits returned for format ${JSON.stringify(textEdits)}`);
					return;
				}

				await doc.applyEdits(textEdits);

				const textAfter = doc.text;
				assert(textBefore !== textAfter, 'Text not updated format');

				const newEOL: string = textEOL(textAfter);
				assert(origEOL === newEOL, `end of line sequence changed from ${origEOL} to ${newEOL}`);
			}, docDetails.timeout * 2);
		});
	});

	// Fix documents.
	documentDetails.forEach(async (_, name) => {
		test(`Fix "${name}"`, async function() {
			// Total process requires three passes so triple the timeout.
			const docDetails = documentDetails.get(name);
			await testSingle(this, name, async function(doc: testDocument): Promise<void> {
				const textBefore = doc.text;
				const origEOL: string = textEOL(textBefore);
				const promiseNames: string[] = [];
				if (doc.lint !== doc.lintFix) {
					promiseNames.push(testDocument.diagnosticPromise, testDocument.documentEditPromise);
				}

				// groovyLint.lintFix requires two passes so double the timeout.
				docDetails.timeout *= 2;
				await doc.execute(promiseNames, 'groovyLint.lintFix', doc.uri);
				const textAfter = doc.text;
				const diagsLen = doc.diags.length;

				if (doc.lint !== doc.lintFix) {
					assert(textBefore !== textAfter, 'Text not updated');
				} else {
					assert(textBefore === textAfter, 'Unexpected text update');
				}
				assert(diagsLen === doc.lintFix, `Found ${diagsLen} diagnostics expected ${doc.lintFix}`);

				const newEOL: string = textEOL(textAfter);
				assert(origEOL === newEOL, `end of line sequence changed from ${origEOL} to ${newEOL}`);
			}, docDetails.timeout * 3);
		});
	});

	// Disable rules for a line.
	documentDetails.forEach(async (_, name) => {
		if (!name.startsWith('tiny')) {
			return;
		}

		test(`Disable "${name}" next line`, async function() {
			await testSingle(this, name, async function(doc: testDocument): Promise<void> {
				const origEOL: string = textEOL(doc.text);
				const lineNb = 5;
				// Add a disable line.
				await doc.disableRule('groovyLint.disableRule', 'SpaceBeforeOpeningBrace', lineNb);

				// Amend the disable line.
				await doc.disableRule('groovyLint.disableRule', 'UnnecessaryGString', lineNb + 1);

				const disableLine = doc.doc.lineAt(lineNb).text;
				assert(disableLine.includes(`/* groovylint-disable-next-line SpaceBeforeOpeningBrace, UnnecessaryGString */`),
					`groovylint-disable-next-line not added correctly found: ${disableLine}`
				);

				const newEOL: string = textEOL(doc.text);
				assert(origEOL === newEOL, `end of line sequence changed from ${origEOL} to ${newEOL}`);
			});
		});
	});

	// Disable rules for entire file.
	test('Disable rules in all file', async function() {
		await testSingle(this, tinyGroovy, async function(doc: testDocument): Promise<void> {
			const origEOL: string = textEOL(doc.text);
			// Add a disable line.
			await doc.disableRule('groovyLint.disableRuleInFile', 'CompileStatic');

			// Amend the disable line.
			await doc.disableRule('groovyLint.disableRuleInFile', 'DuplicateStringLiteral');

			const disableLine = doc.doc.lineAt(0).text;
			assert(disableLine.includes('/* groovylint-disable CompileStatic, DuplicateStringLiteral */'),
				`groovylint-disable not added correctly found: ${disableLine}`
			);

			const newEOL: string = textEOL(doc.text);
			assert(origEOL === newEOL, `end of line sequence changed from ${origEOL} to ${newEOL}`);
		});
	});

	// Quick fix error.
	test('Quick fix error in tiny document', async function() {
		await testSingle(this, tinyGroovy, async function(doc: testDocument): Promise<void> {
			const textBefore = doc.text;
			const origEOL: string = textEOL(textBefore);
			const diagnostic = doc.diags.find(diag => (diag.code as string).startsWith('UnnecessarySemicolon'));
			// Request code actions.
			await doc.execute([], 'vscode.executeCodeActionProvider', doc.uri, diagnostic.range);

			// Apply Quick Fix.
			await doc.execute([testDocument.diagnosticPromise, testDocument.documentEditPromise], 'groovyLint.quickFix', doc.uriString, diagnostic);
			const textAfter = doc.text;

			assert(textBefore !== textAfter, 'Text not updated');

			const newEOL: string = textEOL(textAfter);
			assert(origEOL === newEOL, `end of line sequence changed from ${origEOL} to ${newEOL}`);
		});
	});

	// Quick fix all error types.
	test('Quick fix error in entire file in tiny document', async function() {
		await testSingle(this, tinyGroovy, async function(doc: testDocument): Promise<void> {
			const textBefore = doc.text;
			const origEOL: string = textEOL(textBefore);
			const diagnostic = doc.diags.find(diag => (diag.code as string).startsWith('UnnecessarySemicolon'));

			// Request code actions.
			await doc.execute([], 'vscode.executeCodeActionProvider', doc.uri, diagnostic.range);

			// Apply Quick Fix.
			await doc.execute([testDocument.diagnosticPromise, testDocument.documentEditPromise], 'groovyLint.quickFixFile', doc.uri.toString(), diagnostic);

			const textAfter = doc.text;
			assert(textBefore !== textAfter, 'Text not updated');

			const newEOL: string = textEOL(textAfter);
			assert(origEOL === newEOL, `end of line sequence changed from ${origEOL} to ${newEOL}`);
		});
	});

	// Lint a folder.
	test('Lint folder', async function() {
		let timeout = 0;
		documentDetails.forEach(doc => {
			timeout += doc.timeout;
		});
		await testMulti(this, [...documentDetails.keys()], async function(doc: testDocument, testDocs: testDocuments): Promise<void> {
			const promises: Promise<void>[] = [];
			testDocs.forEach(doc => {
				promises.push(doc.wait(testDocument.diagnosticPromise));
			});

			// Lint folder.
			const docFolderUri = vscode.Uri.file(testDocs.directory);
			promises.push(executeCommand('groovyLint.lintFolder', docFolderUri, [docFolderUri]));

			await Promise.all(promises);

			testDocs.forEach(doc => {
				assert(doc.lint === doc.diags.length, `"${doc.name}" has: ${doc.diags.length} diagnostics expected: ${doc.lint}`);
			});
		}, timeout);
	});

	// Lint with parse error.
	test('Check file with parse error', async function() {
		await testSingle(this, 'parseError.groovy', async function(doc: testDocument): Promise<void> {
			const diagWithParseError = doc.diags.filter(diag => (diag.code as string).startsWith('NglParseError'));

			assert(diagWithParseError.length > 0, 'Parse error not found');
		});
	});
});

// Execute VsCode command
async function executeCommand(command: string, ...args: any[]): Promise<any> {
	debug(`Execute command ${command} with args ${JSON.stringify(args)}`);
	return vscode.commands.executeCommand(command, ...args);
}

/**
 * Returns the name of the predominate End Of Line (EOL) of the given text.
 *
 * @param text the text to determine the EOL from.
 * @returns the name of the predominate EOL sequence of text.
 */
function textEOL(text: string): string {
	const eols: string[] = text.match(eolCaptureRegExp) || [];
	let dos: number = 0;
	let unix: number = 0;
	eols.forEach(eol => {
		switch (eol) {
			case dosEOL:
				dos++;
				break;
			case unixEOL:
				unix++;
				break;
		}
	});

	return unix > dos ? unixEOL : dosEOL;
}
