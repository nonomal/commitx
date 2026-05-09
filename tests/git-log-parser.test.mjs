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
