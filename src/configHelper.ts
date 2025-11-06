function resolveVscodeModule(): any {
  const cache = require.cache || {};
  const key = Object.keys(cache).find(k => k === 'vscode' || /(^|[\\/])vscode([\\/]|$)/i.test(k));
  if (key) {
    return (cache as any)[key].exports;
  }
  try {
    return require('vscode');
  } catch {
    return undefined;
  }
}

function hasWorkspaceAvailable(vscodeModule: any): boolean {
  return !!(vscodeModule && vscodeModule.workspace && Array.isArray(vscodeModule.workspace.workspaceFolders) && vscodeModule.workspace.workspaceFolders.length > 0);
}

export function getSaveChoices(): string[] {
  const vscode = resolveVscodeModule();
  if (hasWorkspaceAvailable(vscode)) {
    return ['Save for Workspace', 'Save Globally', 'No'];
  }
  return ['Save Globally', 'No'];
}

export function canSaveForWorkspace(): boolean {
  const vscode = resolveVscodeModule();
  return hasWorkspaceAvailable(vscode);
}

export default { getSaveChoices, canSaveForWorkspace };
