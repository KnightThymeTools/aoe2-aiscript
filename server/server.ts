import { DocumentSymbolParams, Position, Range, CancellationToken, WorkspaceSymbolParams, ReferenceParams, Location, CodeLensParams, CodeLens, Command, ExecuteCommandRequest } from 'vscode-languageclient';
import { CompletionItem, CompletionItemKind, createConnection, Diagnostic, Hover, DiagnosticSeverity, DidChangeConfigurationNotification, InitializeParams, ParameterInformation, ProposedFeatures, SignatureHelp, SignatureInformation, TextDocument, TextDocumentPositionParams, TextDocuments, DocumentSymbol, SymbolInformation } from 'vscode-languageserver';
import { SymbolKind } from './lib/SymbolKind';


// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability =
        capabilities.workspace && !!capabilities.workspace.configuration;
    hasWorkspaceFolderCapability =
        capabilities.workspace && !!capabilities.workspace.workspaceFolders;
    hasDiagnosticRelatedInformationCapability =
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation;

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            // Tell the client that the server supports code completion
            completionProvider: {
                resolveProvider: true,
                triggerCharacters:[' ','(']
            },
            signatureHelpProvider: {
                triggerCharacters:[' ']
            },
            workspaceSymbolProvider: true,
            referencesProvider: true,
            hoverProvider: true,
            codeLensProvider: {
                resolveProvider: true
            }
        }
    };
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

connection.onReferences((params: ReferenceParams): Location[] => {
    let refLocations: Location[] = [];
    let startPos: Position = params.position;
    let doc = documents.get(params.textDocument.uri);
    let docText = doc.getText();
    let docLines = docText.split("\n");
    let docText_L = docLines[startPos.line];
    let constChecker = /\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/;
    let constMatches = docText_L.match(constChecker);
    if (constMatches.length > 0){
        let const_name = constMatches[2];
        if(docConstants !== undefined){
            if(docConstants[doc.uri][const_name] !== undefined){
                docLines.forEach((line,line_i) => {
                    let constFind = line.indexOf(const_name);
                    if(constFind > -1 && !constChecker.test(line)){
                        let startLine = line.indexOf(const_name)
                        let loc: Location = {
                            uri: doc.uri,
                            range: {
                                start: {
                                    line: line_i,
                                    character: 0
                                },
                                end: {
                                    line: line_i,
                                    character: line.length - 1
                                }
                            }
                        }
                        refLocations.push(loc);
                    }
                })
            }
        }
    }
    return refLocations;
});


connection.onWorkspaceSymbol((params: WorkspaceSymbolParams): SymbolInformation[] => {
    connection.console.log(params.query);
    let symbols: SymbolInformation[] = [];
    let symbolExp = new RegExp("\\((defconst)\\s([\\w\\-]+)\\s(\\-?\\d+)(?=\\))");
    let lineList = [];
    let docs = documents.all();
    docs.forEach(doc => {
        let docContents = doc.getText();
        let docContentsArray = docContents.split(new RegExp("\n"));
        docContentsArray.forEach((line, index) => {
            let matches = symbolExp.exec(line);
            if (matches){
                matches.forEach(match => {
                    connection.console.log(match);
                });
                lineList.push({line: line, name: matches[2], index: index});
              /**   symbols.push({
                    name: matches[1],
                    kind: SymbolKind.Variable,
                    location: {
                        uri: doc.uri,
                        range: {
                            start: {
                                line: index,
                                character: 0
                            },
                            end: {
                                line: index,
                                character: line.length - 1
                            }
                        }
                    }
                    });
                    */
            }
        });
        lineList.forEach((line, index) => {
            connection.console.log(line.line);
            if (line.line.search(params.query) !== -1){
                symbols.push({
                    name: line.name,
                    kind: SymbolKind.Variable,
                    location: {
                        uri: doc.uri,
                        range: {
                            start: {
                                line: line.index,
                                character: 0
                            },
                            end: {
                                line: line.index,
                                character: line.line.length - 1
                            }
                        }
                    }
                });
            }
        });
    });
    
    return symbols;
})
/** 
connection.onDocumentSymbol((params: DocumentSymbolParams, token: CancellationToken): SymbolInformation[] => {
    let symbols: SymbolInformation[] = [];
  

    return symbols;
});
} catch (ex) {
    connection.console.log(ex);
}
*/


// The example settings
interface AOE2AIOptions {
    ruleCounterEnabled: boolean;
    codelensSupportEnabled: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: AOE2AIOptions = { ruleCounterEnabled: true, codelensSupportEnabled: true };
let globalSettings: AOE2AIOptions = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<AOE2AIOptions>> = new Map();

interface Features{
    codelens?: boolean;
}

let feats: Features = {

}

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        globalSettings = <AOE2AIOptions>(
            (change.settings.aoe2ai || defaultSettings)
        );
        feats.codelens = globalSettings.codelensSupportEnabled;
    }
    
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<AOE2AIOptions> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'aoe2ai'
        });
        documentSettings.set(resource, result);
        
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});


enum RuleSectionType {
    Facts,
    Actions,
    None
}

interface RuleConditionState {
    DefiningRule: boolean;
    EndingRule: boolean;
    DefiningCondOp: boolean;
    EndingCondOp: boolean;
    HasArrow: boolean;
    RuleSection: RuleSectionType;
}

interface SyntaxRange {
    Start: Position;
    End: Position | null;
}

interface RuleStatistics {
    Lines: number;
    CondOpLines: number;
    CondOpRanges: SyntaxRange[];
    StartPosition: Position;
    EndPosition: Position;
}

enum ParenthesisDirection {
    Open,
    Closed,
    None
};

