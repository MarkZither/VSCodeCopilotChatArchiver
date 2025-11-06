# VSCode Copilot Chat Archiver
A VSCode Extension to archive Copilot chat

<!-- Badges: CI, coverage and code quality -->

[![CI](https://github.com/MarkZither/VSCodeCopilotChatArchiver/actions/workflows/ci.yml/badge.svg)](https://github.com/MarkZither/VSCodeCopilotChatArchiver/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/MarkZither/VSCodeCopilotChatArchiver/branch/main/graph/badge.svg?token=CODECOV_TOKEN)](https://codecov.io/gh/MarkZither/VSCodeCopilotChatArchiver)
[![SonarCloud](https://sonarcloud.io/api/project_badges/measure?project=MarkZither_VSCodeCopilotChatArchiver&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=MarkZither_VSCodeCopilotChatArchiver)
[![VSCode Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/MarkZither.github-copilot-chat-archiver.svg?color=blue)](https://marketplace.visualstudio.com/items?itemName=MarkZither.github-copilot-chat-archiver)

Inspired by https://github.com/Fzzzhan/vscode-copilot-exporter and following the guidence of https://code.visualstudio.com/api/get-started/your-first-extension, this extension will allow Copilot chat to be exported which might be help to archive or use as a memory for future Copilot chats.

## Publishing

Preparation steps for a 0.0.1 release to the VS Code Marketplace:

1. Ensure `publisher` is set in `package.json` (this repository uses `MarkZither`).
2. Verify `displayName`, `description`, `version` and `engines.vscode` are correct.
3. Install `vsce` to package and publish: `npm i -g vsce`.
4. Build and package:

```powershell
npm run package
npm run package-vsix
```

5. Publish with `vsce publish` (requires Marketplace credentials or Personal Access Token).

The repo contains a `.vscodeignore` and `LICENSE` (MIT) to reduce package size and clarify licensing.
