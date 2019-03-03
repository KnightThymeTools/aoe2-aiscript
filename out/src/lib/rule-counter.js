"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const vscode_2 = require("vscode");
class RuleCounter {
    constructor() {
        this._statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Right);
    }
    updateRuleCount() {
        let editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }
        let doc = editor.document;
        if (doc.languageId == "aoe2ai") {
            let ruleCount = this._getRuleCount(doc);
            this._statusBarItem.text = " $(law) " + ((ruleCount !== 1) ? (ruleCount + " Rules") : "1 Rule");
            let config = vscode_2.workspace.getConfiguration("aoe2ai");
            if (config.get("ruleCounterEnabled")) {
                this._statusBarItem.show();
            }
            else {
                this._statusBarItem.hide();
            }
        }
    }
    _getRuleCount(doc) {
        let docContent = doc.getText();
        let ruleCount = 0;
        let docContentLines = docContent.split('\n');
        for (var i = 0; i < doc.lineCount; i++) {
            let matchRead = RuleCounter.RulePattern.test(docContentLines[i]);
            if (matchRead) {
                ruleCount++;
            }
        }
        return ruleCount;
    }
    dispose() {
        this._statusBarItem.dispose();
    }
}
RuleCounter.RulePattern = new RegExp("((\\(defrule))+", "g");
exports.RuleCounter = RuleCounter;
class RuleCounterController {
    constructor(ruleCounter) {
        this._ruleCounter = ruleCounter;
        let subscriptions = [];
        vscode_1.window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        vscode_1.window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        this._ruleCounter.updateRuleCount();
        this._disposable = vscode_1.Disposable.from(...subscriptions);
    }
    dispose() {
        this._disposable.dispose();
    }
    _onEvent() {
        this._ruleCounter.updateRuleCount();
    }
}
exports.RuleCounterController = RuleCounterController;
//# sourceMappingURL=rule-counter.js.map