interface ConstantMap{
    [name: string]: number;
}


interface ParenthesisCheck {
    direction: ParenthesisDirection;
    Valid: boolean;
}

function validateParentheses(line: string): ParenthesisCheck {
    let pDir: ParenthesisDirection = ParenthesisDirection.None;
    let opens: number[] = [];
    let closes: number[] = [];
    let i = 0;
    while(i <= line.length - 1){
        i = line.indexOf("(", i);
        if (i == -1){
            break;
        }
        opens.push(i);
        i++;
    }
    i = 0;
    while(i <= line.length - 1){
        i = line.indexOf(")",i);
        if (i == -1){
            break;
        }
        closes.push(i);
        i++;
    }
    if (opens.length == closes.length){
        for(let j = 0; j < opens.length; j++){
            if(closes[j] < opens[j]){
                pDir = ParenthesisDirection.Closed;
                return {
                    direction: pDir,
                    Valid: false
                }
             }
         }
            return {
                direction: pDir,
                Valid: true
            }
        } else {
            if (opens.length > closes.length) {
                pDir = ParenthesisDirection.Closed;
            } else if (opens.length < closes.length) {
                pDir = ParenthesisDirection.Open;
            }
            return {
                direction:pDir,
                Valid:false
            };
        }
    
}

function getDiagnostic(problemType: string, range: Range, extras: any | null = null): Diagnostic{
    let diagnosis: Diagnostic;
    switch(problemType){
        case "noRules":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR8001",
                message: "No rules",
                source: "aoe2ai linter"
            }
            break;
        case "ruleTooLong":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR6002",
                message: "Rule too long",
                source: "aoe2ai linter"
            }
            break;
        case "closingParenthesisMissing":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR2011",
                message: "Missing closing parenthesis (rule)",
                source: "aoe2ai linter"
            }
            break;
        case "closingParenthesisMissingNoRule":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR2011",
                message: "Missing closing parenthesis",
                source: "aoe2ai linter"
            }
            break;
        case "openingParenthesisMissing":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR2001",
                message: "Missing opening parenthesis",
                source: "aoe2ai linter"
            }
            break;
        case "missingKeyword":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR2002",
                message: "Missing keyword",
                source: "aoe2ai linter"
            }
            break;
        case "constantAlreadyDefined":
            let constantName = extras
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR2012",
                message: "Constant already defined: " + constantName,
                source: "aoe2ai linter"
            }
            break;
        case "missingArrow":
            diagnosis = {
                severity: DiagnosticSeverity.Error,
                range: range,
                code: "ERR2008",
                message: "Missing arrow",
                source: "aoe2ai linter"
            }
            break;
    }
    return diagnosis;
}

class AOE2AIKeywordAgent {
    public  static readonly PrimeKeywords: string[] = [
        "defrule",
        "defconst",
        "load",
        "load-random",
        "and",
        "or",
        "not"
    ];

