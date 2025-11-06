"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaveChoices = getSaveChoices;
exports.canSaveForWorkspace = canSaveForWorkspace;
function resolveVscodeModule() {
    const cache = require.cache || {};
    const key = Object.keys(cache).find(k => k === 'vscode' || /(^|[\\/])vscode([\\/]|$)/i.test(k));
    if (key) {
        return cache[key].exports;
    }
    try {
        return require('vscode');
    }
    catch {
        return undefined;
    }
}
function hasWorkspaceAvailable(vscodeModule) {
    return !!(vscodeModule && vscodeModule.workspace && Array.isArray(vscodeModule.workspace.workspaceFolders) && vscodeModule.workspace.workspaceFolders.length > 0);
}
function getSaveChoices() {
    const vscode = resolveVscodeModule();
    if (hasWorkspaceAvailable(vscode)) {
        return ['Save for Workspace', 'Save Globally', 'No'];
    }
    return ['Save Globally', 'No'];
}
function canSaveForWorkspace() {
    const vscode = resolveVscodeModule();
    return hasWorkspaceAvailable(vscode);
}
exports.default = { getSaveChoices, canSaveForWorkspace };
//# sourceMappingURL=configHelper.js.map