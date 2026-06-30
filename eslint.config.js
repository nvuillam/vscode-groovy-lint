const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
	{
		files: ["client/src/**/*.ts", "server/src/**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 6,
				sourceType: "module",
				project: ["./server/tsconfig.json", "./client/tsconfig.json"],
			},
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
		},
		rules: {
			curly: "warn",
			eqeqeq: "warn",
			"no-throw-literal": "warn",
			semi: "warn",
		},
	},
];