import * as path from 'path';
import { Disposable, Event, EventEmitter, Range, ExtensionContext, TextEditor, TextEditorSelectionChangeEvent, TreeDataProvider, TreeItem, TreeItemCollapsibleState, window, workspace, commands, Uri, Position as PrimitivePosition, Location as PrimitiveLocation } from 'vscode';
import { Command, LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, Position, Location, Range as ClientRange } from 'vscode-languageclient';
import { RuleCounter, RuleCounterController } from './lib/rule-counter';
import { AIConstantController } from './lib/constant-tree';
let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(
        path.join('out', 'server', 'server.js')
    );
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'aoe2ai', }],
        synchronize: {
            // Notify the server about file changes to '.per files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/*.per')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'aoe2ai',
        'Age Of Empires II AI',
        serverOptions,
        clientOptions
    );
    let ruleCounter = new RuleCounter();

    let ruleCounterController = new RuleCounterController(ruleCounter);
    let constantsTreeController = new AIConstantController(context);
    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(ruleCounterController);
    context.subscriptions.push(constantsTreeController);
    context.subscriptions.push(ruleCounter);
    context.subscriptions.push(commands.registerCommand("aoe2ai.editor.viewConstantUsage",(args: any) => {
        if(window.activeTextEditor){
            let uri: string = args.uri;
            let position: number[] = args.position;
            let ranges: ClientRange[] = args.ranges;
            let locations: PrimitiveLocation[] = [];
            ranges.forEach((range) => {
                let loc: PrimitiveLocation = new PrimitiveLocation(Uri.parse(uri),new Range(new PrimitivePosition(range.start.line,range.start.character),new PrimitivePosition(range.end.line,range.end.character)));
                locations.push(loc);
            });
             commands.executeCommand('editor.action.showReferences',Uri.parse(uri), new PrimitivePosition(position[0],position[1]),locations);
        } else {
            return;
        }
    }));
    // Start the client. This will also launch the server
    client.start();
}





export function deactivate(): Thenable<void> {
    if (!client) {
        return undefined;
    }
    return client.stop();
}