    /**
     * containsPrimeKeyword
     * Returns an answer to this question below: 
     * Does the code (parameter) given contain at least 1 prime (root) keyword?
     * 
     * @public
     * @param line - A string of code that will be searched for prime keywords.
     * @returns A boolean indicating whether or not there is **AT LEAST** one prime keyword(in this case, any keyword that's not used in rules) in the given `line`.
     * 
     * @remarks
     * DO NOT use this method for code that uses prime keywords properly (doesn't use inside a rule unless the code contains a preceding parenthesis and the keyword that declares rules).
     * 
     * 
     */
    public static containsPrimeKeywords(line: string): boolean {
        let foundKeywords = 0;
        AOE2AIKeywordAgent.PrimeKeywords.forEach(word => {
            if (line.includes(word)){
                foundKeywords++;
            }
        });
        return foundKeywords > 0;
    }


}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    let settings = await getDocumentSettings(textDocument.uri);

    // The validator creates diagnostics for all uppercase words length 2 and more
    let text = textDocument.getText();

    let ruleDefinitionState: RuleConditionState = {
        DefiningRule: false,
        EndingRule: false,
        DefiningCondOp: false,
        EndingCondOp: false,
        HasArrow: false,
        RuleSection: RuleSectionType.None,
    };

    let constantList: ConstantMap = {};
    
    let ruleStats: RuleStatistics = {
        Lines: 0,
        StartPosition: {
            line:0,
            character:0
        },
        EndPosition:{
            line:0,
            character:0,
        },
        CondOpLines: 0,
        CondOpRanges: []
    };
    let diagnostics: Diagnostic[] = [];
    if (textDocument.getText().length <= 0){
        diagnostics.push(getDiagnostic("noRules",{
            start: {
                line: 0,
                character: 0
            },
            end:{
                line: 0,
                character: 0
            }
        }));
    } else {
        let lastCondOp: SyntaxRange |  null = null;
        let lines: string[] = text.split("\n");
        for(let i = 0; i < lines.length; i++ ){
            let currentLineText = lines[i];
            if (currentLineText.length > 0){
                if (!currentLineText.startsWith(";")){
                    if(currentLineText.includes("defrule") && !ruleDefinitionState["DefiningRule"]){
                        ruleDefinitionState["DefiningRule"] = true;
                        ruleStats["StartPosition"] = {
                            line: i,
                            character: currentLineText.indexOf("(")
                        };
                        ruleStats["Lines"] = 1;
                        ruleDefinitionState.RuleSection = RuleSectionType.Facts;
                    } else if(currentLineText.match(/(\((or|and|not))/g)) {
                        ruleDefinitionState["DefiningCondOp"] = true;
                        ruleStats["CondOpRanges"].push({
                            Start: {
                                line: i,
                                character: currentLineText.indexOf("(")
                            },
                            End: null
                        })
                    } else if(currentLineText.match(/\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/)) {
                        let constantMatches = currentLineText.match(/\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/);
                        let constName = constantMatches[2];
                        let constValue = constantMatches[3];
                        if(typeof(constName) == "string"){
                            if(typeof(constValue) == "string"){
                                let constValueA = Number.parseInt(constValue);
                                if (typeof(constValueA) == "number"){
                                    let constant = constantList[constName];
                                    if ((constant === undefined) || (constValueA == constant)){
                                        constantList[constName] = constValueA;
                                    } else {
                                        diagnostics.push(getDiagnostic("constantAlreadyDefined",{
                                            start: {
                                                line: i,
                                                character: 0,
                                            },
                                            end: {
                                                line: i,
                                                character: currentLineText.length - 1
                                            }
                                        },constName));
                                    }
                                }
                             }
                        }
                    } else if (ruleDefinitionState["DefiningRule"]) {
                            if (lastCondOp != null && !ruleDefinitionState.EndingCondOp){
                                lastCondOp = (!ruleDefinitionState.EndingCondOp) ? null : lastCondOp;
                            }
                            if(ruleDefinitionState["DefiningCondOp"]){
                                if (currentLineText.includes(")") && !currentLineText.includes("(") && !currentLineText.match(/\((or|and|not)/g)){
                                lastCondOp  = ruleStats.CondOpRanges.pop()
                                lastCondOp.End = {
                                    line: i,
                                    character: currentLineText.indexOf(")")
                                };
        
                                    if (ruleStats.CondOpRanges.length <= 0) {
                                        ruleDefinitionState.EndingCondOp = true;
                                    }                                   
                                }
                            } 
                            if (ruleStats["Lines"] > 16){
                                diagnostics.push(getDiagnostic("ruleTooLong",{
                                    start: {
                                        line: i,
                                        character: 0
                                    },
                                    end: {
                                        line: i,
                                        character: currentLineText.length - 1
                                    }
                                }));
                            }
                            if (currentLineText.includes(")") && !currentLineText.includes("(") && !ruleDefinitionState.DefiningCondOp){
                                ruleDefinitionState.EndingRule = true;
                                ruleStats["EndPosition"] = {
                                    line: i,
                                    character: currentLineText.indexOf(")")
                                }
                                ruleDefinitionState.RuleSection = RuleSectionType.None;
                            } else if (currentLineText.includes("(")){
                                ruleStats["Lines"]++;
                            } else if (currentLineText.match("(\=\>)")){
                                ruleDefinitionState.HasArrow = true;
                                ruleDefinitionState["DefiningRule"] = true;
                                ruleDefinitionState.RuleSection = RuleSectionType.Actions;
                            } else if (currentLineText.includes("defrule")) {
                                diagnostics.push(getDiagnostic("closingParenthesisMissing",{
                                    start: ruleStats.StartPosition,
                                    end: {
                                        line: i,
                                        character: currentLineText.search("defrule")
                                    }
                                }));
                            }
                            
                        }
                        let pCheck: ParenthesisCheck = validateParentheses(currentLineText);
                        if (!pCheck.Valid && !ruleDefinitionState["DefiningRule"] && (lastCondOp == null)){
                            switch(pCheck.direction){
                                case ParenthesisDirection.Closed:
                                    diagnostics.push(getDiagnostic("closingParenthesisMissingNoRule",{
                                        start: {
                                            line: i,
                                            character: currentLineText.indexOf("(")
                                        },
                                        end: {
                                            line: i,
                                            character: currentLineText.indexOf("(")
                                        }
                                    }));
                                    break;
                                case ParenthesisDirection.Open:
                                    diagnostics.push(getDiagnostic("openingParenthesisMissing",{
                                        start: {
                                            line: i,
                                            character: currentLineText.indexOf(")")
                                        },
                                        end: {
                                            line: i,
                                            character: currentLineText.indexOf(")")
                                        }
                                    }));
                                    break;
                            }
                        
                        }
                        if (!ruleDefinitionState["DefiningRule"]){
                            if (currentLineText.includes("(")){
                                let hasKeyWord = AOE2AIKeywordAgent.containsPrimeKeywords(currentLineText);
                                if (!hasKeyWord ){
                                    diagnostics.push(getDiagnostic("missingKeyword",{
                                        start: {
                                            line: i,
                                            character: currentLineText.indexOf("(")
                                        },
                                        end: {
                                            line: i,
                                            character: currentLineText.indexOf("(")
                                        }
                                    }));
                                }
                            }

                        }
                        if (ruleDefinitionState.EndingRule)
                        {
                            if (!ruleDefinitionState.HasArrow){
                                diagnostics.push(getDiagnostic("missingArrow",{
                                    start:  ruleStats.StartPosition,
                                    end: ruleStats.EndPosition
                                }));
                            }
                            ruleDefinitionState.EndingRule = false;

                            ruleDefinitionState["DefiningRule"] = false;

                            ruleDefinitionState.HasArrow = false;
                            ruleStats["Lines"] = 0;
                            
                        } 
                        if(ruleDefinitionState["EndingCondOp"]){
                            ruleDefinitionState["EndingCondOp"] = false;
                            ruleDefinitionState["DefiningCondOp"] = false;
                            ruleStats["CondOpRanges"] = [];
                        }
                    }

                }
            }
        }
       /**
        *   if (hasDiagnosticRelatedInformationCapability) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: 'Spelling matters'
                    },
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: 'Particularly for names'
                    }
                ];
            }
        */
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});

interface SignatureMap {
    [key: string]: SignatureInformation[];
}
interface ConstantDefinitionMatcher {
    [key: string]: RegExp;
}

class TokenMap {

}

