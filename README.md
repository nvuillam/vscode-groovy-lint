# VsCode GroovyLint (and fix!)

**Lint** and **fix** your groovy files and Jenkinsfile 

This [VsCode extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint) is based on [npm-groovy-lint](https://github.com/nvuillam/npm-groovy-lint#README) package, itself based on [CodeNarc](https://codenarc.github.io/CodeNarc/) groovy linter

Autofixing is still experimental, please post an [issue](https://github.com/nvuillam/vscode-groovy-lint/issues) if you detect any problem

![https://github.com/nvuillam/vscode-groovy-lint/raw/master/images/screenshot.png](https://github.com/nvuillam/vscode-groovy-lint/raw/master/images/screenshot.png)

## Features

| Command                         | Description                                                                                    | Access                                                                                                   |
|---------------------------------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| **Analyze code**                | Lint the code of the current tab                                                               | Ctrl+Shit+F9<br/>Editor contextual menu</br>Status bar<br/>Command pannel |
| **Fix all errors**              | Fix the code of the current tab                                                                | Ctrl+Shit+F10<br/>Editor contextual menu</br>Command pannel                                |
| Fix single error                | Apply quick fix for a single error                                                             | Quick Fix menu<br/>Diagnostic menu                                                 |
| Fix _errorType_ in file         | Apply quick fix for all errors of the same type in the currrent tab                            | Quick Fix menu<br/>Diagnostic menu                                                 |
| Ignore _errorType_ in all files | Updates configuration file (usually .groovylintrc.js in root folder) to ignore this error type | Quick Fix menu<br/>Diagnostic menu                                                 |

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

- Initial release of VsCode Groovy Lint

_See complete [CHANGELOG](https://github.com/nvuillam/vscode-groovy-lint/blob/master/CHANGELOG.md)_

-----------------------------------------------------------------------------------------------------------

