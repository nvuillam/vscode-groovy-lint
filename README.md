# VsCode Groovy Lint, Format and Fix

<!--
[![Badge for version for Visual Studio Code extension VsCode Groovy Lint](https://vsmarketplacebadge.apphb.com/version/NicolasVuillamy.vscode-groovy-lint.svg)](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
[![Badge for installs for Visual Studio Code extension VsCode Groovy Lint](https://vsmarketplacebadge.apphb.com/installs/NicolasVuillamy.vscode-groovy-lint.svg)](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
[![CircleCI](https://circleci.com/gh/nvuillam/vscode-groovy-lint/tree/master.svg?style=shield)](https://circleci.com/gh/nvuillam/vscode-groovy-lint/tree/master)
[![GitHub license](https://img.shields.io/github/license/nvuillam/vscode-groovy-lint.svg)](https://github.com/nvuillam/vscode-groovy-lint/blob/master/LICENSE) 
-->

**Lint** , **Format** and **Auto-fix** your groovy files and Jenkinsfile 

[Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint) embedding [npm-groovy-lint](https://github.com/nvuillam/npm-groovy-lint#README), itself embedding [CodeNarc](https://codenarc.github.io/CodeNarc/)

You can [configure the rules](https://github.com/nvuillam/npm-groovy-lint#configuration) by defining a `.groovylintrc.json` file

Formatting and Auto-fix are still in beta version, please post an [issue](https://github.com/nvuillam/vscode-groovy-lint/issues) if you detect any problem

![https://github.com/nvuillam/vscode-groovy-lint/raw/master/images/screenshot.png](https://github.com/nvuillam/vscode-groovy-lint/raw/master/images/screenshot.png)

## Features

| Command                         | Description                                                                                    | Access                                                                                                   |
|---------------------------------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| **Analyze code**                | Lint the code of the current tab                                                               | Ctrl+Shit+F9<br/>Contextual</br>Status bar<br/>Commands                                             |
| **Format**                      | Format the code of the current tab                                                             | Shift+Alt+F<br/>Contextual</br>Commands                                                           |
| **Fix all errors**              | Fix the code of the current tab                                                                | Ctrl+Shit+F10<br/>Contextual</br>Commands                                                           |
| Fix single error                | Apply quick fix for a single error                                                             | Quick Fix<br/>Diagnostic                                                                       |
| Fix _errorType_ in file         | Apply quick fix for all errors of the same type in the currrent tab                            | Quick Fix<br/>Diagnostic                                                                       |
| Ignore _errorType_ in all files | Updates configuration file<br/>(usually `.groovylintrc.js` in root folder) to ignore this error type) | Quick Fix<br/>Diagnostic                                                                       |

- Contextual: right click in the source code
- Commands: Ctrl+Shift+P then type command name
- Status bar: GroovyLint status item at the bottom right
- Quick Fix: Hover an underlined part of the code after a lint, click Quick Fix then select action to perform
- Diagnostic: Right click on a diagnostic in Problems section

## Extension Settings

| Parameter                        | Description                                                                                     | Default          |
|----------------------------------|-------------------------------------------------------------------------------------------------|------------------|
| `groovyLint.basic.enable`        | Controls whether GroovyLint is enabled or not                                                   | true             |
| `groovyLint.basic.run`           | Run the linter on save (onSave) or on type (onType)                                             | onSave           |
| `groovyLint.basic.autoFixOnSave` | Turns auto fix on save on or off                                                                | false            |
| `groovyLint.basic.loglevel`      | Linting error level (error, warning,info)                                                       | info             |
| `groovyLint.basic.verbose`       | Turn on to have verbose logs                                                                    | false            |
| `groovyLint.basic.config`        | [NPM groovy lint configuration file](https://github.com/nvuillam/npm-groovy-lint#configuration) | .groovylintrc.js |

## Known Issues

As CodeNarc is runned in background with java/groovy, performances could be improved on large files (do not hesitate to provide advices !)
But do not worry, as the groovy linting is provided by a background local server, your VsCode won't be slowed

## Contribute

Contributions are very welcome on :
- [VsCode Groovy Lint](https://github.com/nvuillam/vscode-groovy-lint)
- [NPM Groovy Lint](https://github.com/nvuillam/npm-groovy-lint) (linter called by this extension)

Please follow [Contribution instructions](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CONTRIBUTING.md)

## Release Notes

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
- Update README

### [0.4.0] 2020-03-23

- Upgrade to npm-groovy-lint v3.1.3
- Hide GroovyLint status bar item when the active VsCode file is not Groovy code (and if no GroovyLint action in progress)
- Add screenshot image in README
- Add CONTRIBUTING section
- Fix issue when creating/updating .groovylintrc.js file when the VsCode Workspace has multiple folders
- Fix tabs navigation issue

### 0.3.0 2020-03-22

- Initial release of VsCode Groovy Lint

_See complete [CHANGELOG](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CHANGELOG.md)_

-----------------------------------------------------------------------------------------------------------

