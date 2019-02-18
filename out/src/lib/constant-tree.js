"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
class AoE2AIConstantProvider {
    constructor(context, workspaceRoot) {
        this.context = context;
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        let editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            vscode_1.window.showInformationMessage("[AoE II AI]: No editor found.");
            return Promise.resolve([]);
        }
        let document = editor.document;
        if (!document) {
            vscode_1.window.showInformationMessage("[AoE II AI]: No constants found.");
            return Promise.resolve([]);
        }
        if (!element) {
            return new Promise(resolve => {
                resolve(this.getConstants(document.getText(), document.lineCount));
            });
        }
    }
    getConstants(document, lineCount) {
        let docContent = document;
        let constants = [];
        let docContentLines = docContent.split("\n");
        let pattern = new RegExp("\\((defconst)\\s([\\w\\-]+)\\s(\\-?\\d+)(?=\\))");
        // \s([\w\-]+)\s(\-?\d+)
        for (var i = 0; i < lineCount; i++) {
            let line = docContentLines[i];
            const match = pattern.exec(line);
            let matchRead = pattern.test(line);
            if (matchRead) {
                constants.push(new AIConstant(match[2], +(match[3]), vscode_1.TreeItemCollapsibleState.None, this.context.asAbsolutePath(path.join('resources', 'lock.svg'))));
            }
        }
        return constants;
    }
}
exports.AoE2AIConstantProvider = AoE2AIConstantProvider;
class AIConstant extends vscode_1.TreeItem {
    constructor(label, value, collapsibleState, iconPath, command) {
        super(label, collapsibleState);
        this.contextValue = "aoe2ai-constant";
        this.value = value;
        this.command = command;
        this.iconPath = iconPath;
    }
    get tooltip() {
        return `${this.label} = ${this.value}`;
    }
}
exports.AIConstant = AIConstant;
class AIConstantController {
    constructor(context) {
        let doc = vscode_1.window.activeTextEditor.document;
        this.constantsTreeProvider = new AoE2AIConstantProvider(context, doc.getText());
        let subscriptions = [];
        vscode_1.window.registerTreeDataProvider("aoe2-ai-constants", this.constantsTreeProvider);
        vscode_1.window.onDidChangeActiveTextEditor(this._refreshConstantTree, this, subscriptions);
        vscode_1.window.onDidChangeTextEditorSelection(this._refreshConstantTreeSel, this, subscriptions);
        this._disposable = vscode_1.Disposable.from(...subscriptions);
    }
    _refreshConstantTree(e) {
        this.constantsTreeProvider.refresh();
    }
    _refreshConstantTreeSel(sel) {
        this.constantsTreeProvider.refresh();
    }
    dispose() {
        this._disposable.dispose();
    }
}
exports.AIConstantController = AIConstantController;
//# sourceMappingURL=constant-tree.js.map