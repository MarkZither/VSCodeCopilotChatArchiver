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
exports.cleanText = cleanText;
exports.getVSCodeStoragePath = getVSCodeStoragePath;
exports.getStoragePathForPlatform = getStoragePathForPlatform;
exports.findWorkspaceHashByStorageRoot = findWorkspaceHashByStorageRoot;
exports.scanChatSessionsFromStorageRoot = scanChatSessionsFromStorageRoot;
exports.extractRequestText = extractRequestText;
exports.findSessionsContainingText = findSessionsContainingText;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function cleanText(text) {
    if (!text) {
        return '';
    }
    return text
        .replace(/```[\w]*\n?/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\s+/g, ' ');
}
function getVSCodeStoragePath() {
    return getStoragePathForPlatform(os.platform(), os.homedir());
}
// Testable helper: derive storage path for a given platform and homedir
function getStoragePathForPlatform(platform, homedir) {
    switch (platform) {
        case 'win32':
            return path.join(homedir, 'AppData', 'Roaming', 'Code', 'User', 'workspaceStorage');
        case 'darwin':
            return path.join(homedir, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
        default:
            return path.join(homedir, '.config', 'Code', 'User', 'workspaceStorage');
    }
}
/**
 * Look for a workspace storage directory that contains recent chat session files.
 * This function is testable by passing a custom storageRoot.
 */
function findWorkspaceHashByStorageRoot(storageRoot, recentDays = 30) {
    const diagnostics = [];
    if (!fs.existsSync(storageRoot)) {
        diagnostics.push('workspace storage directory not found');
        return { hash: null, diagnostics };
    }
    const workspaceDirs = fs.readdirSync(storageRoot);
    diagnostics.push(`Found ${workspaceDirs.length} workspace directories`);
    let candidatesWithChat = 0;
    for (const workspaceDir of workspaceDirs) {
        const chatSessionsPath = path.join(storageRoot, workspaceDir, 'chatSessions');
        if (fs.existsSync(chatSessionsPath)) {
            candidatesWithChat++;
            const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
            if (sessionFiles.length > 0) {
                let mostRecentTime = 0;
                for (const file of sessionFiles) {
                    const stat = fs.statSync(path.join(chatSessionsPath, file));
                    if (stat.mtime.getTime() > mostRecentTime) {
                        mostRecentTime = stat.mtime.getTime();
                    }
                }
                const thirtyDaysAgo = Date.now() - (recentDays * 24 * 60 * 60 * 1000);
                if (mostRecentTime > thirtyDaysAgo) {
                    diagnostics.push(`Found matching workspace ${workspaceDir} with ${sessionFiles.length} chat sessions`);
                    return { hash: workspaceDir, diagnostics };
                }
            }
        }
    }
    diagnostics.push(`Found ${candidatesWithChat} directories with chat sessions, but none recent`);
    return { hash: null, diagnostics };
}
function scanChatSessionsFromStorageRoot(storageRoot, workspaceHash) {
    const diagnostics = [];
    const allEntries = [];
    const sessions = [];
    const chatSessionsPath = path.join(storageRoot, workspaceHash, 'chatSessions');
    diagnostics.push(`Looking for chat sessions in: ${chatSessionsPath}`);
    if (!fs.existsSync(chatSessionsPath)) {
        diagnostics.push('Chat sessions directory does not exist');
        return { entries: allEntries, diagnostics, sessions };
    }
    const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
    diagnostics.push(`Found ${sessionFiles.length} JSON session files`);
    for (const sessionFile of sessionFiles) {
        try {
            const filePath = path.join(chatSessionsPath, sessionFile);
            const stat = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            const chatSession = JSON.parse(content);
            const sessionId = chatSession.sessionId ? String(chatSession.sessionId) : undefined;
            const creationDate = chatSession.creationDate ? String(chatSession.creationDate) : undefined;
            const requestCount = Array.isArray(chatSession.requests) ? chatSession.requests.length : 0;
            // preview: first human request text cleaned (support message.text or message.parts[].text)
            let preview = '';
            if (requestCount > 0) {
                for (let r = 0; r < chatSession.requests.length; r++) {
                    const req = chatSession.requests[r];
                    const reqText = extractRequestText(req);
                    if (reqText && reqText.trim().length > 0) {
                        preview = cleanText(reqText).substring(0, 200);
                        break;
                    }
                }
            }
            sessions.push({
                file: sessionFile,
                filePath,
                sessionId: sessionId ? sessionId.substring(0, 8) : undefined,
                creationDate,
                requestCount,
                mtime: stat ? stat.mtime.getTime() : undefined,
                preview
            });
            if (chatSession.requests && chatSession.requests.length > 0) {
                for (let i = 0; i < chatSession.requests.length; i++) {
                    const request = chatSession.requests[i];
                    if (request.message && request.message.text) {
                        const userMessage = cleanText(request.message.text);
                        let copilotResponse = 'No response';
                        if (request.response && Array.isArray(request.response)) {
                            const responseParts = [];
                            for (const responsePart of request.response) {
                                if (responsePart && responsePart.value && typeof responsePart.value === 'string') {
                                    responseParts.push(cleanText(responsePart.value));
                                }
                            }
                            if (responseParts.length > 0) {
                                copilotResponse = responseParts.join(' ').trim();
                            }
                        }
                        if (userMessage.length > 0 && copilotResponse.length > 0) {
                            allEntries.push({
                                key: `conversation-${i + 1}`,
                                content: {
                                    session: chatSession.sessionId ? String(chatSession.sessionId).substring(0, 8) : 'unknown',
                                    date: chatSession.creationDate ? new Date(chatSession.creationDate).toLocaleDateString() : new Date().toLocaleDateString(),
                                    human: userMessage,
                                    copilot: copilotResponse
                                },
                                workspace: workspaceHash,
                                type: 'conversation'
                            });
                        }
                    }
                }
            }
        }
        catch (error) {
            diagnostics.push(`Error reading session file ${sessionFile}: ${String(error)}`);
        }
    }
    diagnostics.push(`Processed files and found ${allEntries.length} valid conversations across ${sessions.length} sessions`);
    return { entries: allEntries, diagnostics, sessions };
}
// Extracts the textual content for a request, supporting both message.text and message.parts[].text
function extractRequestText(request) {
    try {
        if (!request || !request.message) {
            return '';
        }
        const msg = request.message;
        if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
            return msg.text;
        }
        if (Array.isArray(msg.parts)) {
            const partsText = msg.parts.map((p) => (p && typeof p.text === 'string') ? p.text : '').filter(Boolean).join(' ');
            if (partsText.trim().length > 0) {
                return partsText;
            }
        }
    }
    catch (e) {
        // ignore
    }
    return '';
}
// Search sessions for an exact phrase (case-sensitive) and return snippets (cleaned, truncated)
function findSessionsContainingText(storageRoot, workspaceHash, searchText, snippetLen = 30) {
    const results = [];
    const chatSessionsPath = path.join(storageRoot, workspaceHash, 'chatSessions');
    if (!fs.existsSync(chatSessionsPath)) {
        return results;
    }
    const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
    for (const sessionFile of sessionFiles) {
        try {
            const filePath = path.join(chatSessionsPath, sessionFile);
            const content = fs.readFileSync(filePath, 'utf8');
            const chatSession = JSON.parse(content);
            const sessionId = chatSession.sessionId ? String(chatSession.sessionId).substring(0, 8) : undefined;
            const creationDate = chatSession.creationDate ? String(chatSession.creationDate) : undefined;
            if (Array.isArray(chatSession.requests)) {
                for (let i = 0; i < chatSession.requests.length; i++) {
                    const req = chatSession.requests[i];
                    const text = extractRequestText(req);
                    if (text && text.indexOf(searchText) !== -1) {
                        // build snippet: centered on match
                        const idx = text.indexOf(searchText);
                        // ensure the returned snippet will include the searchText
                        const desiredLen = Math.max(snippetLen, searchText.length);
                        let start = Math.max(0, idx - Math.floor(desiredLen / 2));
                        if (start > idx) {
                            start = idx;
                        }
                        let rawSnippet = text.substring(start, start + desiredLen);
                        let snippet = cleanText(rawSnippet);
                        // if snippet somehow still lacks the searchText (rare), take a window directly around the match
                        if (snippet.indexOf(searchText) === -1) {
                            const s2 = Math.max(0, idx - Math.floor(desiredLen / 2));
                            rawSnippet = text.substring(s2, s2 + Math.max(desiredLen, searchText.length));
                            snippet = cleanText(rawSnippet);
                        }
                        // truncate only if it's longer than the user-requested snippetLen, but keep the searchText
                        if (snippet.length > snippetLen && snippet.indexOf(searchText) === -1) {
                            snippet = snippet.substring(0, snippetLen) + '…';
                        }
                        else if (snippet.length > Math.max(snippetLen, searchText.length)) {
                            // keep at most desiredLen
                            snippet = snippet.substring(0, Math.max(snippetLen, searchText.length)) + '…';
                        }
                        results.push({ file: sessionFile, filePath, sessionId, creationDate, requestIndex: i, snippet });
                        break; // only first matching request per session
                    }
                }
            }
        }
        catch (e) {
            // ignore errors
        }
    }
    return results;
}
//# sourceMappingURL=copilotExporter.js.map