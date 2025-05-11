<!-- markdownlint-disable MD033 -->
# VsCode Groovy Lint, Format and Fix

[![Visual Studio Marketplace Version (including pre-releases)](https://img.shields.io/visual-studio-marketplace/v/NicolasVuillamy.vscode-groovy-lint)](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/NicolasVuillamy.vscode-groovy-lint)](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
[![Test](https://github.com/nvuillam/vscode-groovy-lint/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/nvuillam/vscode-groovy-lint/actions/workflows/test.yml)
[![Mega-Linter](https://github.com/nvuillam/vscode-groovy-lint/actions/workflows/mega-linter.yml/badge.svg?branch=main)](https://github.com/nvuillam/vscode-groovy-lint/actions/workflows/mega-linter.yml)
[![License](https://img.shields.io/github/license/nvuillam/vscode-groovy-lint.png)](https://github.com/nvuillam/vscode-groovy-lint/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/vscode-groovy-lint.png?label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/vscode-groovy-lint/stargazers/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.png?style=flat-square)](https://makeapullrequest.com)

**Lint** (code quality), **Format** and **Auto-fix** your groovy files and Jenkinsfile

[Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint) embedding [npm-groovy-lint](https://github.com/nvuillam/npm-groovy-lint#README), itself embedding [CodeNarc](https://codenarc.github.io/CodeNarc/)

- You can [configure the rules](https://github.com/nvuillam/npm-groovy-lint#configuration) by defining a `.groovylintrc.json` file
- If you use **CI**, you can integrate [Mega-Linter](https://github.com/nvuillam/mega-linter#readme) in your workflow, to **make sure all your sources (groovy and other) are clean**

![image](https://github.com/nvuillam/vscode-groovy-lint/raw/main/images/vscode-anim.gif)

## Features

| Command                                | Description                                                                                     | Access                                                   |
|----------------------------------------|-------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| **Analyze code**                       | Lint the code of the current file                                                               | Ctrl+Shift+F9<br/>Contextual</br>Status bar<br/>Commands |
| **Format**                             | Format the code of the current file                                                             | Shift+Alt+F<br/>Contextual</br>Commands                  |
| **Fix all auto-fixable problems**      | Fix the code of the current file                                                                | Contextual</br>Commands                                  |
| **Lint folder**                        | Lint all applicable files of a folder                                                           | Contextual                                               |
| Fix single error                       | Apply quick fix for a single problem                                                            | Quick Fix<br/>Diagnostic                                 |
| Fix _rule_ in entire file              | Apply quick fix for all problems related to the same rule in the current file                   | Quick Fix<br/>Diagnostic                                 |
| Disable _rule_ for this line           | Disable rule only for current line                                                              | Quick Fix<br/>Diagnostic                                 |
| Disable _rule_ for this entire file    | Disable rule in the entire file                                                                 | Quick Fix<br/>Diagnostic                                 |
| Disable _rule_ for this entire project | Updates configuration file<br/>(usually `.groovylintrc.js` in root folder) to disable this rule | Quick Fix<br/>Diagnostic                                 |

- _**Contextual**_: *right click in source code or on folder_
- _**Commands**_: *Ctrl+Shift+P then type command name_
- _**Status bar**_: _GroovyLint status item at the bottom right_
- _**Quick Fix**_: _Hover an underlined part of the code after a lint, click Quick Fix then select action to perform_
- _**Diagnostic**_: _Right click on a diagnostic in Problems section_

## Extension Settings

| Parameter                     | Description                                                                                                     | Default              |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------|----------------------|
| `groovyLint.enable`           | Controls whether GroovyLint is enabled or not                                                                   | true                 |
| `groovyLint.lint.trigger`     | Run the linter on save (onSave), on type (onType) , or on user request                                          | onSave               |
| `groovyLint.format.enable`    | Controls whether the groovy formatter is enabled or not                                                         | true                 |
| `groovyLint.fix.enable`       | Run the auto-fixer on save (onSave), on type (onType) , or on user request                                      | true                 |
| `groovyLint.fix.trigger`      | Run the fixer on save (onSave), or on user request                                                              | user                 |
| `groovyLint.basic.loglevel`   | Linting error level (error, warning,info)                                                                       | info                 |
| `groovyLint.basic.verbose`    | Turn on to have verbose logs                                                                                    | false                |
| `groovyLint.basic.config`     | [NPM groovy lint configuration file](https://github.com/nvuillam/npm-groovy-lint#configuration)                 | .groovylintrc.json   |
| `groovyLint.debug.enable`     | Display more logs in VsCode Output panel (select "GroovyLint") for issue investigation                          | false                |
| `groovyLint.java.executable`  | Override java executable to use <br/>Example: C:\\Program Files\\Java\\jdk1.8.0_144\\bin\\java.exe              | java                 |
| `groovyLint.java.options`     | Override java options to use                                                                                    | "-Xms256m,-Xmx2048m" |
| `groovyLint.insight.enable`   | Allow to send anonymous usage statistics used only to improve the tool (we will of course never send your code) | false                |
| `groovyLint.showProblemsView` | Show Problems View once after start                                                                             | false                |

## Troubleshooting

- [**Node.js**](https://nodejs.org) version **18 or higher** is required to run this extension. If you can't upgrade, you can use [nvm](https://github.com/nvm-sh/nvm) to have [different node versions on your computer](https://www.sitepoint.com/quick-tip-multiple-versions-node-nvm/)

- [**Java**](https://www.java.com/en/download/) version **17 or higher** is required to run this extension

- As CodeNarc is run in background with java/groovy, performances could be improved on large files (do not hesitate to provide advices !)
But do not worry, as the groovy linting is provided by a background local server, your VsCode won't be slowed.

## Contribute

Contributions are very welcome on :

- [VsCode Groovy Lint](https://github.com/nvuillam/vscode-groovy-lint)
- [NPM Groovy Lint](https://github.com/nvuillam/npm-groovy-lint) (linter called by this extension)

Please follow [Contribution instructions](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CONTRIBUTING.md)

## Special Thanks

- [stevenh](https://github.com/stevenh), for his huge refactoring of npm-groovy-lint and vscode-groovy-lint, saving them from deprecation :)

- [yuvmel](https://github.com/yuvmel), for his great support on [#18](https://github.com/nvuillam/vscode-groovy-lint/issues/18) that allowed VsCode Groovy Lint to work much better on Mac, Linux, and with other diagnostic extensions

## Release Notes

See [CHANGELOG](https://github.com/nvuillam/vscode-groovy-lint/blob/main/CHANGELOG.md)