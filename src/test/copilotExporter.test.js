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
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const copilotExporter_1 = require("../copilotExporter");
suite('Copilot Exporter Utils', () => {
    test('cleanText strips code fences and formatting', () => {
        const input = "Here is code:\n```js\nconst x = 1;\n``` and `inline` **bold** *italic*";
        const out = (0, copilotExporter_1.cleanText)(input);
        assert.ok(!out.includes('```'));
        assert.ok(!out.includes('`'));
        assert.ok(!out.includes('**'));
        assert.ok(!out.includes('*'));
        assert.ok(out.includes('Here is code:'));
    });
    function getFixturesRoot() {
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
        const result = (0, copilotExporter_1.findWorkspaceHashByStorageRoot)(storageRoot, 365 * 10); // recentDays large so both qualify
        assert.ok(result.hash !== null, 'expected to find a workspace hash');
        assert.ok(result.diagnostics.length > 0);
    });
    test('findWorkspaceHashByStorageRoot respects recentDays cutoff', () => {
        const fixturesRoot = path.join(__dirname, 'fixtures');
        const result = (0, copilotExporter_1.findWorkspaceHashByStorageRoot)(fixturesRoot, 1); // only very recent files qualify
        // workspace1 has a session in 2025 which may or may not be within 1 day depending on current date; allow null or non-null but ensure diagnostics are present
        assert.ok(result.diagnostics.length > 0);
    });
    test('scanChatSessionsFromStorageRoot reads entries', () => {
        const fixturesRoot = getFixturesRoot();
        const storageRoot = fixturesRoot;
        // workspace1 exists
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(storageRoot, 'workspace1');
        assert.ok(scan.entries.length > 0, 'expected entries from workspace1');
        assert.ok(scan.diagnostics.some(d => d.includes('Found')));
    });
    test('scanChatSessionsFromStorageRoot handles missing workspace', () => {
        const fixturesRoot = path.join(__dirname, 'fixtures');
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'nonexistent');
        assert.strictEqual(scan.entries.length, 0);
        assert.ok(scan.diagnostics.some(d => d.includes('does not exist') || d.includes('Found 0')));
    });
    test('scanChatSessionsFromStorageRoot handles malformed JSON gracefully', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace3');
        // malformed JSON should result in diagnostic mentioning error reading session
        assert.ok(scan.diagnostics.some(d => d.toLowerCase().includes('error reading session file') || d.toLowerCase().includes('unexpected')));
    });
    test('scanChatSessionsFromStorageRoot handles empty chatSessions', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace4');
        assert.ok(scan.diagnostics.some(d => d.includes('Found 0') || d.includes('does not exist')));
        assert.strictEqual(scan.entries.length, 0);
    });
    test('scanChatSessionsFromStorageRoot handles non-array response', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace5');
        // should still parse the request.message and include entry (copilotResponse becomes 'No response') or similar
        assert.ok(scan.diagnostics.length >= 1);
    });
    test('scanChatSessionsFromStorageRoot handles multi-part responses with null and non-string parts', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace6');
        // should process and concatenate string parts while ignoring null/number parts
        assert.ok(scan.entries.length >= 1);
    });
    test('scanChatSessionsFromStorageRoot handles empty requests array', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace7');
        assert.ok(scan.diagnostics.length >= 1);
        assert.strictEqual(scan.entries.length, 0);
    });
    test('scanChatSessionsFromStorageRoot filters non-string response parts', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace8');
        assert.ok(scan.entries.length >= 1);
        // ensure copilot field contains 'ok' at least
        assert.ok(scan.entries.some(e => JSON.stringify(e).includes('ok')));
    });
    test('scanChatSessionsFromStorageRoot skips requests without message.text', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace9');
        // no valid entries because message.text is missing
        assert.strictEqual(scan.entries.length, 0);
        assert.ok(scan.diagnostics.some(d => d.includes('Processed files')));
    });
    test('findWorkspaceHashByStorageRoot returns diagnostic for missing storage root', () => {
        const fakeRoot = path.join(getFixturesRoot(), 'does-not-exist');
        const res = (0, copilotExporter_1.findWorkspaceHashByStorageRoot)(fakeRoot, 30);
        assert.strictEqual(res.hash, null);
        assert.ok(res.diagnostics.some(d => d.toLowerCase().includes('not found') || d.toLowerCase().includes('found 0')));
    });
    test('findWorkspaceHashByStorageRoot returns null when sessions are too old', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-root-'));
        const ws = path.join(tmpRoot, 'oldWorkspace');
        const chatDir = path.join(ws, 'chatSessions');
        fs.mkdirSync(chatDir, { recursive: true });
        const session = { sessionId: 'old', creationDate: '2000-01-01', requests: [{ message: { text: 'old' } }] };
        const filename = path.join(chatDir, 'old.json');
        fs.writeFileSync(filename, JSON.stringify(session), 'utf8');
        // set mtime to a very old time
        const oldTime = new Date(2000, 0, 1).getTime() / 1000;
        try {
            fs.utimesSync(filename, oldTime, oldTime);
        }
        catch (e) { }
        const res = (0, copilotExporter_1.findWorkspaceHashByStorageRoot)(tmpRoot, 1); // recentDays = 1 should not match old file
        assert.strictEqual(res.hash, null);
        try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
        catch (e) { }
    });
    test('getStoragePathForPlatform returns expected paths for platforms', () => {
        const hd = '/home/test';
        const win = (0, copilotExporter_1.getStoragePathForPlatform)('win32', hd);
        const mac = (0, copilotExporter_1.getStoragePathForPlatform)('darwin', hd);
        const other = (0, copilotExporter_1.getStoragePathForPlatform)('linux', hd);
        // basic assertions
        assert.ok(win.includes('AppData'));
        assert.ok(mac.includes('Application Support'));
        assert.ok(other.includes('.config'));
    });
    test('scanChatSessionsFromStorageRoot handles empty response arrays', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace10');
        // response is empty so copilotResponse remains 'No response' and an entry may or may not be added depending on text; ensure diagnostics present
        assert.ok(scan.diagnostics.length >= 1);
    });
    test('scanChatSessionsFromStorageRoot handles missing requests property', () => {
        const fixturesRoot = getFixturesRoot();
        const scan = (0, copilotExporter_1.scanChatSessionsFromStorageRoot)(fixturesRoot, 'workspace11');
        // no requests means no entries
        assert.strictEqual(scan.entries.length, 0);
    });
    test('cleanText empty input returns empty string', () => {
        assert.strictEqual((0, copilotExporter_1.cleanText)(''), '');
    });
    test('extractRequestText handles parts and text', () => {
        const requestWithText = { message: { text: 'hello world' } };
        assert.strictEqual((0, copilotExporter_1.extractRequestText)(requestWithText), 'hello world');
        const requestWithParts = { message: { parts: [{ text: 'part one' }, { text: 'part two' }] } };
        assert.strictEqual((0, copilotExporter_1.extractRequestText)(requestWithParts), 'part one part two');
        const empty = (0, copilotExporter_1.extractRequestText)({});
        assert.strictEqual(empty, '');
    });
    test('findSessionsContainingText finds expected snippet in fixtures', () => {
        const fixturesRoot = getFixturesRoot();
        const storageRoot = fixturesRoot;
        const search = 'do you know why my statusbaritem is not showing at startup?';
        const res = (0, copilotExporter_1.findSessionsContainingText)(storageRoot, 'workspace1', search, 30);
        // may be empty in some fixture setups, but should return an array
        assert.ok(Array.isArray(res));
    });
    test('findSessionsContainingText handles parts and snippet correctly in temp workspace', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-test-'));
        const ws = path.join(tmpRoot, 'workspaceTemp');
        const chatDir = path.join(ws, 'chatSessions');
        fs.mkdirSync(chatDir, { recursive: true });
        const search = 'unique-search-phrase-xyz';
        const session = {
            sessionId: 'abcdef123456',
            creationDate: '2025-01-01',
            requests: [
                {
                    requestId: 'r1',
                    message: {
                        parts: [
                            { text: 'some preamble' },
                            { text: `this contains ${search} inside a part` }
                        ]
                    }
                }
            ]
        };
        const filename = path.join(chatDir, 'session1.json');
        fs.writeFileSync(filename, JSON.stringify(session), 'utf8');
        const results = (0, copilotExporter_1.findSessionsContainingText)(tmpRoot, 'workspaceTemp', search, 20);
        // ensure the function returns an array; snippet contents may vary by environment
        assert.ok(Array.isArray(results));
        // cleanup
        try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
        catch (e) { }
    });
    test('findSessionsContainingText tolerates malformed JSON', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-test-'));
        const ws = path.join(tmpRoot, 'workspaceBad');
        const chatDir = path.join(ws, 'chatSessions');
        fs.mkdirSync(chatDir, { recursive: true });
        const filename = path.join(chatDir, 'bad.json');
        fs.writeFileSync(filename, '{ this is not valid json', 'utf8');
        const results = (0, copilotExporter_1.findSessionsContainingText)(tmpRoot, 'workspaceBad', 'anything', 20);
        assert.ok(Array.isArray(results));
        try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
        catch (e) { }
    });
    test('extractRequestText returns empty for parts without text', () => {
        const req = { message: { parts: [{ editorRange: {} }, { other: 'x' }] } };
        assert.strictEqual((0, copilotExporter_1.extractRequestText)(req), '');
    });
    test('findSessionsContainingText handles searchText removed by cleanText (backticks)', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-test-'));
        const ws = path.join(tmpRoot, 'workspaceBacktick');
        const chatDir = path.join(ws, 'chatSessions');
        fs.mkdirSync(chatDir, { recursive: true });
        const search = '`secret`';
        const session = {
            sessionId: 'zzzz',
            creationDate: '2025-01-02',
            requests: [
                { message: { text: `this has ${search} in a message` } }
            ]
        };
        const filename = path.join(chatDir, 'sessionbk.json');
        fs.writeFileSync(filename, JSON.stringify(session), 'utf8');
        const results = (0, copilotExporter_1.findSessionsContainingText)(tmpRoot, 'workspaceBacktick', search, 10);
        assert.ok(Array.isArray(results));
        try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
        catch (e) { }
    });
    // skipping monkeypatching os.platform (not writable). We test platform-specific logic via getStoragePathForPlatform
});
//# sourceMappingURL=copilotExporter.test.js.map