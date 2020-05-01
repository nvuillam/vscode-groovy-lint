## Change Log

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

### [0.9.5] 2020-04-29

- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v4.5.4
  - Take in account user overridden indentation space (and other rules) when using --format option [#31](https://github.com/nvuillam/npm-groovy-lint/issues/31)
  - Handle better CodeNarcServer concurrent calls

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

### [0.8.2] 2020-04-13

- New fix of [#18 _(codeAction failed with message: Cannot read property 'split' of undefined)_](https://github.com/nvuillam/vscode-groovy-lint/issues/18): error when diagnostics provided by another VsCode extension

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

### [0.6.3] 2020-04-03

- Improve QuickFix actions labels

### [0.6.2] 2020-04-02

- Warn user in case of fix error(s) failures, and advise to do so manually
- Improve QuickFix action performances
- Upgrade to [npm-groovy-lint](https://www.npmjs.com/package/npm-groovy-lint) v3.2.3
  - Improve performances
  - Fix indentation when rules IfStatementBraces or ElseBlockBraces are corrected during a format or a fix
- Fixes
  - Infinite spinner when using QuickFix "Fix in all file"

### [0.6.1] 2020-04-01

- Hotfix: republish again with regenerated compiled Javascript from Typescript

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
