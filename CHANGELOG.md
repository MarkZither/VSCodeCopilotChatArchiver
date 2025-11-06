# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project adheres to semantic versioning.

## [Unreleased]

### Added
- Streaming QuickPick that streams storage-context candidates as they are discovered. Picker opens immediately and shows a top "Use heuristic workspace" suggestion for the current workspace.
- Placeholder progress text shown while scanning (e.g., "Scanning 3/12 workspaces...").
- `vscode-marketplace.md` file with long description and GIF placeholder for the VS Code Marketplace listing.

### Changed
- Linter configured to ignore generated JS via `ignores` in `eslint.config.mjs`.
- Version bumped to `0.0.2`.

### Fixed
- Several lint warnings auto-fixed via `eslint --fix`.

## [0.0.2] - 2025-11-06

### Added
- Streaming UX and heuristic top-item for faster selection when exporting Copilot chat.
- Marketplace long description draft and demo GIF placeholder.

### Changed
- ESLint configured to ignore generated JS files and output directories.

### Fixed
- Addressed multiple auto-fixable lint warnings.

## [0.0.1] - 2025-11-05

Initial release.
# Change Log

All notable changes to the "github-copilot-chat-archiver" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release