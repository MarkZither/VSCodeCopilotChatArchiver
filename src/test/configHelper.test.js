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
const assert = __importStar(require("assert"));
suite('Config Helper', () => {
    // require.resolve('vscode') will throw when the 'vscode' module isn't installed
    // (which is common in unit test environments). Use a safe fallback key for
    // require.cache in that case.
    const vscodeModuleKey = (() => {
        try {
            return require.resolve('vscode');
        }
        catch {
            return 'vscode';
        }
    })();
    function withFakeVscode(fake, fn) {
        const orig = require.cache[vscodeModuleKey];
        // create a fake module in cache
        require.cache[vscodeModuleKey] = { exports: fake };
        try {
            // clear our module from require cache to force reload
            delete require.cache[require.resolve('../configHelper')];
            const mod = require('../configHelper');
            fn(mod);
        }
        finally {
            if (orig) {
                require.cache[vscodeModuleKey] = orig;
            }
            else {
                delete require.cache[vscodeModuleKey];
            }
            delete require.cache[require.resolve('../configHelper')];
        }
    }
    test('returns Save for Workspace when workspace open', () => {
        const fakeVscode = { workspace: { workspaceFolders: [{ name: 'ws' }] } };
        withFakeVscode(fakeVscode, (mod) => {
            const choices = mod.getSaveChoices();
            assert.ok(choices.indexOf('Save for Workspace') !== -1);
        });
    });
    test('does not return Save for Workspace when no workspace', () => {
        const fakeVscode = { workspace: { workspaceFolders: [] } };
        withFakeVscode(fakeVscode, (mod) => {
            const choices = mod.getSaveChoices();
            assert.ok(choices.indexOf('Save for Workspace') === -1);
        });
    });
    test('resolves vscode from node_modules cache key', () => {
        const fakeVscode = { workspace: { workspaceFolders: [{ name: 'x' }] } };
        const cacheKey = '/some/path/node_modules/vscode/index.js';
        const orig = require.cache[cacheKey];
        try {
            require.cache[cacheKey] = { exports: fakeVscode };
            delete require.cache[require.resolve('../configHelper')];
            const mod = require('../configHelper');
            const choices = mod.getSaveChoices();
            assert.ok(choices.indexOf('Save for Workspace') !== -1);
        }
        finally {
            if (orig) {
                require.cache[cacheKey] = orig;
            }
            else {
                delete require.cache[cacheKey];
            }
            delete require.cache[require.resolve('../configHelper')];
        }
    });
    test('handles missing vscode module gracefully', () => {
        // Temporarily remove any vscode-related cache entries so resolveVscodeModule returns undefined
        const removed = [];
        for (const k of Object.keys(require.cache)) {
            if (k === 'vscode' || k.endsWith('/vscode') || k.indexOf('node_modules/vscode') !== -1 || k.indexOf('node_modules\\vscode') !== -1) {
                removed.push({ key: k, val: require.cache[k] });
                delete require.cache[k];
            }
        }
        try {
            delete require.cache[require.resolve('../configHelper')];
            const mod = require('../configHelper');
            const choices = mod.getSaveChoices();
            // With no vscode available, we should still get global/no options but not 'Save for Workspace'
            assert.ok(choices.indexOf('Save Globally') !== -1);
            assert.ok(choices.indexOf('No') !== -1);
            assert.ok(choices.indexOf('Save for Workspace') === -1);
        }
        finally {
            // restore removed cache entries
            for (const r of removed) {
                require.cache[r.key] = r.val;
            }
            delete require.cache[require.resolve('../configHelper')];
        }
    });
    test('resolves vscode from cache key that ends with /vscode', () => {
        const fakeVscode = { workspace: { workspaceFolders: [{ name: 'y' }] } };
        const cacheKey = '/some/other/path/vscode';
        const orig = require.cache[cacheKey];
        try {
            require.cache[cacheKey] = { exports: fakeVscode };
            delete require.cache[require.resolve('../configHelper')];
            const mod = require('../configHelper');
            const choices = mod.getSaveChoices();
            assert.ok(choices.indexOf('Save for Workspace') !== -1);
        }
        finally {
            if (orig) {
                require.cache[cacheKey] = orig;
            }
            else {
                delete require.cache[cacheKey];
            }
            delete require.cache[require.resolve('../configHelper')];
        }
    });
    test('handles vscode object without workspace property', () => {
        const fakeVscode = {};
        withFakeVscode(fakeVscode, (mod) => {
            const choices = mod.getSaveChoices();
            assert.ok(choices.indexOf('Save for Workspace') === -1);
            assert.ok(choices.indexOf('Save Globally') !== -1);
        });
    });
});
//# sourceMappingURL=configHelper.test.js.map