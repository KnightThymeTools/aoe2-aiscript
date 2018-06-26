"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
class AoE2AIConstantProvider {
    constructor(){
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh(){
        this._onDidChangeTreeData.fire();

    }

    getTreeItem(element){
        return element;
    }

    getChildren(element){
        let editor = vscode.window.activeTextEditor;
        if(!editor){
            vscode.window.showInformationMessage("[AoE II AI]: No Editor found.");
            return Promise.resolve([]);
        }
        let document = editor.document;
        if(!document){
            vscode.window.showInformationMessage("[AoE II AI]: No constants found.");
            return Promise.resolve([]);
        }
        if (!element){
            return new Promise(resolve => {
                resolve(this.getConstants(document.getText(),document.lineCount));
            })
        }
    }

    getConstants(document,lineCount){
        let docContent = document;
        let constants = [];
        let docContentLines = docContent.split("\n");
        let pattern = new RegExp("\\((defconst)\\s([\\w\\-]+)\\s(\\-?\\d+)(?=\\))");
         // \s([\w\-]+)\s(\-?\d+)
        for(var i = 0; i < lineCount; i++){
            let line = docContentLines[i];
            const match = pattern.exec(line);
            let matchRead = pattern.test(line);
            if(matchRead){
                 constants.push(new AIConstant(match[2],match[3],vscode.TreeItemCollapsibleState.None));
            } 
        }

        return constants;
    }
}

class AIConstant extends vscode.TreeItem {
    constructor(label, value, collapsibleState, command){
        super(label, collapsibleState);
        this.label = label;
        this.value = value;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'lock.svg');
    }

    get tooltip(){
        return `${this.label} = ${this.value}`;
    }
}
exports.AoE2AIConstantProvider = AoE2AIConstantProvider;