class AoE2AIParameterTypes {
    public  static readonly BUILDING: ParameterInformation = {
        label: "<building>",
        documentation: "The building you want your AI to build or query about."
    };
    public static readonly RELATIONAL_OPERATOR: ParameterInformation = {
        label: "<relOp>",
        documentation: "A relational operator (e.g. greater-than (>), less-than (<), equal (==), etc)."
    };
    public static readonly VALUE_INT: ParameterInformation = {
        label: "<value>",
        documentation: "A string or integer (in this case, it's an integer)."
    };
    public static readonly STRATEGIC_NUMBER: ParameterInformation = {
        label: "<strategic-number>",
        documentation: "A number that can be used to manage certain aspects of your AI's empire (i.e. who explores the map, who does the farming, etc.)."
    };
    public static readonly RESEARCH_ITEM: ParameterInformation = {
        label: "<research-item>",
        documentation: "The research technology you wish to unlock (i.e. ri-wheel-barrow)."
    };
    public static readonly RESOURCE_TYPE: ParameterInformation = {
        label: "<resource-type>",
        documentation: "Wood, food, gold or stone?"
    };
    public static readonly AGE: ParameterInformation = {
        label: "<age>",
        documentation: "Dark, Feudal, Castle, Imperial or Post-Imperial?"
    };
    public static readonly UNIT: ParameterInformation = {
        label: "<unit>",
        documentation: "The unit type you want to train or query about."
    };
    public static readonly PERIMETER: ParameterInformation = {
        label: "<perimeter>",
        documentation: "A valid wall perimeter. Allowed values are 1 and 2, with 1 being closer to the Town Center than 2. \n \t Perimeter 1 is usually between 10 and 20 tiles from the starting Town Center. \n \t Perimeter 2 is usually between 18 and 30 tiles from the starting Town Center. "
    };
    public static readonly COMMODITY: ParameterInformation = {
        label: "<commodity>",
        documentation: "Same parameter type as <resource-type>, but used for trade only."
    };
}

