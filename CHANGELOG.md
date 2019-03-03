# Change Log
All notable changes to AoE II AI Tools will be documented in this file.

## [0.1.3]
1. References
   - Added reference functionality (only works with constants)
2. Syntax Highlighting
   - Fixed a few issues with syntax highlighting (regarding coloring indentifiers)

3. Package Version
   - Updated dependencies to latest version (mocha, @types/node)
4. Commands/Actions
   - Added functionality for the ```aoe2ai.editor.viewConstantUsage``` command (Codelens-only)
   - Command ```aoe2ai.editor.viewConstantMisuse``` was scrapped
5. Settings/Configuration
   - 

## [0.1.2]
 1. Package Version
    - Updated VSCode engine to 1.1.30
    - Update all other dependencies to the latest version
 2. Linter updates
    - Added ERR2012 for when constants are redefined
    - Added ERR2008 for when an arrow is missing from a rule
 3. Codelens Support
    - Added basic processing logic for code lens. Only supports constant-based actions as of right now
 4. Commands
    - Added ```aoe2ai.editor.viewConstantUsage``` for viewing direct usage (references) of a given constant (name is used as a parameter)
    - Added ```aoe2ai.editor.viewConstantMisuse``` for viewing redefining (new value) references to a give constant (same as above)
    - Make the above commands use a placeholder instead of actually doing the expected. The placeholder will be removed when v0.1.3 of this extension is released (by that time, adequate R&D will guarantee that the commands are properly implemented)
 


## [0.1.1]
 1. Content Update
    - Made syntax support changes to improve the quality of this extension
    - Added 3 new snippets
    - Added coloring for age techs i.e. dark-age, feudal-age, etc.
    - Added more detail to the readme to accurately represent the progress made on this extension
    - Added support for 1 fact: ```can-sell-commodity```
    - 


## [0.1.0]
- Initial release