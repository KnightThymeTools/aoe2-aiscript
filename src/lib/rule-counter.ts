import * as path from 'path';
import { 
    window, 
    Disposable, 
    StatusBarAlignment, 
    StatusBarItem, 
    TextDocument, 
 } from 'vscode';
import { workspace } from 'vscode';

export class RuleCounter {
    private _statusBarItem: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);

    public static RulePattern: RegExp = new RegExp("((\\(defrule))+","g");

    public updateRuleCount(){
        let editor = window.activeTextEditor;
        if (!editor){
            this._statusBarItem.hide();
            return;
        }
        let doc = editor.document;
        if(doc.languageId == "aoe2ai"){
            let ruleCount = this._getRuleCount(doc);
            this._statusBarItem.text = " $(law) " + ((ruleCount !== 1) ? (ruleCount + " Rules") : "1 Rule");
            let config = workspace.getConfiguration("aoe2ai");
            if (config.get<Boolean>("ruleCounterEnabled")){
                this._statusBarItem.show();
            } else {
                this._statusBarItem.hide();
            }
                    
        }
    }

    private _getRuleCount(doc: TextDocument): number {
        let docContent = doc.getText();
        let ruleCount = 0;
        let docContentLines = docContent.split('\n');
    
        for(var i = 0; i < doc.lineCount; i++){
            let matchRead = RuleCounter.RulePattern.test(docContentLines[i]);
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
export class RuleCounterController {
    private _ruleCounter: RuleCounter;
    private _disposable: Disposable;

    constructor(ruleCounter: RuleCounter){
        this._ruleCounter = ruleCounter;
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        this._ruleCounter.updateRuleCount();

        this._disposable = Disposable.from(...subscriptions);
    }

    dispose(){
        this._disposable.dispose();
    }

    private _onEvent(){
        this._ruleCounter.updateRuleCount();
    }
}