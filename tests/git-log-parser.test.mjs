import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parseGitLog } from '../.test-dist/analyzer/git-log-parser.js';

const runGit = (repoPath, args) => {
  execFileSync('git', args, {
    cwd: repoPath,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
};

test('parseGitLog passes author filters without shell expansion', async () => {
  const repoPath = mkdtempSync(join(tmpdir(), 'commitx-parser-'));
  const markerPath = join(repoPath, 'shell-marker');
  const authorName = `Alice \`touch ${markerPath}\``;

  try {
    runGit(repoPath, ['init']);
    runGit(repoPath, ['config', 'user.name', 'Test User']);
    runGit(repoPath, ['config', 'user.email', 'test@example.com']);

    writeFileSync(join(repoPath, 'file.txt'), 'hello\n');
    runGit(repoPath, ['add', 'file.txt']);
    runGit(repoPath, [
      'commit',
      '-m',
      'feat: shell-sensitive author',
      `--author=${authorName} <alice@example.com>`,
    ]);

    const commits = await parseGitLog(repoPath, null, authorName);

    assert.equal(commits.length, 1);
    assert.equal(commits[0].author, authorName);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(repoPath, { recursive: true, force: true });
  }
});

test('parseGitLog includes commit body, parent hashes, and file status', async () => {
  const repoPath = mkdtempSync(join(tmpdir(), 'commitx-parser-'));

  try {
    runGit(repoPath, ['init']);
    runGit(repoPath, ['config', 'user.name', 'Test User']);
    runGit(repoPath, ['config', 'user.email', 'test@example.com']);

    writeFileSync(join(repoPath, 'created.txt'), 'hello\n');
    runGit(repoPath, ['add', 'created.txt']);
    runGit(repoPath, [
      'commit',
      '-m',
      'feat(core): create file',
      '-m',
      'Co-authored-by: Reviewer <reviewer@example.com>',
    ]);

    writeFileSync(join(repoPath, 'created.txt'), 'hello\nworld\n');
    runGit(repoPath, ['add', 'created.txt']);
    runGit(repoPath, ['commit', '-m', 'fix(core): update file']);

    const commits = await parseGitLog(repoPath, null);

    assert.equal(commits.length, 2);
    assert.equal(commits[0].message, 'fix(core): update file');
    assert.equal(commits[0].parentHashes.length, 1);
    assert.equal(commits[0].files[0].status, 'modified');
    assert.equal(commits[1].message, 'feat(core): create file');
    assert.match(commits[1].body, /Co-authored-by: Reviewer <reviewer@example.com>/);
    assert.equal(commits[1].files[0].status, 'added');
  } finally {
    rmSync(repoPath, { recursive: true, force: true });
  }
});
