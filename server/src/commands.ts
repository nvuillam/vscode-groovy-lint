import { Command } from 'vscode-languageserver';

// Create commands
const COMMAND_LINT = Command.create('Lint', 'groovyLint.lint');
const COMMAND_LINT_FIX = Command.create('Lint and fix errors', 'groovyLint.lintFix');
const COMMAND_LINT_QUICKFIX = Command.create('Quick fix', 'groovyLint.quickFix');
const COMMAND_LINT_QUICKFIX_FILE = Command.create('Quick fix in file', 'groovyLint.quickFixFile');
const COMMAND_SUPPRESS_WARNING_LINE = Command.create('Ignore this error', 'groovyLint.addSuppressWarning');
const COMMAND_SUPPRESS_WARNING_FILE = Command.create('Ignore this error in file', 'groovyLint.addSuppressWarningFile');
const COMMAND_IGNORE_ERROR_FOR_ALL_FILES = Command.create('Ignore this error in all files', 'groovyLint.alwaysIgnoreError');
const COMMAND_SHOW_RULE_DOCUMENTATION = Command.create('Ignore this error in all files', 'groovyLint.showRuleDocumentation');

export const commands = [
	COMMAND_LINT,
	COMMAND_LINT_FIX,
	COMMAND_LINT_QUICKFIX,
	COMMAND_LINT_QUICKFIX_FILE,
	COMMAND_SUPPRESS_WARNING_LINE,
	COMMAND_SUPPRESS_WARNING_FILE,
	COMMAND_IGNORE_ERROR_FOR_ALL_FILES,
	COMMAND_SHOW_RULE_DOCUMENTATION
];