import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentsManager } from './DocumentsManager';
const debug = require("debug")("vscode-groovy-lint");
const trace = require("debug")("vscode-groovy-lint-trace");

// Parse results into VsCode diagnostic
export function parseLinterResults(lintResultsIn: any, source: string, textDocument: TextDocument, docManager: DocumentsManager) {
	const lintResults = JSON.parse(JSON.stringify(lintResultsIn));
	const allText = source;
	const diffLine = -1; // Difference between CodeNarc line number and VSCode line number

	const allTextLines = allText.split('\n');

	// Build diagnostics
	let diagnostics: Diagnostic[] = [];
	const fixFailures: any[] = [];
	const docQuickFixes: any = {};
	if (lintResults?.files && lintResults.files[0] && lintResults.files[0].errors) {
		debug(`Parsing results of ${textDocument.uri} (${Object.keys(lintResults.files).length} in lintResults)`);
		// Get each error for the file
		let pos = 0;
		for (const err of lintResults.files[0].errors) {
			// Ensure line is a number
			if (err.line  && typeof err.line === 'string') {
				err.line = parseInt(err.line, 10);
			}
			// Do not display diagnostics for fixed errors
			if (err.fixed === true) {
				continue;
			}
			// Append to fixFailures if fix was not correctly applied
			else if (err.fixed === false) {
				fixFailures.push(err);
				continue;
			}
			let range = err.range;
			if (range) {
				range.start.line += diffLine;
				range.end.line += diffLine;
				// Avoid issue from linter if it returns wrong range
				range.start.line = (range.start.line >= 0) ? range.start.line : 0;
				range.start.character = (range.start.character >= 0) ? range.start.character : 0;
				range.end.line = (range.end.line >= 0) ? range.end.line : 0;
				range.end.character = (range.end.character >= 0) ? range.end.character : 0;
			}
			// Build default range (whole line) if not returned by npm-groovy-lint
			// eslint-disable-next-line eqeqeq
			else if (err.line && err.line != null && err.line > 0 && allTextLines[err.line + diffLine] !== null) {
				const line = allTextLines[err.line + diffLine];
				const indent = line.search(/\S/);
				range = {
					start: {
						line: err.line + diffLine,
						character: (indent >= 0) ? indent : 0 // Get first non empty character position
					},
					end: {
						line: err.line + diffLine,
						character: line.length || 0
					}
				};
			} else {
				// Default range (should not really happen)
				range = {
					start: {
						line: 0,
						character: 0 // Get first non empty character position
					},
					end: {
						line: 0,
						character: 0
					}
				};
			}
			// Create vscode Diagnostic
			const diagCode: string = err.rule + '-' + err.id;
			const diagnostic: Diagnostic = {
				severity: (err.severity === 'error') ? DiagnosticSeverity.Error :
					(err.severity === 'warning') ? DiagnosticSeverity.Warning :
						DiagnosticSeverity.Information,
				code: diagCode,
				range: range,
				message: err.msg || err.rule || "Missing error message :(",
				source: 'GroovyLint'
			};
			// Add quick fix if error is fixable. This will be reused in CodeActionProvider
			if (err.fixable) {
				docQuickFixes[diagCode] = [];
				docQuickFixes[diagCode].push({
					label: err.fixLabel || `Fix ${err.rule}`,
					errId: err.id
				});
				debug(`Quick Fix: ${err.fixLabel || `Fix ${err.rule}`} ${err.id}`);
			}
			trace(`Diagnostic: ${JSON.stringify(diagnostic, null, 2)}`);
			diagnostics.push(diagnostic);
			pos++;
		}
		docManager.setDocQuickFixes(textDocument.uri, docQuickFixes);
	}
	debug(`Parsed ${diagnostics.length} diagnostics and ${fixFailures.length} fix failures`);
	return { diagnostics: diagnostics, fixFailures: fixFailures };
}
