// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { cleanText, getVSCodeStoragePath, findWorkspaceHashByStorageRoot, scanChatSessionsFromStorageRoot, CopilotEntry } from './copilotExporter';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	  // Status bar button
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(file-code) Archive Copilot Chat";
	statusBarItem.command = 'github-copilot-chat-archiver.exportWorkspaceHistory';
	statusBarItem.tooltip = "Archive GitHub Copilot chat history";
	statusBarItem.show();
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "github-copilot-chat-archiver" is now active!');

	const exportCommand = vscode.commands.registerCommand('github-copilot-chat-archiver.exportWorkspaceHistory', async () => {
	    try {
	      // Get output directory
	      const folders = vscode.workspace.workspaceFolders || [];
	      const defaultOut = folders.length ? path.join(folders[0].uri.fsPath, 'copilot_exports') : path.join(os.homedir(), 'copilot_exports');

	      const outUri = await vscode.window.showOpenDialog({
	        canSelectFolders: true,
	        canSelectFiles: false,
	        openLabel: 'Select output folder'
	      });

	      const outDir = outUri ? outUri[0].fsPath : defaultOut;
	      await mkdir(outDir, { recursive: true } as any);

				// Collect entries using the shared exporter helpers
				const allEntries: CopilotEntry[] = [];
				const diagnostics: string[] = [];

				// Determine workspace hash using storage path heuristic
				const workspaceStoragePath = getVSCodeStoragePath();
				const workspaceResult = findWorkspaceHashByStorageRoot(workspaceStoragePath);
				if (!workspaceResult.hash) {
					diagnostics.push(...workspaceResult.diagnostics);
				} else {
					const scanResult = scanChatSessionsFromStorageRoot(workspaceStoragePath, workspaceResult.hash);
					diagnostics.push(...scanResult.diagnostics);
					allEntries.push(...scanResult.entries);
				}

	      if (allEntries.length > 0) {
	        const outputFile = path.join(outDir, `copilot_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	        await writeFile(outputFile, JSON.stringify(allEntries, null, 2), 'utf8');

	        // Also write a markdown summary
	        const mdLines: string[] = ['# Copilot Export', `Export date: ${new Date().toLocaleString()}`, '', `Total entries: ${allEntries.length}`, ''];
	        for (const e of allEntries) {
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

	        const message = `Copilot export complete! ${allEntries.length} entries exported to ${outputFile}`;
	        const action = await vscode.window.showInformationMessage(message, 'Open File', 'Open Folder');
	        if (action === 'Open File') {
	          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputFile));
	        } else if (action === 'Open Folder') {
	          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outDir));
	        }
	      } else {
	        const diagnosticReport = [
	          '🔍 **Copilot Export Diagnostics**',
	          '',
	          '**Search Details:**',
	          ...diagnostics.map(d => `• ${d}`),
	          '',
	          '**Possible Solutions:**',
	          '• Make sure you have used GitHub Copilot Chat in this workspace',
	          "• Try opening a different workspace where you've used Copilot",
	          '• Check if VS Code is storing data in a custom location',
	          '• On Windows, data might be in a different AppData folder',
	          '• The extension looks for chat sessions from the last 30 days'
	        ].join('\n');

	        const diagnosticFile = path.join(outDir, `copilot_export_diagnostics_${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
	        await writeFile(diagnosticFile, diagnosticReport, 'utf8');
	        const action = await vscode.window.showWarningMessage('No Copilot data found. Click "View Details" to see diagnostic information.', 'View Details', 'Close');
	        if (action === 'View Details') {
	          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(diagnosticFile));
	        }
	      }

	    } catch (error) {
			vscode.window.showErrorMessage('Copilot export failed: ' + String(error));
	    }
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('github-copilot-chat-archiver.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Github Copilot Chat Archiver!');
	});

	context.subscriptions.push(statusBarItem, exportCommand, disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
