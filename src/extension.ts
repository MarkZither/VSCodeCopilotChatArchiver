// Minimal valid extension entry point. Keeps behavior minimal to ensure compilation.
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { getVSCodeStoragePath, scanChatSessionsFromStorageRoot, findSessionsContainingText, findWorkspaceHashByStorageRoot, cleanText } from './copilotExporter';
import { getSaveChoices, canSaveForWorkspace } from './configHelper';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(file-code) Archive Copilot Chat";
  statusBarItem.command = 'github-copilot-chat-archiver.exportWorkspaceHistory';
  statusBarItem.tooltip = 'Archive GitHub Copilot chat history';
  statusBarItem.show();

  const setOutCommand = vscode.commands.registerCommand('github-copilot-chat-archiver.setOutputDirectory', async () => {
	const uri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select default output folder' });
	if (!uri || uri.length === 0) { vscode.window.showInformationMessage('No folder selected'); return; }
	const dir = uri[0].fsPath;
	await vscode.workspace.getConfiguration('github-copilot-chat-archiver').update('outputDirectory', dir, vscode.ConfigurationTarget.Workspace);
	vscode.window.showInformationMessage(`Saved default output folder: ${dir}`);
  });

  const exportCommand = vscode.commands.registerCommand('github-copilot-chat-archiver.exportWorkspaceHistory', async () => {
	const output = vscode.window.createOutputChannel('Copilot Archiver');
	output.show(true);
	output.appendLine('Starting Copilot Archiver...');

			try {
				const workspaceStoragePath = getVSCodeStoragePath();
				output.appendLine(`Storage root: ${workspaceStoragePath}`);

				// Get output directory (respect saved setting)
				const folders = vscode.workspace.workspaceFolders || [];
				const defaultOut = folders.length ? path.join(folders[0].uri.fsPath, 'copilot_exports') : path.join(os.homedir(), 'copilot_exports');
				const config = vscode.workspace.getConfiguration('github-copilot-chat-archiver');
				const savedOut = config.get<string>('outputDirectory');

				let outDir: string | undefined;
				if (savedOut) {
					const use = await vscode.window.showInformationMessage(`Use saved output folder: ${savedOut}?`, 'Use Saved', 'Choose Folder');
					if (use === 'Use Saved') {
						outDir = savedOut;
					} else {
						const outUri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select output folder' });
						outDir = outUri ? outUri[0].fsPath : undefined;
					}
				} else {
					const outUri = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Select output folder' });
					outDir = outUri ? outUri[0].fsPath : undefined;
				}

				if (!outDir) { outDir = defaultOut; }
				await mkdir(outDir, { recursive: true } as any);

				if (outDir && outDir !== savedOut) {
					const saveOptions = getSaveChoices();
					const saveChoice = await vscode.window.showInformationMessage('Save this output folder as default?', ...saveOptions);
					if (saveChoice === 'Save for Workspace') {
						await config.update('outputDirectory', outDir, vscode.ConfigurationTarget.Workspace);
						output && output.appendLine(`Saved outputDirectory to workspace settings: ${outDir}`);
					} else if (saveChoice === 'Save Globally') {
						await config.update('outputDirectory', outDir, vscode.ConfigurationTarget.Global);
						output && output.appendLine(`Saved outputDirectory to user settings: ${outDir}`);
					}
				}

			// Heuristic detection and candidate enumeration
			let workspaceResult = findWorkspaceHashByStorageRoot(workspaceStoragePath);
			// expose workspace folder info for later UI labeling
			const wf = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
			const wfName = vscode.workspace.name || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] && vscode.workspace.workspaceFolders[0].name) || '';
			output.appendLine(`Heuristic result: ${JSON.stringify(workspaceResult)}`);

			const candidates: Array<{ hash: string; sessions: any[]; diagnostics: string[]; path: string; matches?: boolean }> = [];
			try {
				if (fs.existsSync(workspaceStoragePath)) {
					const dirs = fs.readdirSync(workspaceStoragePath);
					for (const d of dirs) {
						const chatSessionsPath = path.join(workspaceStoragePath, d, 'chatSessions');
						if (!fs.existsSync(chatSessionsPath)) { continue; }
						const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
						if (sessionFiles.length === 0) { continue; }
						// quick recency check (30 days)
						let mostRecent = 0;
						for (const f of sessionFiles) {
							const s = fs.statSync(path.join(chatSessionsPath, f));
							if (s.mtime.getTime() > mostRecent) { mostRecent = s.mtime.getTime(); }
						}
						const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
						if (mostRecent <= thirtyDaysAgo) { continue; }
						const scan = scanChatSessionsFromStorageRoot(workspaceStoragePath, d);
						let matches = false;
						try {
							if (wf) {
								const found = findSessionsContainingText(workspaceStoragePath, d, wf, 20);
								if (found && found.length > 0) { matches = true; }
							}
							if (!matches && wfName) {
								const found2 = findSessionsContainingText(workspaceStoragePath, d, wfName, 20);
								if (found2 && found2.length > 0) { matches = true; }
							}
						} catch (e) {
							// ignore
						}
						candidates.push({ hash: d, sessions: scan.sessions, diagnostics: scan.diagnostics, path: chatSessionsPath, matches });
					}
					// prefer matches
					candidates.sort((a, b) => ((a.matches ? 0 : 1) - (b.matches ? 0 : 1)));
					output.appendLine(`Enumerated ${candidates.length} candidate storage hashes`);
				}
			} catch (e) {
				output.appendLine(`Error enumerating candidates: ${String(e)}`);
			}

			// If we found candidates, always present the chooser so the user sees the list of workspaces/storage hashes
			let chosenHash: string | undefined = undefined;
			if (candidates.length > 0) {
				// log candidate details for debugging
				for (const c of candidates) {
					const preview = c.sessions && c.sessions.length > 0 ? (c.sessions[0].preview || c.sessions[0].file) : '';
					output.appendLine(`candidate: ${c.hash} matches:${c.matches ? 'yes' : 'no'} sessions:${c.sessions.length} preview:${preview}`);
				}
				// Build friendly labels: prefer workspace name when matched, then session preview, else hash
				const items = candidates.map(c => {
					const preview = c.sessions && c.sessions.length > 0 ? (c.sessions[0].preview || c.sessions[0].file) : '';
					const friendly = (c.matches && wfName) ? wfName : (preview ? cleanText(preview).substring(0, 60) : c.hash);
					return ({ label: friendly, description: `${c.sessions.length} sessions`, detail: `${c.hash} — ${c.path}`, hash: c.hash, matches: c.matches } as any);
				});

				// determine preferred index (first matching candidate or 0)
				const preferredIndex = items.findIndex(i => (i as any).matches);
				const qp = vscode.window.createQuickPick<vscode.QuickPickItem & { hash?: string; matches?: boolean }>();
				qp.items = items;
				if (preferredIndex >= 0 && qp.items && qp.items.length > preferredIndex) {
					qp.activeItems = [qp.items[preferredIndex]];
				} else if (qp.items && qp.items.length > 0) {
					qp.activeItems = [qp.items[0]];
				}
				qp.placeholder = 'Select which storage context to scan for Copilot sessions';
				qp.show();
				const pick = await new Promise<typeof qp.items[0] | undefined>(resolve => {
					const disposables: vscode.Disposable[] = [];
					disposables.push(qp.onDidAccept(() => { resolve(qp.selectedItems[0] as any); qp.hide(); disposables.forEach(d => d.dispose()); }));
					disposables.push(qp.onDidHide(() => { resolve(undefined); disposables.forEach(d => d.dispose()); }));
				});
				qp.dispose();
				if (!pick) { vscode.window.showInformationMessage('Export cancelled'); return; }
				chosenHash = (pick as any).hash;
				output.appendLine(`User selected storage hash: ${chosenHash}`);
			} else {
				// no candidates found — fall back to heuristic
				chosenHash = workspaceResult.hash || undefined;
			}

			// Continue with minimal export action to prove functionality
				await mkdir(outDir!, { recursive: true } as any);

				// Scan chosen workspace hash to collect entries (if any)
				const allEntries: any[] = [];
				const diagnostics: string[] = [];
				const sessionsForUi: any[] = [];
				if (chosenHash) {
					try {
						const scanResult = scanChatSessionsFromStorageRoot(getVSCodeStoragePath(), chosenHash);
						diagnostics.push(...scanResult.diagnostics);
						allEntries.push(...scanResult.entries);
						for (const s of scanResult.sessions) {
							// Build a friendly preview label from the session preview or first request
							const rawPreview = s.preview || s.file || (s.sessionId ? String(s.sessionId) : '');
							const cleanedPreview = cleanText(String(rawPreview || '')).replace(/\s+/g, ' ').trim();
							const labelPreview = cleanedPreview ? (cleanedPreview.length > 80 ? cleanedPreview.substring(0, 80) + '…' : cleanedPreview) : (s.sessionId || s.file || 'Unnamed session');
							const descriptionId = s.sessionId || s.file || '';
							// label: readable starting message; description: GUID or filename; detail: file + creation + request count
							sessionsForUi.push({ label: labelPreview, description: descriptionId, detail: `${s.file} - ${s.creationDate || 'unknown'}`, session: s, preview: s.preview });
						}
					} catch (e) {
						diagnostics.push(`Error scanning sessions: ${String(e)}`);
					}
				}

				// Build quick pick items for sessions (include an "All sessions" option)
				const quickItems: vscode.QuickPickItem[] = [];
				quickItems.push({ label: 'All sessions', description: `${allEntries.length} entries` });
				for (const s of sessionsForUi) {
					quickItems.push({ label: s.label, description: `${s.session.requestCount} req`, detail: s.detail } as vscode.QuickPickItem);
				}

				// Let user pick a session to export (or All sessions)
				let entriesToExport: any[] = [];
				if (quickItems.length > 0) {
					const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
					qp.items = quickItems;
					qp.placeholder = 'Select a Copilot session to export';
					qp.show();
					const pick = await new Promise<vscode.QuickPickItem | undefined>(resolve => {
						const disposables: vscode.Disposable[] = [];
						disposables.push(qp.onDidAccept(() => { resolve(qp.selectedItems[0]); qp.hide(); disposables.forEach(d => d.dispose()); }));
						disposables.push(qp.onDidHide(() => { resolve(undefined); disposables.forEach(d => d.dispose()); }));
					});
					qp.dispose();
					if (!pick) { vscode.window.showInformationMessage('Export cancelled'); return; }

					if (pick.label !== 'All sessions') {
						const chosen = sessionsForUi.find((s: any) => s.label === pick.label).session as any;
						entriesToExport = allEntries.filter(e => e.workspace === chosenHash && (String(e.content.session) === String(chosen.sessionId) || String(chosen.file).endsWith(String(e.content.session) + '.json')));
					} else {
						entriesToExport = allEntries.slice();
					}
				}

				if (entriesToExport.length > 0) {
					// write JSON
					const outputFile = path.join(outDir!, `copilot_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
					await writeFile(outputFile, JSON.stringify(entriesToExport, null, 2), 'utf8');
					// write markdown summary
					const mdLines: string[] = ['# Copilot Export', `Export date: ${new Date().toLocaleString()}`, '', `Total entries: ${entriesToExport.length}`, ''];
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
					if (action === 'Open File') { vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputFile)); }
					else if (action === 'Open Folder') { vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outDir!)); }
				} else {
					// No entries — write diagnostic markdown and inform the user
					const diagnosticReport = ['🔍 **Copilot Export Diagnostics**', '', '**Search Details:**', ...diagnostics.map(d => `• ${d}`), '', '**Possible Solutions:**', '• Make sure you have used GitHub Copilot Chat in this workspace', "• Try opening a different workspace where you've used Copilot", '• Check if VS Code is storing data in a custom location', '• On Windows, data might be in a different AppData folder', '• The extension looks for chat sessions from the last 30 days'].join('\n');
					const diagnosticFile = path.join(outDir!, `copilot_export_diagnostics_${Date.now()}.md`);
					await writeFile(diagnosticFile, diagnosticReport, 'utf8');
					const action = await vscode.window.showWarningMessage('No Copilot data found. Click "View Details" to see diagnostic information.', 'View Details', 'Close');
					if (action === 'View Details') { vscode.commands.executeCommand('vscode.open', vscode.Uri.file(diagnosticFile)); }
				}
		} catch (e) {
			output.appendLine(`Error during export: ${String(e)}`);
			vscode.window.showErrorMessage('Error during Copilot export — see output channel');
		}
  });

  const disposable = vscode.commands.registerCommand('github-copilot-chat-archiver.helloWorld', () => {
	vscode.window.showInformationMessage('Hello World from Github Copilot Chat Archiver!');
  });

  context.subscriptions.push(statusBarItem, setOutCommand, exportCommand, disposable);
}

export function deactivate() {}
