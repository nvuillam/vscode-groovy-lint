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

### [0.11.0] 2020-05-06

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.7.0
  - New fix rules
    - BracesForClass
    - BracesForForLoop
    - BracesForIfElse
    - BracesForMethod
    - BracesForTryCatchFinally
    - ExplicitArrayListInstantiation
    - MissingBlankLineAfterImports
    - MissingBlankLineAfterPackage

  - Updated fix rules
    - UnnecessaryGString: Fix replacements containing `\n` and `\r`

### [0.10.0] 2020-05-01

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.6.0
  - New fix rules
    - SpaceBeforeClosingBrace
    - UnnecessaryDefInMethodDeclaration
    - UnnecessaryPackageReference
    - UnnecessaryParenthesesForMethodCallWithClosure

  - Updated fix rules
    - MisorderedStaticImports: Fix `@Grapes` killer fixing rule
    - ElseBlockBrace: issue when instruction is on the same line than `else`

### [0.9.4] 2020-04-28

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.5.0 [Davide Bizzarri](https://github.com/b1zzu)
  - Configuration updates ([#29](https://github.com/nvuillam/npm-groovy-lint/issues/29)):
    - New default config "recommended-jenkinsfile". Use it with argument `--config recommended-jenkinsfile`
    - Allow to directly target a config file name. Use it with argument `--config /my/custom/path/.groovylintrc-custom-name.json`
    - Allow to send a string key that will be used to find config file `--config custom-name`
  - Updated fix rules:
    - IfStatementBraces
    - ElseStatementBraces

### [0.9.3] 2020-04-22

- Fixes
  - Crash when apply QuickFix after disabling an error with a comment
  - Error when groovylint-disable and groovylint-disable-next-line are both at the beginning of the source file
  - Decrease delay before onType lint from 4 seconds to 3 seconds
  - Misspellings

### [0.9.2] 2020-04-21

- Hotfix crazy status bar item ([#26](https://github.com/nvuillam/vscode-groovy-lint/pull/26))

### [0.9.1] 2020-04-20

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.4.1
  - CodeNarcServer: Use cachedThreadPool instead of fixedThreadPool

### [0.9.0] 2020-04-17

- **Default lint mode to "onType"** (use onSave or user if you prefer to not lint while typing), after 4 seconds of inactivity after last source update
- New contextual commands:
  - **Disable rule for the current line**
  - **Disable rule for the entire file**
- Do not open files in tabs when diagnostics are from Lint Folder command
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.4.0
  - [Disable rules using comments in source](https://github.com/nvuillam/npm-groovy-lint#disabling-rules-in-source) using [eslint style](https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)
  - Cancel a CodeNarc Lint when a similar CodeNarcServer request is received (allowing onType mode for language servers)
  
### PREVIOUS VERSIONS

See complete [CHANGELOG](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CHANGELOG.md)

-----------------------------------------------------------------------------------------------------------
