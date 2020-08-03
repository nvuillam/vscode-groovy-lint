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
| `groovyLint.basic.config`        | [NPM groovy lint configuration file](https://github.com/nvuillam/npm-groovy-lint#configuration) | .groovylintrc.json |
| `groovyLint.debug.enable`        | Display more logs in VsCode Output panel (select "GroovyLint") for issue investigation          | false            |
| `groovyLint.java.executable`     | Override java executable to use <br/>Example: C:\\Program Files\\Java\\jdk1.8.0_144\\bin\\java.exe          | java            |
| `groovyLint.java.options`        | Override java options to use                                                                    | "-Xms256m,-Xmx2048m"            |
| `groovyLint.insight.enable`      | Allow to send anonymous usage statistics used only to improve the tool (we will of course never send your code)   | true            |

## Troubleshooting

- [**Node.js**](https://nodejs.org) version **12 or higher** is required to run this extension. If you can't upgrade, you can use [nvm](https://github.com/nvm-sh/nvm) to have [different node versions on your computer](https://www.sitepoint.com/quick-tip-multiple-versions-node-nvm/)

- [**Java**](https://www.java.com/download) version **8 or higher** is required to run this extension

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

### [0.18.1] 2020-08-01

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.8.0
  - Fix part of [(#66)](https://github.com/nvuillam/vscode-groovy-lint/issues/66) Problem using on VSCode on macOS

### [0.18.0] 2020-07-12

- New settings **groovyLint.java.executable** and **groovyLint.java.options**
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.5.0
  - Allow to override java executable and options [(#54)](https://github.com/nvuillam/vscode-groovy-lint/issues/54)
  - Use os.EOL [(#65)](https://github.com/nvuillam/npm-groovy-lint/pull/65) solving  [(#63)](https://github.com/nvuillam/npm-groovy-lint/issues/63) --fix for indentation adds CRLF line-endings to all files it touches

### [0.17.1] 2020-07-05

Fixes:

- Fix npm-groovy-lint formatting arguments when loglevel is not **info**

### [0.17.0] 2020-07-01

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.4.1
  - CodeNarcServer listens to localhost only [(#59)](https://github.com/nvuillam/npm-groovy-lint/pull/59) solving [(#56)](https://github.com/nvuillam/npm-groovy-lint/issues/56)

### [0.16.4] 2020-06-04

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.1.0
  - Install Java 8 using node-jre in case java version found is higher than Java 11 (CodeNarc compatibility is Java 8 to 11)

### [0.16.3] 2020-05-30

- Fixes
  - Issue when requesting lints too quickly just after the extension is launched [(#51)](https://github.com/nvuillam/vscode-groovy-lint/issues/51)

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.0.3
  - Updated fix rules
    - Indentation
    - IndentationClosingBrace

### [0.16.2] 2020-05-27

- Fixes
  - When a rule is ignored for all project (updating .groovylintrc.json), lint again all open documents [(#46)](https://github.com/nvuillam/vscode-groovy-lint/issues/47)
  - Setting `groovyLint.fix.trigger` was not updateable [(#47)](https://github.com/nvuillam/vscode-groovy-lint/issues/47)
  - After applying a QuickFix, wait for the text to be updated to trigger a new code analysis
  - Better catch and display of fatal errors

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.0.2
  - Avoid to apply wrong fix in case of CodeNarc false positive
  - New fix rules
    - BlankLineBeforePackage
  - Updated fix rules
    - BracesForIfElse
    - BracesForMethod
    - BracesForTryCatchFinally
    - ClassEndsWithBlankLine
    - ClassStartsWithBlankLine
    - MissingBlankLineAfterImports
    - MissingBlankLineAfterPackage
    - UnnecessaryGroovyImport
    - UnusedImport

### [0.16.0] 2020-05-25

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.0.0
  - **BIG BANG**: Improve performances, compatibility, architecture and delivery
    - Get rid of [jDeploy](https://github.com/shannah/jdeploy) dependency
      - Use own [java-caller.js](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/java-caller.js) for java commands
      - Update CircleCI config to use `npm link`instead of `jdeploy install`
    - Get rid of [request](https://github.com/request/request) dependency
      - Use [axios](https://github.com/axios/axios) for promisified http calls

### PREVIOUS VERSIONS

See complete [CHANGELOG](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CHANGELOG.md)

-----------------------------------------------------------------------------------------------------------
