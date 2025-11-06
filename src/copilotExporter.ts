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

export function scanChatSessionsFromStorageRoot(storageRoot: string, workspaceHash: string): { entries: CopilotEntry[]; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const allEntries: CopilotEntry[] = [];
  const chatSessionsPath = path.join(storageRoot, workspaceHash, 'chatSessions');
  diagnostics.push(`Looking for chat sessions in: ${chatSessionsPath}`);

  if (!fs.existsSync(chatSessionsPath)) {
    diagnostics.push('Chat sessions directory does not exist');
    return { entries: allEntries, diagnostics };
  }

  const sessionFiles = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
  diagnostics.push(`Found ${sessionFiles.length} JSON session files`);

  for (const sessionFile of sessionFiles) {
    try {
      const filePath = path.join(chatSessionsPath, sessionFile);
      const content = fs.readFileSync(filePath, 'utf8');
      const chatSession = JSON.parse(content as string);

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

  diagnostics.push(`Processed files and found ${allEntries.length} valid conversations`);
  return { entries: allEntries, diagnostics };
}
