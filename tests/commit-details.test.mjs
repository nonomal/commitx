import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStats, mergeStats } from '../.test-dist/analyzer/stats-calculator.js';

const commit = (overrides) => ({
  hash: 'hash',
  author: 'Author',
  email: 'author@example.com',
  date: new Date('2026-01-01T10:00:00+08:00'),
  message: 'message',
  files: [],
  ...overrides,
});

test('calculateStats keeps commit details for report-side filtering', () => {
  const stats = calculateStats([
    commit({
      hash: 'b2',
      date: new Date('2026-01-02T18:30:00+08:00'),
      message: 'feat: later',
      files: [{ path: 'src/later.ts', added: 5, deleted: 1 }],
    }),
    commit({
      hash: 'a1',
      date: new Date('2026-01-01T09:15:00+08:00'),
      message: 'fix: earlier',
      files: [
        { path: 'src/earlier.ts', added: 10, deleted: 2 },
        { path: 'README.md', added: 1, deleted: 0 },
      ],
    }),
  ]);

  assert.equal(stats.commitDetails.length, 2);
  assert.deepEqual(
    stats.commitDetails.map((item) => item.hash),
    ['a1', 'b2']
  );
  assert.deepEqual(stats.commitDetails[0], {
    hash: 'a1',
    author: 'Author',
    email: 'author@example.com',
    date: new Date('2026-01-01T09:15:00+08:00'),
    message: 'fix: earlier',
    repoName: '',
    linesAdded: 11,
    linesDeleted: 2,
    files: [
      { path: 'src/earlier.ts', added: 10, deleted: 2 },
      { path: 'README.md', added: 1, deleted: 0 },
    ],
  });
});

test('mergeStats combines commit details across repositories', () => {
  const first = calculateStats([
    commit({
      hash: 'repo-a',
      date: new Date('2026-01-02T10:00:00+08:00'),
    }),
  ]);
  const second = calculateStats([
    commit({
      hash: 'repo-b',
      date: new Date('2026-01-01T10:00:00+08:00'),
    }),
  ]);
  first.commitDetails.forEach((item) => {
    item.repoName = 'repo-a';
  });
  second.commitDetails.forEach((item) => {
    item.repoName = 'repo-b';
  });

  const merged = mergeStats([first, second]);

  assert.deepEqual(
    merged.commitDetails.map((item) => item.hash),
    ['repo-b', 'repo-a']
  );
  assert.deepEqual(
    merged.commitDetails.map((item) => item.repoName),
    ['repo-b', 'repo-a']
  );
});

test('calculateStats scores commits that explicitly mention AI assistance', () => {
  const stats = calculateStats([
    commit({
      hash: 'ai-assisted',
      message: 'feat: add claude assisted client',
      files: [{ path: 'src/client.ts', added: 120, deleted: 2, status: 'added' }],
    }),
  ]);

  assert.ok(stats.aiMetrics.aiPercentage > 0);
  assert.equal(stats.aiMetrics.suspiciousCommits, 1);
  assert.equal(stats.aiMetrics.highAICommits[0].hash, 'ai-assisted');
  assert.deepEqual(stats.aiMetrics.highAICommits[0].reasons, ['AI 工具关键词', '低删除率大新增']);
  assert.ok(stats.aiMetrics.highAICommits[0].estimatedAILines < stats.aiMetrics.highAICommits[0].linesAdded);
});

test('calculateStats does not treat generic generated output as high AI by itself', () => {
  const stats = calculateStats([
    commit({
      hash: 'generated-types',
      message: 'chore: update generated types',
      files: [{ path: 'src/types.ts', added: 30, deleted: 5, status: 'modified' }],
    }),
  ]);

  assert.equal(stats.aiMetrics.suspiciousCommits, 0);
  assert.equal(stats.aiMetrics.highAICommits.length, 0);
});

test('mergeStats combines AI usage metrics across repositories', () => {
  const first = calculateStats([
    commit({
      hash: 'repo-a-ai',
      author: 'Alice',
      email: 'alice@example.com',
      message: 'feat: generated with cursor',
      files: [{ path: 'src/generated-api.ts', added: 80, deleted: 0, status: 'added' }],
    }),
  ]);
  first.aiMetrics.highAICommits.forEach((item) => {
    item.repoName = 'repo-a';
  });
  first.directoryAIStats.forEach((item) => {
    item.repoName = 'repo-a';
  });
  const second = calculateStats([
    commit({
      hash: 'repo-b-ai',
      author: 'Bob',
      email: 'bob@example.com',
      date: new Date('2026-01-08T10:00:00+08:00'),
      message: 'feat: add copilot output',
      files: [{ path: 'src/client.ts', added: 60, deleted: 1, status: 'added' }],
    }),
  ]);
  second.aiMetrics.highAICommits.forEach((item) => {
    item.repoName = 'repo-b';
  });
  second.directoryAIStats.forEach((item) => {
    item.repoName = 'repo-b';
  });

  const merged = mergeStats([first, second]);

  assert.equal(merged.aiMetrics.suspiciousCommits, 2);
  assert.equal(merged.aiMetrics.totalLines, 140);
  assert.equal(merged.aiMetrics.highAICommits.length, 2);
  assert.deepEqual(
    merged.aiMetrics.highAICommits.map((commit) => commit.repoName).sort(),
    ['repo-a', 'repo-b']
  );
  assert.deepEqual(
    merged.authorAIStats.map((author) => author.email).sort(),
    ['alice@example.com', 'bob@example.com']
  );
  assert.equal(merged.directoryAIStats.length, 2);
  assert.deepEqual(
    merged.directoryAIStats.map((dir) => dir.displayPath).sort(),
    ['repo-a / src', 'repo-b / src']
  );
  assert.ok(merged.aiTrends.length > 0);
});
