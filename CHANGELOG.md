# Changelog

## [1.5.0] 2021-10-20
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v9.0.0
  - Upgrade to [CodeNarc 2.2](https://github.com/CodeNarc/CodeNarc/blob/master/CHANGELOG.md)
  - Adds [Groovy 3.0.9](http://groovy-lang.org/changelogs/changelog-3.0.9.html) support.

## [1.4.0] 2020-12-15

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v8.1.0
  - Exclude `UnnecessaryGetter`, `FactoryMethodName`, `MethodReturnTypeRequired`, and `GStringExpressionWithinString` in `recommended-jenkinsfile` ([#140](https://github.com/nvuillam/npm-groovy-lint/pull/140)) ([Felipe Santos](https://github.com/felipecrs))

## [1.3.0] 2020-11-15

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v8.0.0
  - Upgrade to CodeNarc 2.0.0
  - Improve performances
  - Fix bugs

## [1.2.8] 2020-09-04

- Upgrade [mocha](https://mochajs.org/) version ([#82](https://github.com/nvuillam/vscode-groovy-lint/pull/82))

## [1.2.7] 2020-09-04

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.5.4

## [1.2.6] 2020-09-02

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.5.2
- Fix crash when empty groovy file
- Fix crash when non-sense groovy file

## [1.2.4] 2020-08-29

- Add .nf and .gradle extensions
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.5.0

## [1.2.3] 2020-08-29

- Fix bug on Windows when username contains space(s)

## [1.2.2] 2020-08-21

- Allow user to hide future npm-groovy-lint error messages
- Manage correctly user choice `Never` for tabs auto-replacement by spaces
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.4.0

## [1.2.1] 2020-08-16

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.3.1

## [1.2.0] 2020-08-15

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.3.0
  - Allow to link to [CodeNarc RuleSet files](https://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html) from `.groovylintrc.json`, using property `"codenarcRulesets"`. Warning: doing so means that all other properties of config file will be ignored.

## [1.1.1] 2020-08-11

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.2.0
  - Upgrade[java-caller](https://www.npmjs.com/package/java-caller) to v2.0.0 : better performances

## [1.1.0] 2020-08-10

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.1.0
  - Externalize JavaCaller class into a separate package [java-caller](https://www.npmjs.com/package/java-caller) and use it

## [1.0.0] 2020-08-07

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v7.0.0
  - Upgrade to CodeNarc 1.6.1
  - Improved performances
  - Fix formatting
  - New default recommended rules

## [0.18.1] 2020-08-01

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.8.0
  - Fix part of [(#66)](https://github.com/nvuillam/vscode-groovy-lint/issues/66) Problem using on VSCode on macOS

## [0.18.0] 2020-07-12

- New settings **groovyLint.java.executable** and **groovyLint.java.options**
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.5.0
  - Allow to override java executable and options [(#54)](https://github.com/nvuillam/vscode-groovy-lint/issues/54)
  - Use os.EOL [(#65)](https://github.com/nvuillam/npm-groovy-lint/pull/65) solving  [(#63)](https://github.com/nvuillam/npm-groovy-lint/issues/63) --fix for indentation adds CRLF line-endings to all files it touches
  
## [0.17.1] 2020-07-05

Fixes:

- Fix npm-groovy-lint formatting arguments when loglevel is not **info**

## [0.17.0] 2020-07-01

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.4.1
  - CodeNarcServer listens to localhost only [(#59)](https://github.com/nvuillam/npm-groovy-lint/pull/59) solving [(#56)](https://github.com/nvuillam/npm-groovy-lint/issues/56)

## [0.16.4] 2020-06-04

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.1.0
  - Install Java 8 using node-jre in case java version found is higher than Java 11 (CodeNarc compatibility is Java 8 to 11)

## [0.16.3] 2020-05-30

- Fixes
  - Issue when requesting lints too quickly just after the extension is launched [(#51)](https://github.com/nvuillam/vscode-groovy-lint/issues/51)

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.0.3
  - Updated fix rules
    - Indentation
    - IndentationClosingBrace

## [0.16.2] 2020-05-27

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

## [0.16.0] 2020-25-05

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v5.0.0
  - **BIG BANG**: Improve performances, compatibility, architecture and delivery
    - Get rid of [jDeploy](https://github.com/shannah/jdeploy) dependency
      - Use own java-caller.js for java commands
      - Update CircleCI config to use `npm link`instead of `jdeploy install`
    - Get rid of [request](https://github.com/request/request) dependency
      - Use [axios](https://github.com/axios/axios) for promisified http calls

## [0.15.1] 2020-05-22

- Troubleshoot Java installation issue
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.14.0

## [0.15.0] 2020-05-21

- Use Indent size provided by VsCode Formatter API [#34](https://github.com/nvuillam/vscode-groovy-lint/issues/34)
- Add Formatter in Vs Code extension categories [#41](https://github.com/nvuillam/vscode-groovy-lint/issues/41)
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.13.0
  - Manage to send options for rules sent in `rulesets`: Ex: `Indentation{"spacesPerIndentLevel":2,"severity":"warning"},UnnecessarySemicolon`

## [0.14.0] 2020-05-18

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.12.0
  - Improve **performances** and **compatibility**

## [0.13.2] 2020-05-16

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.11.1
  - Improve error messages

## [0.13.1] 2020-05-12

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.11.0
  - Technical fixes

## [0.13.0] 2020-05-12

- New setting `groovyLint.insight.enable`: Allow to send anonymous usage statistics used only to improve the tool (we will of course never send your code or sensitive information)

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.10.2
  - Collect anonymous usage statistics using [analytics](https://www.npmjs.com/package/analytics) & [@analytics-segment](https://github.com/DavidWells/analytics/tree/master/packages/analytics-plugin-segment), in order to make new improvements based on how users use this package. Analytics obviously does not receive sensitive information like your code, as you can see in [analytics.js](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/analytics.js).

## [0.12.0] 2020-05-08

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.8.0
  - New fix rules
    - AssignmentInConditional
    - DuplicateImport
    - ExplicitLinkedListInstantiation
    - InsecureRandom
    - UnnecessaryDefInVariableDeclaration
    - UnnecessaryDotClass
    - UnnecessaryFinalOnPrivateMethod
    - UnnecessaryInstantiationToGetClass

  - Updated fix rules
    - BracesForForLoop: False positive triggering messy code after fixing
    - UnnecessaryGString: Fix multiline replacements ( `"""` by `'''` )

  - Fixes :
    - Launch JVM with high memory (`-Xms256m -Xmx2048m`) to improve performances on big files
    - Increase CodeNarcServ call timeout (+ Manage ETIMEOUT as result, not only ECONNREFUSED )

- Exclude more files from the VsCode extension package

## [0.11.0] 2020-05-06

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

## [0.10.0] 2020-05-01

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.6.0
  - New fix rules
    - SpaceBeforeClosingBrace
    - UnnecessaryDefInMethodDeclaration
    - UnnecessaryPackageReference
    - UnnecessaryParenthesesForMethodCallWithClosure

  - Updated fix rules
    - MisorderedStaticImports: Fix `@Grapes` killer fixing rule
    - ElseBlockBrace: issue when instruction is on the same line than `else`

## [0.9.5] 2020-04-29

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.5.4
  - Take in account user overridden indentation space (and other rules) when using --format option [#31](https://github.com/nvuillam/npm-groovy-lint/issues/31)
  - Handle better CodeNarcServer concurrent calls

## [0.9.4] 2020-04-28

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.5.0 [Davide Bizzarri](https://github.com/b1zzu)
  - Configuration updates ([#29](https://github.com/nvuillam/npm-groovy-lint/issues/29)):
    - New default config "recommended-jenkinsfile". Use it with argument `--config recommended-jenkinsfile`
    - Allow to directly target a config file name. Use it with argument `--config /my/custom/path/.groovylintrc-custom-name.json`
    - Allow to send a string key that will be used to find config file `--config custom-name`
  - Updated fix rules:
    - IfStatementBraces
    - ElseStatementBraces

## [0.9.3] 2020-04-22

- Fixes
  - Crash when apply QuickFix after disabling an error with a comment
  - Error when groovylint-disable and groovylint-disable-next-line are both at the beginning of the source file
  - Decrease delay before onType lint from 4 seconds to 3 seconds
  - Misspellings

## [0.9.2] 2020-04-21

- Hotfix crazy status bar item ([#26](https://github.com/nvuillam/vscode-groovy-lint/pull/26))

## [0.9.1] 2020-04-20

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.4.1
  - CodeNarcServer: Use cachedThreadPool instead of fixedThreadPool

## [0.9.0] 2020-04-17

- **Default lint mode to "onType"** (use onSave or user if you prefer to not lint while typing), after 4 seconds of inactivity after last source update
- New contextual commands:
  - **Disable rule for the current line**
  - **Disable rule for the entire file**
- Do not open files in tabs when diagnostics are from Lint Folder command
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.4.0
  - [Disable rules using comments in source](https://github.com/nvuillam/npm-groovy-lint#disabling-rules-in-source) using [eslint style](https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)
  - Cancel a CodeNarc Lint when a similar CodeNarcServer request is received (allowing onType mode for language servers)

## [0.8.2] 2020-04-13

- New fix of [#18 _(codeAction failed with message: Cannot read property 'split' of undefined)_](https://github.com/nvuillam/vscode-groovy-lint/issues/18): error when diagnostics provided by another VsCode extension

## [0.8.1] 2020-04-13

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.2.0
  - Display **source parsing errors**
  - New fix rules (thanks [CatSue](https://github.com/CatSue) !):
    - SpaceAfterSemicolon
    - SpaceAfterWhile
- Remove useless files from VsCode extension package

## [0.7.2] 2020-04-12

- Fix error [#18 _(codeAction failed with message: Cannot read property 'split' of undefined)_](https://github.com/nvuillam/vscode-groovy-lint/issues/18)
- Add more automated tests for CodeActions
- Display a waiting info message when a Lint Folder request takes more than 5 seconds + allow to cancel the current operation
- Fix perf issue when closing all visible text editors
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.1.0
  - Upgrade to [Groovy 3.0.3](https://dl.bintray.com/groovy/maven/apache-groovy-binary-3.0.3.zip)

## [0.7.1] 2020-04-09

- Add setting **groovyLint.debug.enable** : Display more logs in VsCode Output panel (select "GroovyLint") for issue investigation
- Update settings definition in README documentation

## [0.7.0] 2020-04-08

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

## [0.6.3] 2020-04-03

- Improve QuickFix actions labels

## [0.6.2] 2020-04-02

- Warn user in case of fix error(s) failures, and advise to do so manually
- Improve QuickFix action performances
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.3
  - Improve performances
  - Fix indentation when rules IfStatementBraces or ElseBlockBraces are corrected during a format or a fix
- Fixes
  - Infinite spinner when using QuickFix "Fix in all file"

## [0.6.1] 2020-04-01

- Hotfix: republish again with regenerated compiled Javascript from Typescript

## [0.6.0] 2020-03-31

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

## [0.5.3] 2020-03-29

- New diagnostic QuickAction: Show rule documentation
- Fix location error to create .groovylintrc.json from a QuickFix when user has multiple workspaces
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.1

## [0.5.0] 2020-03-26

- New command "Format" (Right click in code editor -> format, or Shift+Alt+F)
- [Automated tests](https://github.com/nvuillam/vscode-groovy-lint/blob/master/client/src/test/suite/extension.test.ts) with mocha and vscode-test
- [CI Integration (CircleCI)](https://app.circleci.com/pipelines/github/nvuillam/vscode-groovy-lint), build & run tests on Linux & Windows
- If hidden, show Diagnostics panel after first lint result. If closed again by the user, it won't be reopened
- Update README (doc + badges)
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.0
- Fixes
  - Tab focus should not be disrupted by VsCode Groovy Lint

## [0.4.1] 2020-03-23

- Fix blocking issue when using QuickFix Action (source was not replaced). If someone knows how to make good automated tests for a VsCode extension, please contact me !
- Change README

## [0.4.0] 2020-03-23

- Upgrade to npm-groovy-lint v3.1.3
- Hide GroovyLint status bar item when the active VsCode file is not Groovy code (and if no GroovyLint action in progress)
- Add screenshot image in README
- Add CONTRIBUTING section
- Fix issue when creating/updating .groovylintrc.js file when the VsCode Workspace has multiple folders
- Fix tabs navigation issue

## 0.3.0 2020-03-22

- Initial release
