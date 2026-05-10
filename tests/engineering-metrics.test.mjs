import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  calculateEngineeringMetrics,
  calculateCodeOwnership,
} from '../.test-dist/analyzer/engineering-metrics.js';

const commit = (overrides) => ({
  hash: 'hash',
  author: 'Author',
  email: 'author@example.com',
  date: new Date('2026-01-01T10:00:00+08:00'),
  message: 'message',
  body: '',
  parentHashes: ['parent'],
  files: [],
  ...overrides,
});

const runGit = (repoPath, args, env = {}) => {
  execFileSync('git', args, {
    cwd: repoPath,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, ...env },
  });
};

test('calculateEngineeringMetrics scores commit quality and related engineering signals', () => {
  const metrics = calculateEngineeringMetrics([
    commit({
      hash: 'a1',
      message: 'feat(auth): add login',
      files: [{ path: 'src/auth.ts', added: 20, deleted: 0, status: 'added' }],
    }),
    commit({
      hash: 'b2',
      message: 'fix(api): handle timeout',
      files: [{ path: 'src/api.ts', added: 3, deleted: 2, status: 'modified' }],
    }),
    commit({
      hash: 'c3',
      message: 'fix: patch api again',
      files: [{ path: 'src/api.ts', added: 4, deleted: 1, status: 'modified' }],
    }),
    commit({
      hash: 'd4',
      message: 'misc',
      files: [{ path: 'old.ts', added: 0, deleted: 10, status: 'deleted' }],
    }),
    commit({
      hash: 'e5',
      parentHashes: ['p1', 'p2'],
      message: 'Merge pull request #12 from feature',
      body: 'Merge pull request #12 from feature\n\nCo-authored-by: Reviewer <reviewer@example.com>\nSigned-off-by: Lead <lead@example.com>',
      files: [{ path: 'src/api.ts', added: 1, deleted: 1, status: 'modified' }],
    }),
  ]);

  assert.equal(metrics.commitQuality.conventionalRate, 0.6);
  assert.equal(metrics.commitQuality.scopeCoverageRate, 0.4);
  assert.equal(metrics.commitQuality.averageMessageLength, 20.8);
  assert.equal(metrics.commitQuality.score, 59);
  assert.deepEqual(metrics.bugFixHotFiles.hotFiles[0], {
    path: 'src/api.ts',
    fixCount: 2,
    lastFixDate: new Date('2026-01-01T10:00:00+08:00'),
    fixAuthors: ['Author'],
  });
  assert.equal(metrics.reviewQuality.mergeCommitCount, 1);
  assert.equal(metrics.reviewQuality.reviewedMergeCount, 1);
  assert.equal(metrics.reviewQuality.reviewParticipationRate, 1);
  assert.deepEqual(
    metrics.reviewQuality.reviewers.map((reviewer) => reviewer.email),
    ['reviewer@example.com', 'lead@example.com']
  );
  assert.equal(metrics.changeMix.createdFiles, 1);
  assert.equal(metrics.changeMix.deletedFiles, 1);
  assert.equal(metrics.changeMix.modifiedFiles, 3);
  assert.equal(metrics.changeMix.featureRatio, 0.4);
  assert.equal(metrics.changeMix.refactorRatio, 0.6);
});

test('calculateCodeOwnership uses current HEAD blame to find dominant file owners', () => {
  const repoPath = mkdtempSync(join(tmpdir(), 'commitx-ownership-'));

  try {
    runGit(repoPath, ['init']);
    runGit(repoPath, ['config', 'user.name', 'Alice']);
    runGit(repoPath, ['config', 'user.email', 'alice@example.com']);

    writeFileSync(join(repoPath, 'owned.ts'), 'a1\na2\n');
    runGit(repoPath, ['add', 'owned.ts']);
    runGit(repoPath, ['commit', '-m', 'feat: initial file']);

    writeFileSync(join(repoPath, 'owned.ts'), 'a1\na2\nb3\n');
    runGit(repoPath, ['add', 'owned.ts'], {
      GIT_AUTHOR_NAME: 'Bob',
      GIT_AUTHOR_EMAIL: 'bob@example.com',
      GIT_COMMITTER_NAME: 'Bob',
      GIT_COMMITTER_EMAIL: 'bob@example.com',
    });
    runGit(repoPath, ['commit', '-m', 'feat: extend file'], {
      GIT_AUTHOR_NAME: 'Bob',
      GIT_AUTHOR_EMAIL: 'bob@example.com',
      GIT_COMMITTER_NAME: 'Bob',
      GIT_COMMITTER_EMAIL: 'bob@example.com',
    });
    writeFileSync(join(repoPath, 'owned.ts'), 'a1\na2\nb3\nworktree-only\n');

    const ownership = calculateCodeOwnership(repoPath);

    assert.equal(ownership.totalFiles, 1);
    assert.equal(ownership.files[0].path, 'owned.ts');
    assert.equal(ownership.files[0].ownerEmail, 'alice@example.com');
    assert.equal(ownership.files[0].ownerLines, 2);
    assert.equal(ownership.files[0].totalLines, 3);
    assert.equal(ownership.files[0].ownershipRatio, 2 / 3);
  } finally {
    rmSync(repoPath, { recursive: true, force: true });
  }
});

test('calculateCodeOwnership caps blame work for large repositories', () => {
  const repoPath = mkdtempSync(join(tmpdir(), 'commitx-ownership-cap-'));

  try {
    runGit(repoPath, ['init']);
    runGit(repoPath, ['config', 'user.name', 'Alice']);
    runGit(repoPath, ['config', 'user.email', 'alice@example.com']);

    writeFileSync(join(repoPath, 'first.ts'), 'one\n');
    writeFileSync(join(repoPath, 'second.ts'), 'two\n');
    runGit(repoPath, ['add', 'first.ts', 'second.ts']);
    runGit(repoPath, ['commit', '-m', 'feat: add files']);

    const ownership = calculateCodeOwnership(repoPath, { maxFiles: 1 });

    assert.equal(ownership.totalFiles, 1);
    assert.equal(ownership.files.length, 1);
  } finally {
    rmSync(repoPath, { recursive: true, force: true });
  }
});