let Signatures: SignatureMap  = {
    "build": [
        {
            label: "(build <building>)",
            documentation: "This action builds the given building. \nThe action allows the use of building line wildcard parameters for the <building>. ",
            parameters: [
                AoE2AIParameterTypes.BUILDING
            ]
        }
    ],
    "can-build-with-escrow": [
        {
            label: "(can-build-with-escrow <building>)",
            documentation: "This fact checks whether the computer player can build the given building. In particular it checks: \n 1. That the building is available to the computer player’s civilization. \n 2. That the tech tree prerequisites for building are met. \n 3. That the resources needed for building are available when using escrow amounts.  \n \t The fact allows the use of building line wildcard parameters for the <building>",
            parameters: [
                AoE2AIParameterTypes.BUILDING
            ]
        }
    ],
    "can-build": [
        {
            label: "(can-build <building>)",
            documentation: "This fact checks whether the computer player can build the given building. In particular it checks: \n 1. That the building is available to the computer player’s civilization. \n 2. That the tech tree prerequisites for building are met. \n 3. That the resources needed for the building are available, not counting escrow amounts.  \n \t The fact allows the use of building line wildcard parameters for the <building>",
            parameters: [
                AoE2AIParameterTypes.BUILDING
            ]
        }
    ],
    "can-train": [
        {
            label: "(can-train <unit>)",
            documentation: "This fact checks if the training of the given unit can start. In particular it checks: \n 1. That the unit is available to the computer player's civilization \n 2. That the tech tree prerequisites for training the unit are met. \n 3. That resources needed for training the unit are available, not counting escrow amounts.  \n 4. That there is enough housing headroom for the unit. \n 5. That there is a building that is not busy and is ready to start training the unit. \n \n The fact allows the use of unit line wildcard parameters for the <unit>.  ",
            parameters: [
                AoE2AIParameterTypes.UNIT
            ]
        }
    ],
    "unit-type-count-total": [
        {
            label: "(unit-type-count-total <unit> <rel-op> <value>)",
            documentation: "This fact checks the computer player's total unit count. The total includes trained and queued units of the given type. \n The fact allows the use of unit line wildcard parameters for the <unit>. ",
            parameters: [
                AoE2AIParameterTypes.UNIT,
                AoE2AIParameterTypes.RELATIONAL_OPERATOR,
                AoE2AIParameterTypes.VALUE_INT
            ]
       
        }
    ],
    "building-type-count-total": [
        {
            label: "(building-type-count-total  <building> <rel-op> <value>)",
            documentation: "This fact checks the computer player's total building count. The total includes existing and \nqueued buildings of the given type.\n The fact allows the use of building line wildcard parameters for the <building>.",
            parameters: [ 
                AoE2AIParameterTypes.BUILDING,
                AoE2AIParameterTypes.RELATIONAL_OPERATOR,
                AoE2AIParameterTypes.VALUE_INT
            ]
        }
    ],
    "current-age":[
        {
            label:"(current-age  <rel-op> <age>)",
            documentation: "This fact checks computer player’s current age.",
            parameters: [
                AoE2AIParameterTypes.RELATIONAL_OPERATOR,
                AoE2AIParameterTypes.AGE
            ]
        }
    ],
    "housing-headroom": [
        {
            label: "(housing-headroom  <rel-op>  <value>)",
            documentation: "This fact checks computer player’s housing headroom. Housing headroom is the difference between current housing capacity and trained unit capacity. For example, a computer player has a Town Center (capacity 5), a House (capacity 5) and 6 villagers. In this case, housing headroom is 4.",
            parameters: [
                AoE2AIParameterTypes.RELATIONAL_OPERATOR,
                AoE2AIParameterTypes.VALUE_INT
            ]
        }
    ],
    "idle-farm-count":[
        {
            label: "(idle-farm-count  <rel-op>  <value>)",
            documentation: "This fact checks a computer player’s idle farm count – the number of farms with no farmers. It should be used before a new farm is built to make sure it is needed.",
            parameters:[
                AoE2AIParameterTypes.RELATIONAL_OPERATOR,
                AoE2AIParameterTypes.VALUE_INT
            ]

        }
    ],
    "population-headroom": [
        {
            label: "(population-headroom  <rel-op>  <value>)",
            documentation: "This fact checks the computer player’s population headroom. Population headroom is the difference between the game’s population cap and current housing capacity. For example, in a game with a population cap of 75, the computer player has a town center (capacity 5) and a house (capacity 5). In this case population headroom is 65.",
            parameters: [
                AoE2AIParameterTypes.RELATIONAL_OPERATOR,
                AoE2AIParameterTypes.VALUE_INT
            ]
        }
    ],
    "can-research": [
        {
            label: "(can-research <research-item>)",
            documentation: "This fact checks if the given research can start. In particular it checks: \n 1. That the research item is available to the computer player's civilization. \n 2. That the tech tree prerequisites for research are met. \n 3. That resources needed for research are available, not counting escrow amounts. \n 4. That there is a building that is not busy and is ready to start research. ",
            parameters: [
                AoE2AIParameterTypes.RESEARCH_ITEM
            ]
        }
    ],
    "research-available": [
        {
            label:"(research-available  <research-item>)",
            documentation:"The fact checks that the given research is available to the computer player's civ, and that the research is available at this time (tech tree prerequisites are met). The fact does not check that there are enough resources to start researching. ",
            parameters: [
                AoE2AIParameterTypes.RESEARCH_ITEM
            ]
        }
    ],
    "release-escrow":[
        {
            label: "(release-escrow  <resource-type>)",
            documentation: "This action releases the computer player's escrow for a given resource type.",
            parameters: [
                AoE2AIParameterTypes.RESOURCE_TYPE
            ]
        }
    ],
    "set-strategic-number":[
        {
            label: "(set-strategic-number <strategic-number>  <value>)",
            documentation: "This action sets a given strategic number to a given value.",
            parameters:[
                AoE2AIParameterTypes.STRATEGIC_NUMBER,
                AoE2AIParameterTypes.VALUE_INT
            ]
        }
    ],
    "set-escrow-percentage":[
        {
            label: "(set-escrow-percentage  <resource-type>  <value>)",
            documentation: "This action sets the computer player's escrow percentage for a given resource type. \nGiven values have to be in the range 0-100. ",
            parameters:[
                AoE2AIParameterTypes.RESOURCE_TYPE,
                AoE2AIParameterTypes.VALUE_INT
            ]
        }
    ],
    "enable-wall-placement": [
        {
            label: "(enable-wall-placement <perimeter>)",
            documentation: "This action enables wall placement for the given perimeter. Enabled wall placement causes the rest of the placement code to do some planning and place all structures at least one tile away from the future wall lines. If you are planning to build a wall, you have to explicitly define which perimeter wall you plan to use when the game starts. This is a one-time action and should be used during the initial setup. ",
            parameters:[
                AoE2AIParameterTypes.PERIMETER
            ]
        
        }
    ],
    "can-buy-commodity": [
        {
            label: "(can-buy-commodity <commodity>)",
            documentation: "This fact checks whether the computer player can buy one lot of the given commodity. \nThe fact does not take into account escrowed resources. ",
            parameters:[
                AoE2AIParameterTypes.COMMODITY
            ]

        }
    ],
    "can-sell-commodity": [
        {
            label: "(can-sell-commodity <commodity>)",
            documentation: "This fact checks whether the computer player can sell one lot of the given commodity. \nThe fact does not take into account escrowed resources. ",
            parameters:[
                AoE2AIParameterTypes.COMMODITY
            ]

        }
    ]
};

enum SyntaxLensType {
    Reference,
    Adjustable,

}

interface SyntaxLens {
    expression: RegExp | string;
    lensType: SyntaxLensType;
    validTokens: Array<string | RegExp>;
    commands: Array<string>;
    dataTemplate: (match: RegExpMatchArray) => SyntaxLensData;
}

interface SyntaxLensRegistry {
    [typeName: string]: SyntaxLens;
}

let currentParam: ParameterInformation | null;

