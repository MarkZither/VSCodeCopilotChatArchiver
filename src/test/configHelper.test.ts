import * as assert from 'assert';
suite('Config Helper', () => {
  // require.resolve('vscode') will throw when the 'vscode' module isn't installed
  // (which is common in unit test environments). Use a safe fallback key for
  // require.cache in that case.
  const vscodeModuleKey = (() => {
    try {
      return require.resolve('vscode');
    } catch {
      return 'vscode';
    }
  })();

  function withFakeVscode(fake: any, fn: (mod: any) => void) {
    const orig = require.cache[vscodeModuleKey];
    // create a fake module in cache
    require.cache[vscodeModuleKey] = { exports: fake } as any;
    try {
      // clear our module from require cache to force reload
      delete require.cache[require.resolve('../configHelper')];
      const mod = require('../configHelper');
      fn(mod);
    } finally {
      if (orig) {
        require.cache[vscodeModuleKey] = orig;
      } else {
        delete require.cache[vscodeModuleKey];
      }
      delete require.cache[require.resolve('../configHelper')];
    }
  }

  test('returns Save for Workspace when workspace open', () => {
    const fakeVscode = { workspace: { workspaceFolders: [ { name: 'ws' } ] } } as any;
    withFakeVscode(fakeVscode, (mod: any) => {
      const choices = mod.getSaveChoices();
      assert.ok(choices.indexOf('Save for Workspace') !== -1);
    });
  });

  test('does not return Save for Workspace when no workspace', () => {
    const fakeVscode = { workspace: { workspaceFolders: [] } } as any;
    withFakeVscode(fakeVscode, (mod: any) => {
      const choices = mod.getSaveChoices();
      assert.ok(choices.indexOf('Save for Workspace') === -1);
    });
  });

  test('resolves vscode from node_modules cache key', () => {
    const fakeVscode = { workspace: { workspaceFolders: [ { name: 'x' } ] } } as any;
    const cacheKey = '/some/path/node_modules/vscode/index.js';
    const orig = require.cache[cacheKey];
    try {
      require.cache[cacheKey] = { exports: fakeVscode } as any;
      delete require.cache[require.resolve('../configHelper')];
      const mod = require('../configHelper');
      const choices = mod.getSaveChoices();
      assert.ok(choices.indexOf('Save for Workspace') !== -1);
    } finally {
      if (orig) {
        require.cache[cacheKey] = orig;
      } else {
        delete require.cache[cacheKey];
      }
      delete require.cache[require.resolve('../configHelper')];
    }
  });

  test('handles missing vscode module gracefully', () => {
    // Temporarily remove any vscode-related cache entries so resolveVscodeModule returns undefined
    const removed: Array<{ key: string; val: any }> = [];
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
    } finally {
      // restore removed cache entries
      for (const r of removed) {
        require.cache[r.key] = r.val;
      }
      delete require.cache[require.resolve('../configHelper')];
    }
  });

  test('resolves vscode from cache key that ends with /vscode', () => {
    const fakeVscode = { workspace: { workspaceFolders: [ { name: 'y' } ] } } as any;
    const cacheKey = '/some/other/path/vscode';
    const orig = require.cache[cacheKey];
    try {
      require.cache[cacheKey] = { exports: fakeVscode } as any;
      delete require.cache[require.resolve('../configHelper')];
      const mod = require('../configHelper');
      const choices = mod.getSaveChoices();
      assert.ok(choices.indexOf('Save for Workspace') !== -1);
    } finally {
      if (orig) {
        require.cache[cacheKey] = orig;
      } else {
        delete require.cache[cacheKey];
      }
      delete require.cache[require.resolve('../configHelper')];
    }
  });

  test('handles vscode object without workspace property', () => {
    const fakeVscode: any = {};
    withFakeVscode(fakeVscode, (mod: any) => {
      const choices = mod.getSaveChoices();
      assert.ok(choices.indexOf('Save for Workspace') === -1);
      assert.ok(choices.indexOf('Save Globally') !== -1);
    });
  });
});
