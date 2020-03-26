import * as path from 'path';
import { runTests } from 'vscode-test';
const NYC = require('nyc');

const codeCoverage = process.argv && process.argv.includes('--codecoverage');

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../..');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// create an nyc instance, config here is the same as in a package.json
		const nyc = new NYC({
			cwd: path.join(__dirname, '..', '..', '..'), // in debugging sessions, the cwd seems to be unset
			include: [
				"./client/src/*.ts",
				"./server/src/*.ts"
			],
			exclude: [
				"coverage/**",
				"node_modules/**",
				"client/node_modules/**",
				"server/node_modules/**",
				"**/*.d.ts",
				"**/*.test.ts"],
			sourceMap: true,
			extension: [
				".ts"
			],
			all: true,
			reporter: ['html'],
			instrument: true,
			hookRequire: true,
			hookRunInContext: true,
			hookRunInThisContext: true,
		});

		if (codeCoverage) {
			console.log('nyc cwd base: ' + path.join(__dirname, '..', '..', '..'));
			nyc.createTempDirectory(); // create nyc' temp directory
			nyc.wrap(); // hook into require() calls, etc.
		}
		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionPath: extensionDevelopmentPath,
			testRunnerPath: extensionTestsPath,
			additionalLaunchArgs: ['--disable-extensions', '--no-sandbox', '--verbose']
		});

		if (codeCoverage) {
			nyc.writeCoverageFile();
			nyc.report(); // write out the report
		}

	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();

/*
	"nyc": {
		"include": [
			"./client/src/*.ts",
			"./server/src/*.ts"
		],
		"exclude": [
			"coverage/**",
			"node_modules/**",
			"client/node_modules/**",
			"server/node_modules/**",
			"**//*.d.ts",
"**//*.test.ts"
],
"sourceMap": true,
"extension": [
".ts"
],
"reporter": [
"html"
],
"all": true,
"instrument": true
},
*/
