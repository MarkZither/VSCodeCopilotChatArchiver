"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// Minimal valid extension entry point. Keeps behavior minimal to ensure compilation.
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const util_1 = require("util");
const copilotExporter_1 = require("./copilotExporter");
const configHelper_1 = require("./configHelper");
const writeFile = (0, util_1.promisify)(fs.writeFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
function activate(context) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(file-code) Archive Copilot Chat";
    statusBarItem.command = 'github-copilot-chat-archiver.exportWorkspaceHistory';
    statusBarItem.tooltip = 'Archive GitHub Copilot chat history';
    statusBarItem.show();
    const setOutCommand = vscode.commands.registerCommand('github-copilot-chat-archiver.setOutputDirectory', async () => {
        const uri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select default output folder' });
        if (!uri || uri.length === 0) {
            vscode.window.showInformationMessage('No folder selected');
            return;
        }
        const dir = uri[0].fsPath;
        await vscode.workspace.getConfiguration('github-copilot-chat-archiver').update('outputDirectory', dir, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Saved default output folder: ${dir}`);
    });
    const exportCommand = vscode.commands.registerCommand('github-copilot-chat-archiver.exportWorkspaceHistory', async () => {
        const output = vscode.window.createOutputChannel('Copilot Archiver');
        output.show(true);
        output.appendLine('Starting Copilot Archiver...');
        try {
            const workspaceStoragePath = (0, copilotExporter_1.getVSCodeStoragePath)();
            output.appendLine(`Storage root: ${workspaceStoragePath}`);
            // Heuristic detection and candidate enumeration
            let workspaceResult = (0, copilotExporter_1.findWorkspaceHashByStorageRoot)(workspaceStoragePath);
            output.appendLine(`Heuristic result: ${JSON.stringify(workspaceResult)}`);
            const candidates = [];
            try {
                if (fs.existsSync(workspaceStoragePath)) {
                    const dirs = fs.readdirSync(workspaceStoragePath);
                    const wf = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
                    const wfName = vscode.workspace.name || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] && vscode.workspace.workspaceFolders[0].name) || '';
                    for (const d of dirs) {
                        const chatSessionsPath = path.join(workspaceStoragePath, d, 'chatSessions');
                        if (!fs.existsSync(chatSessionsPath)) {
                            continue;
                        }
                        const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
                        if (sessionFiles.length === 0) {
                            continue;
                        }
                        // quick recency check (30 days)
                        let mostRecent = 0;
                        for (const f of sessionFiles) {
                            const s = fs.statSync(path.join(chatSessionsPath, f));
                            if (s.mtime.getTime() > mostRecent) {
                                mostRecent = s.mtime.getTime();
                            }
                        }
                        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                        if (mostRecent <= thirtyDaysAgo) {
                            continue;
                        }
                        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(workspaceStoragePath, d);
                        let matches = false;
                        try {
                            if (wf) {
                                const found = (0, copilotExporter_1.findSessionsContainingText)(workspaceStoragePath, d, wf, 20);
                                if (found && found.length > 0) {
                                    matches = true;
                                }
                            }
                            if (!matches && wfName) {
                                const found2 = (0, copilotExporter_1.findSessionsContainingText)(workspaceStoragePath, d, wfName, 20);
                                if (found2 && found2.length > 0) {
                                    matches = true;
                                }
                            }
                        }
                        catch (e) {
                            // ignore
                        }
                        candidates.push({ hash: d, sessions: scan.sessions, diagnostics: scan.diagnostics, path: chatSessionsPath, matches });
                    }
                    // prefer matches
                    candidates.sort((a, b) => ((a.matches ? 0 : 1) - (b.matches ? 0 : 1)));
                }
            }
            catch (e) {
                output.appendLine(`Error enumerating candidates: ${String(e)}`);
            }
            // If workspace context is available, always prompt user (no auto-selection)
            let chosenHash = undefined;
            if ((0, configHelper_1.canSaveForWorkspace)()) {
                if (candidates.length > 0) {
                    const items = candidates.map(c => ({ label: c.hash + (c.matches ? '  (current workspace)' : ''), description: `${c.sessions.length} sessions`, detail: c.path, hash: c.hash }));
                    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Select which storage context to scan for Copilot sessions' });
                    if (!pick) {
                        vscode.window.showInformationMessage('Export cancelled');
                        return;
                    }
                    chosenHash = pick.hash;
                    output.appendLine(`User selected storage hash: ${chosenHash}`);
                }
                else {
                    // fall back to heuristic
                    chosenHash = workspaceResult.hash || undefined;
                }
            }
            else {
                // no workspace open — prefer heuristic or a single candidate
                if (candidates.length > 0) {
                    chosenHash = candidates[0].hash;
                }
                else {
                    chosenHash = workspaceResult.hash || undefined;
                }
            }
            // Continue with minimal export action to prove functionality
            const folders = vscode.workspace.workspaceFolders || [];
            const defaultOut = folders.length ? path.join(folders[0].uri.fsPath, 'copilot_exports') : path.join(os.homedir(), 'copilot_exports');
            await mkdir(defaultOut, { recursive: true });
            // Scan chosen workspace hash to collect entries (if any)
            const allEntries = [];
            const diagnostics = [];
            const sessionsForUi = [];
            if (chosenHash) {
                try {
                    const scanResult = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)((0, copilotExporter_1.getVSCodeStoragePath)(), chosenHash);
                    diagnostics.push(...scanResult.diagnostics);
                    allEntries.push(...scanResult.entries);
                    for (const s of scanResult.sessions) {
                        sessionsForUi.push({ label: `${s.sessionId || s.file} (${s.requestCount} req)`, detail: `${s.file} - ${s.creationDate || 'unknown'}`, session: s, preview: s.preview });
                    }
                }
                catch (e) {
                    diagnostics.push(`Error scanning sessions: ${String(e)}`);
                }
            }
            // Build quick pick items for sessions (include an "All sessions" option)
            const quickItems = [];
            quickItems.push({ label: 'All sessions', description: `${allEntries.length} entries` });
            for (const s of sessionsForUi) {
                quickItems.push({ label: s.label, description: `${s.session.requestCount} req`, detail: s.detail });
            }
            // Let user pick a session to export (or All sessions)
            let entriesToExport = [];
            if (quickItems.length > 0) {
                const qp = vscode.window.createQuickPick();
                qp.items = quickItems;
                qp.placeholder = 'Select a Copilot session to export';
                qp.show();
                const pick = await new Promise(resolve => {
                    const disposables = [];
                    disposables.push(qp.onDidAccept(() => { resolve(qp.selectedItems[0]); qp.hide(); disposables.forEach(d => d.dispose()); }));
                    disposables.push(qp.onDidHide(() => { resolve(undefined); disposables.forEach(d => d.dispose()); }));
                });
                qp.dispose();
                if (!pick) {
                    vscode.window.showInformationMessage('Export cancelled');
                    return;
                }
                if (pick.label !== 'All sessions') {
                    const chosen = sessionsForUi.find((s) => s.label === pick.label).session;
                    entriesToExport = allEntries.filter(e => e.workspace === chosenHash && (String(e.content.session) === String(chosen.sessionId) || String(chosen.file).endsWith(String(e.content.session) + '.json')));
                }
                else {
                    entriesToExport = allEntries.slice();
                }
            }
            if (entriesToExport.length > 0) {
                // write JSON
                const outputFile = path.join(defaultOut, `copilot_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
                await writeFile(outputFile, JSON.stringify(entriesToExport, null, 2), 'utf8');
                // write markdown summary
                const mdLines = ['# Copilot Export', `Export date: ${new Date().toLocaleString()}`, '', `Total entries: ${entriesToExport.length}`, ''];
                for (const e of entriesToExport) {
                    mdLines.push('---');
                    mdLines.push(`**Session:** ${e.content.session || ''}`);
                    mdLines.push(`**Date:** ${e.content.date || ''}`);
                    mdLines.push('');
                    mdLines.push('**Human:**');
                    mdLines.push('');
                    mdLines.push(e.content.human || '');
                    mdLines.push('');
                    mdLines.push('**Copilot:**');
                    mdLines.push('');
                    mdLines.push(e.content.copilot || '');
                    mdLines.push('');
                }
                const mdFile = outputFile.replace(/\.json$/, '.md');
                await writeFile(mdFile, mdLines.join('\n'), 'utf8');
                const message = `Copilot export complete! ${entriesToExport.length} entries exported to ${outputFile}`;
                const action = await vscode.window.showInformationMessage(message, 'Open File', 'Open Folder');
                if (action === 'Open File') {
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputFile));
                }
                else if (action === 'Open Folder') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(defaultOut));
                }
            }
            else {
                // No entries — write diagnostic markdown and inform the user
                const diagnosticReport = ['🔍 **Copilot Export Diagnostics**', '', '**Search Details:**', ...diagnostics.map(d => `• ${d}`), '', '**Possible Solutions:**', '• Make sure you have used GitHub Copilot Chat in this workspace', "• Try opening a different workspace where you've used Copilot", '• Check if VS Code is storing data in a custom location', '• On Windows, data might be in a different AppData folder', '• The extension looks for chat sessions from the last 30 days'].join('\n');
                const diagnosticFile = path.join(defaultOut, `copilot_export_diagnostics_${Date.now()}.md`);
                await writeFile(diagnosticFile, diagnosticReport, 'utf8');
                const action = await vscode.window.showWarningMessage('No Copilot data found. Click "View Details" to see diagnostic information.', 'View Details', 'Close');
                if (action === 'View Details') {
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(diagnosticFile));
                }
            }
        }
        catch (e) {
            output.appendLine(`Error during export: ${String(e)}`);
            vscode.window.showErrorMessage('Error during Copilot export — see output channel');
        }
    });
    const disposable = vscode.commands.registerCommand('github-copilot-chat-archiver.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Github Copilot Chat Archiver!');
    });
    context.subscriptions.push(statusBarItem, setOutCommand, exportCommand, disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map