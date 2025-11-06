# Github Copilot Chat Archiver

Archive your GitHub Copilot Chat history to JSON and Markdown for backup, sharing or personal memory.

![Demo GIF](images/demo.gif)

## Overview

This VS Code extension scans the VS Code workspace storage for GitHub Copilot Chat sessions and
exports selected sessions as JSON and a human-readable Markdown summary. It aims to make it easy
for you to back up your Copilot conversations, migrate them between machines, or keep a history
of important exchanges.

## Features

- Detects Copilot Chat sessions stored by VS Code and lists possible workspace contexts.
- Prioritizes the current workspace heuristically so you can quickly choose the right data.
- Streams choices progressively so the picker is responsive for large storage folders.
- Export selected session(s) as JSON and a Markdown report with human/copilot messages.
- Saves a default output folder per-workspace or globally.

## Why use this

- Keep a personal archive of helpful Copilot exchanges.
- Share specific Copilot conversations with teammates.
- Use exported sessions as training data or memory for future prompts.

## How it works

1. Click the status bar item `Archive Copilot Chat`.
2. Quick pick shows a top "Use heuristic workspace" suggestion and streams discovered contexts.
3. Select a storage context, then pick a session or `All sessions` to export.
4. The extension writes a timestamped `.json` and `.md` file to your chosen output folder.

## Privacy & Security

This extension reads local VS Code storage only. It does not transmit your chat data anywhere.

## Marketplace notes

Short description: Archive GitHub Copilot Chat to JSON and Markdown.

Long description: See above.

---

_Update the `images/demo.gif` file to include a short demo for the Marketplace page._