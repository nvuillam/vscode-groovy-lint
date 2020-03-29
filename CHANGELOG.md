# Change Log

### [0.5.3] 2020-03-29

- New diagnostic QuickAction: Show rule documentation
- Fix location error to create .groovylintrc.json from a QuickFix when user has multiple workspaces
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.1

### [0.5.0] 2020-03-26

- New command "Format" (Right click in code editor -> format, or Shift+Alt+F)
- [Automated tests](https://github.com/nvuillam/vscode-groovy-lint/blob/master/client/src/test/suite/extension.test.ts) with mocha and vscode-test
- [CI Integration (CircleCI)](https://app.circleci.com/pipelines/github/nvuillam/vscode-groovy-lint), build & run tests on Linux & Windows
- If hidden, show Diagnostics panel after first lint result. If closed again by the user, it won't be reopened
- Update README (doc + badges)
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.0
- Fixes 
  - Tab focus should not be disrupted by VsCode Groovy Lint 

### [0.4.1] 2020-03-23

- Fix blocking issue when using QuickFix Action (source was not replaced). If someone knows how to make good automated tests for a VsCode extension, please contact me !
- Change README

### [0.4.0] 2020-03-23

- Upgrade to npm-groovy-lint v3.1.3
- Hide GroovyLint status bar item when the active VsCode file is not Groovy code (and if no GroovyLint action in progress)
- Add screenshot image in README
- Add CONTRIBUTING section
- Fix issue when creating/updating .groovylintrc.js file when the VsCode Workspace has multiple folders
- Fix tabs navigation issue

### 0.3.0 2020-03-22

- Initial release