import * as path from 'path';
import { runTests } from '@vscode/test-electron';
const NYC = require('nyc');

const codeCoverage = process?.argv.includes('--codecoverage');

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../..');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		let nyc;
		if (codeCoverage) {
			// create an nyc instance, config here is the same as in a package.json
			const nycOptions = {
				cwd: path.join(__dirname, '..', '..', '..'), // in debugging sessions, the cwd seems to be unset
				include: [
					"**/*.ts",
					"**/*.js",
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
			};
			nyc = new NYC(nycOptions);
			console.log('nyc options:\n' + JSON.stringify(nycOptions, null, 2));
			nyc.createTempDirectory(); // create nyc' temp directory
			nyc.wrap(); // hook into require() calls, etc.
		}

		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath: extensionDevelopmentPath,
			extensionTestsPath: extensionTestsPath,
			vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH,
			extensionTestsEnv: {
				DEBUG: 'vscode-groovy-lint,npm-groovy-lint',
			},
			launchArgs: ['--disable-extensions'],
			reuseMachineInstall: true
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

