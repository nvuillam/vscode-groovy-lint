# VsCode GroovyLint (and fix!)

**Lint**, **fix** and **format** your groovy files and Jenkinsfile 

This extension is based on npm-groovy-lint package, itself based on CodeNarc groovy linter

 ** Alpha version **

## Features

  - **Lint** Groovy files and Jenkinsfile: `GroovyLint: Lint`
  - **Fix** errors: `GroovyLint: Fix`
  - **Format** sources: `GroovyLint: Format`
  - Configure linted and fixed rules

## Extension Settings

* `groovyLint.enable`: enable/disable this extension
* `groovyLint.run`: autorun lint on open/save file (recommended) or on edit file
* `groovyLint.autoFixOnSave`: Turns auto fix on save on or off
* `groovyLint.loglevel`: Severity log level ( error, warning, info)
* `groovyLint.ruleSetGroovy`: RuleSet to use to lint Groovy files
* `groovyLint.ruleSetJenkinsfile`: RuleSet to use to lint Jenkinsfile
* `groovyLint.verbose`: Verbose output logs (mostly for debugging)

## Known Issues

As CodeNarc is runned in background with java/groovy, performances could be improved (do not hesitate to provide advices !)
But do not worry, as the groovy linting is provided by a background local server, your VsCode won't be slowed

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

-----------------------------------------------------------------------------------------------------------

