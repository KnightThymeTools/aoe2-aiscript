"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const rule_counter_1 = require("./lib/rule-counter");
const constant_tree_1 = require("./lib/constant-tree");
let client;
function activate(context) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('out', 'server', 'server.js'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Options to control the language client
    let clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'aoe2ai', }],
        synchronize: {
            // Notify the server about file changes to '.per files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/*.per')
        }
    };
    // Create the language client and start the client.
    client = new vscode_languageclient_1.LanguageClient('ageOfEmpires2AI', 'Age Of Empires II AI', serverOptions, clientOptions);
    let ruleCounter = new rule_counter_1.RuleCounter();
    let ruleCounterController = new rule_counter_1.RuleCounterController(ruleCounter);
    let constantsTreeController = new constant_tree_1.AIConstantController(context);
    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(ruleCounterController);
    context.subscriptions.push(constantsTreeController);
    context.subscriptions.push(ruleCounter);
    context.subscriptions.push(vscode_1.commands.registerCommand("aoe2ai.editor.viewConstantUsage", (args) => {
        if (vscode_1.window.activeTextEditor) {
            let uri = args.uri;
            let position = args.position;
            let ranges = args.ranges;
            let locations = [];
            ranges.forEach((range) => {
                let loc = new vscode_1.Location(vscode_1.Uri.parse(uri), new vscode_1.Range(new vscode_1.Position(range.start.line, range.start.character), new vscode_1.Position(range.end.line, range.end.character)));
                locations.push(loc);
            });
            vscode_1.commands.executeCommand('editor.action.showReferences', vscode_1.Uri.parse(uri), new vscode_1.Position(position[0], position[1]), locations);
        }
        else {
            vscode_1.window.showWarningMessage("Constant References are only available in .per files.");
        }
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand("aoe2ai.editor.viewConstantMisuse", (ranges) => {
        vscode_1.window.showWarningMessage("\"Error highlighting\" (constants) isn't available at the moment. They will be after v0.1.3.");
    }));
    // Start the client. This will also launch the server
    client.start();
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map