connection.onSignatureHelp((_textDocParams: TextDocumentPositionParams): SignatureHelp => {
    let sigHelp: SignatureHelp;
    let sigExp = new RegExp("(\()([\-A-Za-z0-9]+)\s*(([\-A-Za-z0-9]+)\s)*(\)*)","g");
    let paramSpaceExp = new RegExp("(([\-A-Za-z0-9><(>=)(<=)(!=)(==)]+)(\s*))","g");
    let doc = documents.get(_textDocParams.textDocument.uri);
    let docContents = doc.getText();
    let docContentsArray = docContents.split(new RegExp("\n"));
    let docLine = docContentsArray[_textDocParams.position.line];
    let matches = docLine.match(sigExp);

    let sigs: SignatureInformation[] = [];
    let activeParam = 0;
    if (!matches){
        return {
            signatures: [],
            activeSignature: 0,
            activeParameter: 0
        }
    }


    let func = matches[0];

    connection.console.log(func);
    if (Signatures[func] !== null) {
        sigs = Signatures[func];
        let paramContent = docLine.substring((docLine.indexOf(func) + func.length),docLine.length);

        let paramSpaces= paramContent.match(paramSpaceExp);
        if (!paramSpaces){
            return {
                signatures: sigs,
                activeSignature: 0,
                activeParameter: 0
            }
        }
        let aPResult = 0;
        paramSpaces.forEach((match => {
            let pos = docLine.indexOf(match);
            pos = pos + match.length;
            if (pos < _textDocParams.position.character){
                aPResult++;
            }
        }));
        activeParam = aPResult;
    }

    sigHelp = {
        signatures: sigs,
        activeSignature: 0,
        activeParameter: activeParam
    }
    if (sigHelp.signatures.length > 0){
        currentParam = sigHelp.signatures[sigHelp.activeSignature].parameters[sigHelp.activeParameter];
    }

    return sigHelp;
})

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    let result: CompletionItem[] = [];
    if (currentParam){
        switch(currentParam.label){
         case "<research-item>":
            result = [
                {
                    label: "ri-arbalest",
                    kind: CompletionItemKind.Field,
                    documentation: "Upgrades your Crossbowmen and lets you create Arbalests, which are stronger, better armored, and fire farther.",
                    data: "arbalest"
                },
                {
                    label: "ri-crossbow",
                    kind: CompletionItemKind.Field,
                    documentation: "Upgrades your Archers and lets you create Crossbowmen, which are stronger, better armored, and fire farther.",
                    data: "crossbow"
                },
                {
                    label: "ri-elite-skirmisher",
                    kind: CompletionItemKind.Field,
                    documentation: "Upgrades your Skirmishers and lets you create Elite Skirmishers, which are stronger and better armored.",
                    data: "skirmisher-elite"

                },
                {
                    label: "ri-hand-cannon",
                    kind: CompletionItemKind.Field,
                    documentation: "Lets you create Hand Cannoneers.",
                    data: "hand-cannon"

                },
                {
                    label: "ri-heavy-cavalry-archer",
                    kind: CompletionItemKind.Field,
                    documentation: "Upgrades your Cavalry Archers and lets you create Heavy Cavalry Archers, which are stronger.",
                    data: "heavy-cavalry-archer"
                },
                {
                    label: "ri-champion",
                    kind: CompletionItemKind.Field,
                    documentation: "Upgrades your Two-Handed Swordsmen and lets you create Champions, which are stronger and equipped with armor.",
                    data: "champion"
                },
                {
                    label: "ri-elite-eagle-warrior",
                    kind: CompletionItemKind.Field,
                    documentation: " Upgrades your Eagle Warriors and lets you create Elite Eagle Warriors, which are stronger.",
                    data: "eagle-warrior-elite"
                 },
                 {
                    label: "ri-halberdier",
                    kind: CompletionItemKind.Field,
                    documentation: "Upgrades your Pikemen and lets you create Halberdiers, which are stronger.",
                    data: "halberdier"
                 },
                 {
                     label: "ri-long-swordsman",
                     kind: CompletionItemKind.Field,
                     documentation: "Upgrades your Men-at-Arms and lets you create Long Swordsmen, which are stronger.",
                     data: "long-swordsman"
                 },
                 {
                     label: "ri-man-at-arms",
                     kind: CompletionItemKind.Field,
                     documentation: "Upgrades your Militia and lets you create Men-at-Arms, which are stronger.",
                     data: "man-at-arms"
                 },
                 {
                     label: "ri-parthian-tactics",
                     kind: CompletionItemKind.Field,
                     documentation: " Cavalry Archers have +1 normal/+2 pierce armor; Cavalry Archers have +4 attack, Mangudai +2 attack vs. pikemen.",
                     data: "parthian-tactics"
                 },
                 {
                     label: "ri-pikeman",
                     kind: CompletionItemKind.Field,
                     documentation: "Upgrades your Spearmen and lets you create Pikemen, which are stronger.",
                     data: "pikeman"
                 },
                 {
                     label: "ri-squires",
                     kind: CompletionItemKind.Field,
                     documentation: "Infantry move 10% faster.",
                     data: "squires"
                 },
                 {
                     label: "ri-thumb-ring",
                     kind: CompletionItemKind.Field,
                     documentation: "Archers fire faster and with 100% accuracy.",
                     data: "thumb-ring"
                 },
                 {
                     label: "ri-tracking",
                     kind: CompletionItemKind.Field,
                     documentation: "Infantry have +2 line of sight so they see enemy units from a longer distance.",
                     data: "tracking"
                 },
                 {
                     label: "ri-two-handed-swordsman",
                     kind: CompletionItemKind.Field,
                     documentation: "Upgrades your Long Swordsmen and lets you create Two-Handed Swordsmen, which are stronger.",
                     data: "two-handed-swordsman"
                 },
                 {
                     label: "ri-blast-furnace",
                     kind: CompletionItemKind.Field,
                     documentation: "Infantry and cavalry have +2 attack.",
                     data: "blast-furnace"
                 },
                 {
                     label: "ri-bodkin-arrow",
                     kind: CompletionItemKind.Field,
                     documentation: "Archers, cavalry archers, galleys, Viking Longboats, Town Centers, Castles, and towers have +1 attack and +1 range.",
                     data: "bodkin-arrow"
                 }

                ];
                break;
            case "<strategic-number>":
                result = [
                    {
                        label: "sn-percent-civilian-explorers",
                        kind: CompletionItemKind.Field,
                        documentation: "Controls the normal, formula-based percentage of civilian explorers allocated. Must be >= 0.",
                        data: "percent-civilian-explorers",
                        detail: "(SN) percent-civilian-explorers  \n Category: CIVILIAN NUMBERS"
                    },
                    {
                        label: "sn-percent-civilian-builders",
                        kind: CompletionItemKind.Field,
                        documentation: "Controls the normal, formula-based percentage of builders allocated. Must be >= 0.",
                        data: "percent-civilian-builders",
                        detail: "(SN) percent-civilian-builders  \n Category: CIVILIAN NUMBERS"
                    },
                    {
                        
                        label: "sn-percent-civilian-gatherers",
                        kind: CompletionItemKind.Field,
                        documentation: "Controls the normal, formula-based percentage of gatherers allocated. Must be >= 0.",
                        data: "percent-civilian-gatherers",
                        detail: "(SN) percent-civilian-gatherers \n Category: CIVILIAN NUMBERS"
                    }
                ];
             break;
            case "<perimeter>":
                result = [
                    {
                        insertText: "1",
                        label: "perimeter-1",
                        documentation: "Perimeter 1 is usually between 10 and 20 tiles from the starting Town Center.",
                        data: "perimeter-1"
                    },
                    {
                        insertText: "2",
                        label: "perimeter-2",
                        documentation: "Perimeter 2 is usually between 18 and 30 tiles from the starting Town Center. ",
                        data: "perimeter-2"
                    }
                ];
                break;
            case "<wall>":
                result = [

                ];
                break;
            case "<resource-type>":
                result = [
                    {
                        insertText: "stone",
                        label: "stone",
                        documentation: "Stone is a resource/commodity used to make strong structures such as Castles, Town Centers, and Towers. It is also used for building Walls and Gates.",
                        data: "stone"
                    },
                    {
                        insertText: "wood",
                        label: "wood",
                        documentation: "Wood is a resource/commodity used to make almost all structures in AoE II. There are a few exceptions (i.e. the Castle and Stone/Fortified Walls).",
                        data: "wood"
                    },
                    {
                        insertText: "food",
                        label: "food",
                        documentation: "Food is a resource/commodity used to train units (except for Siege Units and Archers) and conduct research.",
                        data: "food"
                    },
                    {
                        insertText: "gold",
                        label: "gold",
                        documentation: "Gold is a resource (the only one that is not a commodity) used to not only conduct business transactions at the Market (Building), but it is also used to train almost every unit in the game.",
                        data: "gold"
                    }
                ];
                break;
             case "<commodity>":
                result = [
                    {
                        insertText: "stone",
                        label: "stone",
                        documentation: "Stone is a resource/commodity used to make strong structures such as Castles, Town Centers, and Towers. It is also used for building Walls and Gates.",
                        data: "stone"
                    },
                    {
                        insertText: "wood",
                        label: "wood",
                        documentation: "Wood is a resource/commodity used to make almost all structures in AoE II. There are a few exceptions (i.e. the Castle and Stone/Fortified Walls).",
                        data: "wood"
                    },
                    {
                        insertText: "food",
                        label: "food",
                        documentation: "Food is a resource/commodity used to train units (except for Siege Units and Archers) and conduct research.",
                        data: "food"
                    }
                ];
                break;

        }

    }
    return result;
});

