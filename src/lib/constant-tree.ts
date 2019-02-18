import * as path from 'path';
import {
    TreeDataProvider, 
    EventEmitter,
    TreeItem,
    TreeItemCollapsibleState,
    Event,
    window,
    Disposable,
    TextEditor,
    Command,
    TextEditorSelectionChangeEvent,
    ExtensionContext
} from 'vscode';

export class AoE2AIConstantProvider implements TreeDataProvider<AIConstant> {
    private _onDidChangeTreeData: EventEmitter<AIConstant | undefined> = new EventEmitter();
    readonly onDidChangeTreeData: Event<AIConstant | undefined> = this._onDidChangeTreeData.event;

    constructor(private context: ExtensionContext, private workspaceRoot: string){
        
    }

    refresh(): void{
        this._onDidChangeTreeData.fire();

    }

    getTreeItem(element: AIConstant): TreeItem{
        return element;
    }

    getChildren(element?: AIConstant): Thenable<AIConstant[]>{

        let editor = window.activeTextEditor;
        if(!editor){
            window.showInformationMessage("[AoE II AI]: No editor found.");
            return Promise.resolve([]);
        }
        let document = editor.document;
        if(!document){
            window.showInformationMessage("[AoE II AI]: No constants found.");
            return Promise.resolve([]);
        }
        if (!element){
            return new Promise(resolve => {
                resolve(this.getConstants(document.getText(),document.lineCount));
            });
        }
    }

    private getConstants(document: string, lineCount: number): AIConstant[] {
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
                 constants.push(new AIConstant(match[2],+(match[3]),TreeItemCollapsibleState.None,this.context.asAbsolutePath(path.join('resources', 'lock.svg'))));
            } 
        }

        return constants;
    }
}

export class AIConstant extends TreeItem {
    public value: number;
    
    constructor(label: string, value: number, collapsibleState: TreeItemCollapsibleState, iconPath: string, command?: Command){
        super(label, collapsibleState);
        this.value = value;
        this.command = command;
        this.iconPath = iconPath;
    }

    get tooltip(): string {
        return `${this.label} = ${this.value}`;
    }

    contextValue = "aoe2ai-constant"
}

export class AIConstantController {
    private constantsTreeProvider: AoE2AIConstantProvider;
    private _disposable: Disposable;
    constructor(context: ExtensionContext){
        let doc = window.activeTextEditor.document;
        this.constantsTreeProvider = new AoE2AIConstantProvider(context,doc.getText());
        let subscriptions: Disposable[] = [];
        window.registerTreeDataProvider("aoe2-ai-constants", this.constantsTreeProvider);
        window.onDidChangeActiveTextEditor(this._refreshConstantTree, this, subscriptions);
        window.onDidChangeTextEditorSelection(this._refreshConstantTreeSel, this, subscriptions);
        this._disposable = Disposable.from(...subscriptions);
    }

    private _refreshConstantTree(e: TextEditor){
        this.constantsTreeProvider.refresh();
    }
    
    private _refreshConstantTreeSel(sel: TextEditorSelectionChangeEvent){
        this.constantsTreeProvider.refresh();
    }

    dispose(){
        this._disposable.dispose();
    }
}
