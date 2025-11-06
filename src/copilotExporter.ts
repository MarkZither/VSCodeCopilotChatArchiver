import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CopilotEntry {
  key: string;
  content: any;
  timestamp?: string;
  workspace?: string;
  type?: string;
}

export interface CopilotSession {
  file: string;
  filePath: string;
  sessionId?: string;
  creationDate?: string;
  requestCount: number;
  mtime?: number;
  preview?: string;
}

export function cleanText(text: string): string {
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

export function getVSCodeStoragePath(): string {
  return getStoragePathForPlatform(os.platform(), os.homedir());
}

// Testable helper: derive storage path for a given platform and homedir
export function getStoragePathForPlatform(platform: string, homedir: string): string {
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
export function findWorkspaceHashByStorageRoot(storageRoot: string, recentDays = 30): { hash: string | null; diagnostics: string[] } {
  const diagnostics: string[] = [];
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

export function scanChatSessionsFromStorageRoot(storageRoot: string, workspaceHash: string): { entries: CopilotEntry[]; diagnostics: string[]; sessions: CopilotSession[] } {
  const diagnostics: string[] = [];
  const allEntries: CopilotEntry[] = [];
  const sessions: CopilotSession[] = [];
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
      const chatSession = JSON.parse(content as string);

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
              const responseParts: string[] = [];
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
    } catch (error) {
      diagnostics.push(`Error reading session file ${sessionFile}: ${String(error)}`);
    }
  }

  diagnostics.push(`Processed files and found ${allEntries.length} valid conversations across ${sessions.length} sessions`);
  return { entries: allEntries, diagnostics, sessions };
}

// Extracts the textual content for a request, supporting both message.text and message.parts[].text
export function extractRequestText(request: any): string {
  try {
    if (!request || !request.message) { return ''; }
    const msg = request.message;
    if (typeof msg.text === 'string' && msg.text.trim().length > 0) { return msg.text; }
    if (Array.isArray(msg.parts)) {
      const partsText = msg.parts.map((p: any) => (p && typeof p.text === 'string') ? p.text : '').filter(Boolean).join(' ');
      if (partsText.trim().length > 0) { return partsText; }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

// Search sessions for an exact phrase (case-sensitive) and return snippets (cleaned, truncated)
export function findSessionsContainingText(storageRoot: string, workspaceHash: string, searchText: string, snippetLen = 30): { file: string; filePath: string; sessionId?: string; creationDate?: string; requestIndex?: number; snippet: string }[] {
  const results: { file: string; filePath: string; sessionId?: string; creationDate?: string; requestIndex?: number; snippet: string }[] = [];
  const chatSessionsPath = path.join(storageRoot, workspaceHash, 'chatSessions');
  if (!fs.existsSync(chatSessionsPath)) { return results; }
  const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
  for (const sessionFile of sessionFiles) {
    try {
      const filePath = path.join(chatSessionsPath, sessionFile);
      const content = fs.readFileSync(filePath, 'utf8');
      const chatSession = JSON.parse(content as string);
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
            if (start > idx) { start = idx; }
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
            } else if (snippet.length > Math.max(snippetLen, searchText.length)) {
              // keep at most desiredLen
              snippet = snippet.substring(0, Math.max(snippetLen, searchText.length)) + '…';
            }
            results.push({ file: sessionFile, filePath, sessionId, creationDate, requestIndex: i, snippet });
            break; // only first matching request per session
          }
        }
      }
    } catch (e) {
      // ignore errors
    }
  }
  return results;
}