// This handler resolves additional information for the item selected in
// the completion list.

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        switch(item.label){
            case "perimeter-1":
                item.detail = 'Type 1 to use this perimeter';
                break;
            case "perimeter-2":
                item.detail = 'Type 2 to use this perimeter';
                break;
        }
        return item;
    }
);

interface SyntaxLensData {

}

interface ConstantLensData extends SyntaxLensData {
    constantName?: string | null;
    constantValue?: Number | null;
    hasError?: boolean | null;
}

let availableSyntax: SyntaxLensRegistry = {
    "constant": {
        expression: /\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/,
        lensType: SyntaxLensType.Reference,
        validTokens: [

        ],
        commands: [
            "aoe2ai.editor.viewConstantUsage"        
        ],
        dataTemplate: (match) => {
            let data: ConstantLensData = {};
            if(match.length > 0){
                let constName = match[2];
                let constValue = match[3];
                data.constantName = constName;
                let constValueA = Number.parseInt(constValue);
                if(typeof(constValueA) == "number"){
                    data.constantValue = constValueA;
                }
            }
            return data;
        }
    }
};
interface ConstantDocMap {
    [uri: string]: ConstantMap 
}

let docConstants: ConstantDocMap = {};

connection.onCodeLens(
     (params: CodeLensParams): CodeLens[] => {
        let scopes: CodeLens[] = [];
        let docRaw = documents.get(params.textDocument.uri);
        let docText = docRaw.getText();
        let docLines = docText.split("\n");
        docConstants[params.textDocument.uri] = {};
        let docLang = docRaw.languageId;
        
        if (docLang == "aoe2ai"  && (feats.codelens)){
            let docLines = docText.split("\n");
            docLines.forEach((line) => {
                let currentLineText = line;
                if(currentLineText.match(/\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/)) {
                    let constantMatches = currentLineText.match(/\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/);
                    let constName = constantMatches[2];
                    let constValue = constantMatches[3];
                    if(typeof(constName) == "string"){
                        if(typeof(constValue) == "string"){
                            let constValueA = Number.parseInt(constValue);
                            if (typeof(constValueA) == "number"){
                                let constant = docConstants[params.textDocument.uri][constName];
                                if ((constant === undefined) || (constValueA == constant)){
                                    docConstants[params.textDocument.uri][constName] = constValueA;
                                }
                            }
                        }
                    }
                }
            });
            
        }
        docLines.forEach((line,i) => {
            for (const syntaxLens in availableSyntax) {
                if (availableSyntax.hasOwnProperty(syntaxLens)){
                    const syntaxLensObj = availableSyntax[syntaxLens];  
                    let synMatch = line.match(syntaxLensObj.expression);
                    if (synMatch !== null){
                        if(synMatch.length > 0){
                            let lens: CodeLens = {
                                range: {
                                    start: {
                                        line: i,
                                        character: 0
                                    },
                                    end: {
                                        line: i,
                                        character: line.length - 1
                                    }
                                }
                            };
                            switch(syntaxLensObj.lensType){
                                case SyntaxLensType.Reference:
                                    lens.data = syntaxLensObj.dataTemplate(synMatch);
                                    if (lens.data !== null){
                                        lens.data.lensType = syntaxLens;
                                        lens.data.uri = params.textDocument.uri;
                                        scopes.push(lens);
                                    }
                                    break;
                                case SyntaxLensType.Adjustable:
                                    syntaxLensObj.validTokens.forEach((token) => {
                                        let synMatch2 = line.match("^\b(" + token + ")");
                                        if (synMatch2 !== null){
                                            
                                            scopes.push(lens);
                                        }
                                    })
                                    break;
                            }
                           
                        }
                    }       
                }
            }
         });
        return scopes;
    }
);

