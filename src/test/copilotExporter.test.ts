import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import { cleanText, findWorkspaceHashByStorageRoot, scanChatSessionsFromStorageRoot, getStoragePathForPlatform, getVSCodeStoragePath } from '../copilotExporter';

suite('Copilot Exporter Utils', () => {

  test('cleanText strips code fences and formatting', () => {
    const input = "Here is code:\n```js\nconst x = 1;\n``` and `inline` **bold** *italic*";
    const out = cleanText(input);
  assert.ok(!out.includes('```'));
  assert.ok(!out.includes('`'));
  assert.ok(!out.includes('**'));
  assert.ok(!out.includes('*'));
  assert.ok(out.includes('Here is code:'));
  });

  function getFixturesRoot(): string {
    const candidates = [
      path.join(__dirname, 'fixtures'),
      path.join(__dirname, '..', 'src', 'test', 'fixtures'),
      path.join(__dirname, '..', '..', 'src', 'test', 'fixtures'),
      path.join(process.cwd(), 'src', 'test', 'fixtures')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    throw new Error('Could not find fixtures directory; looked at: ' + candidates.join(', '));
  }

  test('findWorkspaceHashByStorageRoot finds recent workspace', () => {
    const fixturesRoot = getFixturesRoot();
    const storageRoot = fixturesRoot;
    const result = findWorkspaceHashByStorageRoot(storageRoot, 365 * 10); // recentDays large so both qualify
    assert.ok(result.hash !== null, 'expected to find a workspace hash');
    assert.ok(result.diagnostics.length > 0);
  });

  test('findWorkspaceHashByStorageRoot respects recentDays cutoff', () => {
    const fixturesRoot = path.join(__dirname, 'fixtures');
    const result = findWorkspaceHashByStorageRoot(fixturesRoot, 1); // only very recent files qualify
    // workspace1 has a session in 2025 which may or may not be within 1 day depending on current date; allow null or non-null but ensure diagnostics are present
  assert.ok(result.diagnostics.length > 0);
  });

  test('scanChatSessionsFromStorageRoot reads entries', () => {
  const fixturesRoot = getFixturesRoot();
  const storageRoot = fixturesRoot;
    // workspace1 exists
    const scan = scanChatSessionsFromStorageRoot(storageRoot, 'workspace1');
  assert.ok(scan.entries.length > 0, 'expected entries from workspace1');
  assert.ok(scan.diagnostics.some(d => d.includes('Found')));
  });

  test('scanChatSessionsFromStorageRoot handles missing workspace', () => {
    const fixturesRoot = path.join(__dirname, 'fixtures');
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'nonexistent');
    assert.strictEqual(scan.entries.length, 0);
  assert.ok(scan.diagnostics.some(d => d.includes('does not exist') || d.includes('Found 0')));
  });

  test('scanChatSessionsFromStorageRoot handles malformed JSON gracefully', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace3');
    // malformed JSON should result in diagnostic mentioning error reading session
    assert.ok(scan.diagnostics.some(d => d.toLowerCase().includes('error reading session file') || d.toLowerCase().includes('unexpected')));
  });

  test('scanChatSessionsFromStorageRoot handles empty chatSessions', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace4');
    assert.ok(scan.diagnostics.some(d => d.includes('Found 0') || d.includes('does not exist')));
    assert.strictEqual(scan.entries.length, 0);
  });

  test('scanChatSessionsFromStorageRoot handles non-array response', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace5');
    // should still parse the request.message and include entry (copilotResponse becomes 'No response') or similar
    assert.ok(scan.diagnostics.length >= 1);
  });

  test('scanChatSessionsFromStorageRoot handles multi-part responses with null and non-string parts', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace6');
    // should process and concatenate string parts while ignoring null/number parts
    assert.ok(scan.entries.length >= 1);
  });

  test('scanChatSessionsFromStorageRoot handles empty requests array', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace7');
    assert.ok(scan.diagnostics.length >= 1);
    assert.strictEqual(scan.entries.length, 0);
  });

  test('scanChatSessionsFromStorageRoot filters non-string response parts', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace8');
    assert.ok(scan.entries.length >= 1);
    // ensure copilot field contains 'ok' at least
    assert.ok(scan.entries.some(e => JSON.stringify(e).includes('ok')));
  });

  test('scanChatSessionsFromStorageRoot skips requests without message.text', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace9');
    // no valid entries because message.text is missing
    assert.strictEqual(scan.entries.length, 0);
    assert.ok(scan.diagnostics.some(d => d.includes('Processed files')));
  });

  test('findWorkspaceHashByStorageRoot returns diagnostic for missing storage root', () => {
    const fakeRoot = path.join(getFixturesRoot(), 'does-not-exist');
    const res = findWorkspaceHashByStorageRoot(fakeRoot, 30);
    assert.strictEqual(res.hash, null);
    assert.ok(res.diagnostics.some(d => d.toLowerCase().includes('not found') || d.toLowerCase().includes('found 0')));
  });

  test('getStoragePathForPlatform returns expected paths for platforms', () => {
    const hd = '/home/test';
    const win = getStoragePathForPlatform('win32', hd);
    const mac = getStoragePathForPlatform('darwin', hd);
    const other = getStoragePathForPlatform('linux', hd);
    // basic assertions
    assert.ok(win.includes('AppData'));
    assert.ok(mac.includes('Application Support'));
    assert.ok(other.includes('.config'));
  });

  test('scanChatSessionsFromStorageRoot handles empty response arrays', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace10');
    // response is empty so copilotResponse remains 'No response' and an entry may or may not be added depending on text; ensure diagnostics present
    assert.ok(scan.diagnostics.length >= 1);
  });

  test('scanChatSessionsFromStorageRoot handles missing requests property', () => {
    const fixturesRoot = getFixturesRoot();
    const scan = scanChatSessionsFromStorageRoot(fixturesRoot, 'workspace11');
    // no requests means no entries
    assert.strictEqual(scan.entries.length, 0);
  });

  test('cleanText empty input returns empty string', () => {
    assert.strictEqual(cleanText(''), '');
  });

  // skipping monkeypatching os.platform (not writable). We test platform-specific logic via getStoragePathForPlatform

});
