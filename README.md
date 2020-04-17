# VsCode Groovy Lint, Format and Fix

[![Version](https://vsmarketplacebadge.apphb.com/version/NicolasVuillamy.vscode-groovy-lint.svg)](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/NicolasVuillamy.vscode-groovy-lint.svg)](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
[![Build](https://circleci.com/gh/nvuillam/vscode-groovy-lint/tree/master.png?style=shield)](https://circleci.com/gh/nvuillam/vscode-groovy-lint/tree/master)
[![codecov](https://codecov.io/gh/nvuillam/vscode-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/vscode-groovy-lint)
[![License](https://img.shields.io/github/license/nvuillam/vscode-groovy-lint.png)](https://github.com/nvuillam/vscode-groovy-lint/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/vscode-groovy-lint.png?label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/vscode-groovy-lint/stargazers/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.png?style=flat-square)](http://makeapullrequest.com)

**Lint** (code quality), **Format** and **Auto-fix** your groovy files and Jenkinsfile 

[Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint) embedding [npm-groovy-lint](https://github.com/nvuillam/npm-groovy-lint#README), itself embedding [CodeNarc](https://codenarc.github.io/CodeNarc/)

You can [configure the rules](https://github.com/nvuillam/npm-groovy-lint#configuration) by defining a `.groovylintrc.json` file

Formatting and Auto-fix are still in beta version, please post an [issue](https://github.com/nvuillam/vscode-groovy-lint/issues) if you detect any problem

![https://github.com/nvuillam/vscode-groovy-lint/raw/master/images/vscode-anim.gif](https://github.com/nvuillam/vscode-groovy-lint/raw/master/images/vscode-anim.gif)

## Features

| Command                                | Description                                                                                      | Access                                                                                                   |
|----------------------------------------|--------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| **Analyze code**                       | Lint the code of the current file                                                                 | Ctrl+Shit+F9<br/>Contextual</br>Status bar<br/>Commands                                                  |
| **Format**                             | Format the code of the current file                                                               | Shift+Alt+F<br/>Contextual</br>Commands                                                                  |
| **Fix all auto-fixable problems**      | Fix the code of the current file                                                                | Contextual</br>Commands                                                                                  |
| **Lint folder**                        | Lint all applicable files of a folder                                                            | Contextual                                                                                               |
| Fix single error                       | Apply quick fix for a single problem                                                               | Quick Fix<br/>Diagnostic                                                                                 |
| Fix _rule_ in entire file              | Apply quick fix for all problems related to the same rule in the current file                              | Quick Fix<br/>Diagnostic                                                                                 |
| Disable _rule_ for this line           | Disable rule only for current line                                                               | Quick Fix<br/>Diagnostic                                                                                 |
| Disable _rule_ for this entire file    | Disable rule in the entire file                                                                  | Quick Fix<br/>Diagnostic                                                                                 |
| Disable _rule_ for this entire project | Updates configuration file<br/>(usually `.groovylintrc.js` in root folder) to disable this rule) | Quick Fix<br/>Diagnostic                                                                                 |

- ***Contextual***: *right click in source code or on folder*
- ***Commands***: *Ctrl+Shift+P then type command name*
- ***Status bar***: *GroovyLint status item at the bottom right*
- ***Quick Fix***: *Hover an underlined part of the code after a lint, click Quick Fix then select action to perform*
- ***Diagnostic***: *Right click on a diagnostic in Problems section*

## Extension Settings

| Parameter                        | Description                                                                                     | Default          |
|----------------------------------|-------------------------------------------------------------------------------------------------|------------------|
| `groovyLint.enable`              | Controls whether GroovyLint is enabled or not                                                   | true             |
| `groovyLint.lint.trigger`        | Run the linter on save (onSave), on type (onType) , or on user request                          | onSave           |
| `groovyLint.format.enable`       | Controls whether the groovy formatter is enabled or not                                         | true             |
| `groovyLint.fix.enable`          | Run the auto-fixer on save (onSave), on type (onType) , or on user request                      | true             |
| `groovyLint.fix.trigger`         | Run the fixer on save (onSave), or on user request                                              | user             |
| `groovyLint.basic.loglevel`      | Linting error level (error, warning,info)                                                       | info             |
| `groovyLint.basic.verbose`       | Turn on to have verbose logs                                                                    | false            |
| `groovyLint.basic.config`        | [NPM groovy lint configuration file](https://github.com/nvuillam/npm-groovy-lint#configuration) | .groovylintrc.js |
| `groovyLint.debug.enable`        | Display more logs in VsCode Output panel (select "GroovyLint") for issue investigation          | false            |

## Known Issues

- Node.js >= 12 is required to run this package. If you can't upgrade, you can use [nvm](https://github.com/nvm-sh/nvm) to have [different node versions on your computer](https://www.sitepoint.com/quick-tip-multiple-versions-node-nvm/)

- As CodeNarc is run in background with java/groovy, performances could be improved on large files (do not hesitate to provide advices !)
But do not worry, as the groovy linting is provided by a background local server, your VsCode won't be slowed. 

## Contribute

Contributions are very welcome on :
- [VsCode Groovy Lint](https://github.com/nvuillam/vscode-groovy-lint)
- [NPM Groovy Lint](https://github.com/nvuillam/npm-groovy-lint) (linter called by this extension)

Please follow [Contribution instructions](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CONTRIBUTING.md)

## Special Thanks

- [yuvmel](https://github.com/yuvmel), for his great support on [#18](https://github.com/nvuillam/vscode-groovy-lint/issues/18) that allowed VsCode Groovy Lint to work much better on Mac, Linux, and with other diagnostic extensions 

## Release Notes

### [0.9.0] 2020-04-17

- **Default lint mode to "onType"** (use onSave or user if you prefer to not lint while typing), after 4 seconds of inactivity after last source update
- New contextual commands: 
  - **Disable rule for the current line**
  - **Disable rule for the entire file**
- Do not open files in tabs when diagnostics are from Lint Folder command
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.4.0
  - [Disable rules using comments in source](https://github.com/nvuillam/npm-groovy-lint#disabling-rules-in-source) using [eslint style](https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)
  - Cancel a CodeNarc Lint when a similar CodeNarcServer request is received (allowing onType mode for language servers)
  
### [0.8.1] 2020-04-13

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.2.0
  - Display **source parsing errors**
  - New fix rules (thanks [CatSue](https://github.com/CatSue) !):
    - SpaceAfterSemicolon 
    - SpaceAfterWhile
- Remove useless files from VsCode extension package

### [0.7.2] 2020-04-12

- Fix error [#18 _(codeAction failed with message: Cannot read property 'split' of undefined)_](https://github.com/nvuillam/vscode-groovy-lint/issues/18)
- Add more automated tests for CodeActions
- Display a waiting info message when a Lint Folder request takes more than 5 seconds + allow to cancel the current operation
- Fix perf issue when closing all visible text editors
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.1.0
  - Upgrade to [Groovy 3.0.3](https://dl.bintray.com/groovy/maven/apache-groovy-binary-3.0.3.zip)

### [0.7.1] 2020-04-09

- Add setting **groovyLint.debug.enable** : Display more logs in VsCode Output panel (select "GroovyLint") for issue investigation
- Update settings definition in README documentation

### [0.7.0] 2020-04-08

- New command **Lint Groovy in folder** available in folder context menu
- Performances: avoid to lint again a file if it has already been linter with the same content
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.0.0
  - **Much better performances on Linux and MacOs**
  - When formatting, always run some custom npm-groovy-lint fix rules not corresponding to CodeNarc violations
  - Return CodeNarc and Groovy versions when --version options is called
  - Fixes
    - Lost indentation when applying some fix rules
  - Updated fix rules:
    - IndentationClosingBraces
    - IndentationComments
    - SpaceAfterCatch
    - SpaceAfterIf
  - New fix rules:
    - ClassEndsWithBlankLine
    - ClassStartsWithNewLine
    - SpaceAfterFor
    - SpaceAfterSwitch
- Add Jenkinsfile in test files

### [0.6.2] 2020-04-02

- Warn user in case of fix error(s) failures, and advise to do so manually
- Improve QuickFix action performances
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.3
  - Improve performances
  - Fix indentation when rules IfStatementBraces or ElseBlockBraces are corrected during a format or a fix
- Fixes
  - Infinite spinner when using QuickFix "Fix in all file"

### [0.6.0] 2020-03-31

- New animated gif for [VsCode Groovy Lint home page](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
- Increase size of **Show rule documentation** quick action message, and add a "Read More" link to CodeNarc WebSite
- If source has been updated by the user during a format or fix, do not apply the formatting/fix to avoid overriding the user updates, and notify the user

- Fixes:
  - Provide CodeActions even when there is no QuickFix (Ignore in all files, Show documentation)
  - Fix npm-groovy-lint requests queue management
  - If a file contains groovy errors, display info diagnostic while linting/formatting/fixing again
  - Fix "infinite" status bar spinner when a lint/format/fix actions has been cancelled
- Technical:
  - Harmonize notifications URIS with new namespace: groovylintlsp
  - Reorganize files: types.ts for structures, and mode commands in commands.ts
  - Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.2

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

