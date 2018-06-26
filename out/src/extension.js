"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
let vscode_window = require("vscode").window;
const StatusBarAlignment = vscode_window.StatusBarAlignment;
const languageClient = require("vscode-languageclient");
const path = require("path");
const fs = require("fs");
const aoe2ai_const = require("./aoe2aiConstants");
// Defines the search path of your language server DLL. (.NET Core)
const homedir = require('os').homedir();
let ruleCounter;
const languageServerPaths = [
	homedir + "/.aoe2ai/aoe2ai.dll",	
];


class RuleCounter{
    constructor(){
        this._statusBarItem = vscode_window.createStatusBarItem("Left");
    }

    updateRuleCount(){
        let editor = vscode_window.activeTextEditor;
        if(!editor){
            this._statusBarItem.hide();
            return;
        }
        let doc = editor.document;
        if(doc.languageId == "aoe2ai"){
            let ruleCount = this._getRuleCount(doc);
            this._statusBarItem.text = " $(law) " + ((ruleCount !== 1) ? (ruleCount + " Rules") : "1 Rule");
            this._statusBarItem.show();
        }
        else{
            this._statusBarItem.hide();
        }
    }

    _getRuleCount(doc){
        let docContent = doc.getText();
        let ruleCount = 0;
        let docContentLines = docContent.split('\n');
        let pattern = new RegExp("((\\(defrule))+","g");

        for(var i = 0; i < doc.lineCount; i++){
            let matchRead = pattern.test(docContentLines[i]);
            if(matchRead){
                ruleCount++;
            } 
        }

        return ruleCount;
    }

    dispose(){
        this._statusBarItem.dispose();
    }
}


function activateLanguageServer(context) {
    // The server is implemented in an executable application.
    let serverModule = null;
    console.log(homedir);
    for (let p of languageServerPaths) {
        console.log(p);
        if (fs.existsSync(p)) {
            serverModule = p;
            break;
        }
    }
    if (!serverModule)
        throw new URIError("Cannot find the language server module");
    let workPath = path.dirname(serverModule);
    console.log(`Use ${serverModule} as server module.`);
    console.log(`Work path: ${workPath}.`);
    let serverOptions = {
        run: { command: "dotnet", args: [serverModule], options: { cwd: workPath } },
        debug: { command: "dotnet", args: [serverModule, "--debug"], transport: languageClient.TransportKind.ipc, options: { cwd: workPath } }
    };
    // Options to control the language client
    let clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{
            scheme: "file",
            language: "aoe2ai"
        }],
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            configurationSection: "AOE2AIScriptSettings",
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: [
                vscode.workspace.createFileSystemWatcher("**/.per"),
            ]
        },
    };
    // Create the language client and start the client.
    let client = new languageClient.LanguageClient("AOE2AIScriptSettings", "Age of Empires II AI", serverOptions, clientOptions);
    if(vscode.window.activeTextEditor){
    ruleCounter = new RuleCounter();
    ruleCounter.updateRuleCount();
    vscode_window.onDidChangeActiveTextEditor(function(editor){
        ruleCounter.updateRuleCount();
    },ruleCounter,ruleCounter);
    vscode_window.onDidChangeTextEditorSelection(function(selection){
        ruleCounter.updateRuleCount();
    },ruleCounter,ruleCounter);
    const aoe2aiConstantsTreeProvider = new aoe2ai_const.AoE2AIConstantProvider(vscode.window.activeTextEditor.document);
    vscode.window.registerTreeDataProvider("aoe2-ai-constants", aoe2aiConstantsTreeProvider);
    vscode_window.onDidChangeActiveTextEditor(function(editor){
        aoe2aiConstantsTreeProvider.refresh();
    },aoe2aiConstantsTreeProvider,aoe2aiConstantsTreeProvider);
    vscode_window.onDidChangeTextEditorSelection(function(selection){
        aoe2aiConstantsTreeProvider.refresh();
    },aoe2aiConstantsTreeProvider,aoe2aiConstantsTreeProvider);
    
    }   
    let disposable = client.start();
    // Push the disposable to the context's subscriptions so that the 
    // client can be deactivated on extension deactivation
    if(vscode_window.activeTextEditor){
        context.subscriptions.push(ruleCounter);
    }
    context.subscriptions.push(disposable);
    
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    console.log("aoe2ai extension is now activated.");
    activateLanguageServer(context);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    ruleCounter.dispose();
}


exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map