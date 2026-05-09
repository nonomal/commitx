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
