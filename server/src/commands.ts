import { Command } from 'vscode-languageserver';

// Create commands
export const COMMAND_LINT = Command.create('Analyze code', 'groovyLint.lint');
export const COMMAND_LINT_FIX = Command.create('Fix all auto-fixable problems', 'groovyLint.lintFix');
export const COMMAND_LINT_QUICKFIX = Command.create('Quick fix this line', 'groovyLint.quickFix');
export const COMMAND_LINT_QUICKFIX_FILE = Command.create('Quick fix rule in this entire file', 'groovyLint.quickFixFile');
export const COMMAND_DISABLE_ERROR_FOR_LINE = Command.create('Disable rule for this line', 'groovyLint.disableRule');
export const COMMAND_DISABLE_ERROR_FOR_FILE = Command.create('Disable rule for this entire file', 'groovyLint.disableRuleInFile');
export const COMMAND_DISABLE_ERROR_FOR_PROJECT = Command.create('Disable rule for this entire project', 'groovyLint.disableRuleInProject');
export const COMMAND_SHOW_RULE_DOCUMENTATION = Command.create('Show documentation for rule', 'groovyLint.showDocumentationForRule');
export const COMMAND_LINT_FOLDER = Command.create('Analyze groovy files in this folder', 'groovyLint.lintFolder');

export const commands = [
	COMMAND_LINT,
	COMMAND_LINT_FIX,
	COMMAND_LINT_QUICKFIX,
	COMMAND_LINT_QUICKFIX_FILE,
	COMMAND_DISABLE_ERROR_FOR_LINE,
	COMMAND_DISABLE_ERROR_FOR_FILE,
	COMMAND_DISABLE_ERROR_FOR_PROJECT,
	COMMAND_SHOW_RULE_DOCUMENTATION,
	COMMAND_LINT_FOLDER
];