function findConstantRefs(constantName: string, docText: string): Range[] {
        let ranges: Range[] = [];
        let docLines = docText.split("\n");
        docLines.forEach((line,linen) => {
            let constantRef = line.indexOf(constantName);
            if ((constantRef !== -1) && !(/\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))/).test(line)){
                let range: Range = {
                    start: {
                        line: linen,
                        character: 0,
                    },
                    end: {
                        line: linen,
                        character: line.length - 1
                    }
                }
                ranges.push(range);
            }
        });
        return ranges;
}

connection.onCodeLensResolve(
    (lens: CodeLens): CodeLens => {
        let newLens = lens;
        let data = lens.data;
        let doc = documents.get(data.uri);
        let docTextC = doc.getText(lens.range);
        let docTextA = doc.getText();
        let docLines = docTextA.split("\n");
        switch(data.lensType){
            case "constant":
                 if ((docConstants[data.uri][data.constantName] == data.constantValue)  || (docConstants[data.uri][data.constantName] == undefined)){
                    newLens.command = {
                        command: availableSyntax.constant.commands[0],
                        title: "View References to " + data.constantName,
                        arguments: [{
                            uri: doc.uri,
                            position: [lens.range.start.line,lens.range.start.character],
                            ranges: findConstantRefs(data.constantName,doc.getText())}]
                    }
                } 
                break;
        }
        return newLens;
    }
)


/*
connection.onDefinition((docParams: TextDocumentPositionParams, token: CancellationToken): Definition | null => {
    let docRaw = documents.get(docParams.textDocument.uri);
    let docText = docRaw.getText();
    let docTextArray = docText.split(new RegExp("\n"));
    let docLine = docTextArray[docParams.position.line];
    let lineRegex: ConstantDefinitionMatcher = { };
    let lineRegexMatcher: RegExp = new RegExp("\((defconst)\s([\w\-]+)\s(\-?\d+)(?=\))","g")
    let defLine;

    let definitionResult: Definition | null;
    
    docTextArray.forEach((lineText) => {
        let matchArray = lineRegexMatcher.exec(lineText);
        if (matchArray){
            let constantMatch = matchArray[1];
            connection.console.log(constantMatch);
            if(constantMatch){
                if (!lineRegex[constantMatch]){
                lineRegex[constantMatch] = new RegExp("(" + constantMatch + "+)")
            }
        }
    });
    

    return definitionResult;
});
*/
connection.onDidOpenTextDocument((params) => {
    // A text document got opened in VSCode.
    // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
    // params.text the initial full content of the document.
    connection.console.log(`${params.textDocument.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
    // The content of a text document did change in VSCode.
    // params.uri uniquely identifies the document.
    // params.contentChanges describe the content changes to the document.
    
    connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
    // A text document got closed in VSCode.
    // params.uri uniquely identifies the document.
    docConstants[params.textDocument.uri] = {};
    connection.console.log(`${params.textDocument.uri} closed.`);
});


connection.onHover((params: TextDocumentPositionParams,token: CancellationToken): Hover => {
    let hov: Hover;

    let resultStr: string = "";
    let sigExp = new RegExp("(\()([\-A-Za-z0-9]+)\s*(([\-A-Za-z0-9]+)\s)*(\)*)","g");
    let paramSpaceExp = new RegExp("(([\-A-Za-z0-9><(>=)(<=)(!=)(==)]+)(\s*))","g");
    let doc = documents.get(params.textDocument.uri);
    let docContents = doc.getText();
    let docContentsArray = docContents.split(new RegExp("\n"));
    let docLine = docContentsArray[params.position.line];
    let paramData = [];
    let matches = docLine.match(sigExp);
    if (matches){
        let func = matches[0];
        connection.console.log(func);
        if (Signatures[func] !== null) {
            let sigs: SignatureInformation[] = Signatures[func];
            
            let paramContent = docLine.substring((docLine.indexOf(func) + func.length),docLine.length);
    
            let paramSpaces= paramContent.match(paramSpaceExp);
            if (paramSpaces){
                let aPResult = [];
                paramSpaces.forEach((match => {
                    let finalMatch = match;
                    if(match.indexOf(")") !== -1){
                        finalMatch = match.slice(0,match.indexOf(")"));
                    }
                    let pos = docLine.indexOf(finalMatch);
                    connection.console.log(finalMatch);
                    pos = pos + finalMatch.length;
                    if (pos < (docLine.length - 1)){
                        aPResult.push(finalMatch);
                    }
                }));
                paramData = aPResult;
            }
            if(sigs){
                sigs.forEach((sig: SignatureInformation) => {
                    if(paramData.length == sig.parameters.length) {
                        resultStr = resultStr + ( "### " + sig.label + "\n");
                        resultStr += sig.documentation + "\n\n";
                    }
                })
            }
        }
    }
    hov = {
        contents: resultStr
    };

    return hov
})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();