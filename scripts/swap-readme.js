#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const readme = path.join(root, 'README.md');
const alt = path.join(root, 'vscode-marketplace.md');
const backup = path.join(root, 'README.md.bak');

if (!fs.existsSync(alt)) {
  console.error('vscode-marketplace.md not found');
  process.exit(1);
}

let hadBackup = false;
try {
  if (fs.existsSync(readme)) {
    fs.copyFileSync(readme, backup);
    hadBackup = true;
  }
} catch (e) {
  // ignore
}

try {
  fs.copyFileSync(alt, readme);
} catch (e) {
  console.error('Failed to copy marketplace file to README.md:', e);
  process.exit(1);
}

// If a CHANGELOG.md exists, append it to the temporary README so the VSIX includes release notes
try {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const cl = fs.readFileSync(changelogPath, 'utf8');
    // Append a separator and the changelog
    fs.appendFileSync(readme, `\n\n---\n\n${cl}`, 'utf8');
  }
} catch (e) {
  // non-fatal
  console.warn('Failed to append CHANGELOG to README:', e && String(e));
}

// run packaging
const r = spawnSync('npm', ['run', 'package-vsix'], { stdio: 'inherit', shell: true });

// restore
try {
  if (hadBackup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, readme);
    fs.unlinkSync(backup);
  } else {
    // no previous README - remove the one we created
    try { fs.unlinkSync(readme); } catch (ignored) {}
  }
} catch (e) {
  console.error('Failed to restore README.md:', e);
}

process.exit(r.status || 0);
