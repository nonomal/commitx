import { execFileSync } from 'node:child_process';
import type {
  BugFixAnalysis,
  BugFixHotFile,
  ChangeMixMetrics,
  CodeOwnershipMetrics,
  CommitQualityMetrics,
  CommitRecord,
  FileChange,
  FileOwnerContribution,
  FileOwnership,
  ReviewParticipant,
  ReviewQualityMetrics,
  EngineeringMetrics,
} from '../types/index.js';

const CONVENTIONAL_RE =
  /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([^)]+\))?!?:\s+\S/i;
const SCOPED_CONVENTIONAL_RE =
  /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)\([^)]+\)!?:\s+\S/i;
const FIX_RE = /^fix(\([^)]+\))?!?:\s+\S/i;
const REVIEW_TRAILER_RE =
  /^(Co-authored-by|Signed-off-by):\s*(.*?)\s*<([^<>]+)>$/gim;
const DEFAULT_OWNERSHIP_FILE_LIMIT = 200;
const OWNERSHIP_EXTENSIONS = new Set([
  '.c',
  '.cpp',
  '.css',
  '.go',
  '.h',
  '.html',
  '.java',
  '.js',
  '.jsx',
  '.md',
  '.py',
  '.rs',
  '.scss',
  '.ts',
  '.tsx',
  '.vue',
]);

interface CodeOwnershipOptions {
  maxFiles?: number;
  candidateFiles?: string[];
}

export function calculateEngineeringMetrics(
  commits: CommitRecord[],
  repoPath?: string
): EngineeringMetrics {
  return {
    ...(repoPath && {
      codeOwnership: calculateCodeOwnership(repoPath, {
        candidateFiles: selectOwnershipCandidates(commits),
      }),
    }),
    bugFixHotFiles: calculateBugFixHotFiles(commits),
    reviewQuality: calculateReviewQuality(commits),
    commitQuality: calculateCommitQuality(commits),
    changeMix: calculateChangeMix(commits),
  };
}

export function calculateCodeOwnership(
  repoPath: string,
  options: CodeOwnershipOptions = {}
): CodeOwnershipMetrics {
  const trackedFiles = listTrackedFiles(repoPath);
  const trackedSet = new Set(trackedFiles);
  const maxFiles = options.maxFiles ?? DEFAULT_OWNERSHIP_FILE_LIMIT;
  const candidates = options.candidateFiles
    ? options.candidateFiles.filter((file) => trackedSet.has(file))
    : trackedFiles;
  const filesToBlame = candidates
    .filter(isOwnershipTargetFile)
    .slice(0, maxFiles);
  const files: FileOwnership[] = [];

  for (const filePath of filesToBlame) {
    const ownership = calculateFileOwnership(repoPath, filePath);
    if (ownership) {
      files.push(ownership);
    }
  }

  files.sort((a, b) => {
    if (b.ownerLines !== a.ownerLines) return b.ownerLines - a.ownerLines;
    return b.ownershipRatio - a.ownershipRatio;
  });

  return {
    totalFiles: files.length,
    files,
  };
}

function calculateBugFixHotFiles(commits: CommitRecord[]): BugFixAnalysis {
  const hotFileMap = new Map<
    string,
    { fixCount: number; lastFixDate: Date; fixAuthors: Set<string> }
  >();
  let fixCommitCount = 0;

  for (const commit of commits) {
    if (!FIX_RE.test(commit.message)) continue;

    fixCommitCount++;
    for (const file of commit.files) {
      const entry = hotFileMap.get(file.path) || {
        fixCount: 0,
        lastFixDate: commit.date,
        fixAuthors: new Set<string>(),
      };
      entry.fixCount++;
      entry.fixAuthors.add(commit.author);
      if (commit.date > entry.lastFixDate) {
        entry.lastFixDate = commit.date;
      }
      hotFileMap.set(file.path, entry);
    }
  }

  const hotFiles: BugFixHotFile[] = Array.from(hotFileMap.entries())
    .map(([path, data]) => ({
      path,
      fixCount: data.fixCount,
      lastFixDate: data.lastFixDate,
      fixAuthors: Array.from(data.fixAuthors),
    }))
    .sort((a, b) => {
      if (b.fixCount !== a.fixCount) return b.fixCount - a.fixCount;
      return b.lastFixDate.getTime() - a.lastFixDate.getTime();
    })
    .slice(0, 20);

  return { fixCommitCount, hotFiles };
}

function calculateReviewQuality(commits: CommitRecord[]): ReviewQualityMetrics {
  const reviewerMap = new Map<
    string,
    ReviewParticipant & { firstSeenIndex: number }
  >();
  let mergeCommitCount = 0;
  let reviewedMergeCount = 0;
  let order = 0;

  for (const commit of commits) {
    if (!isMergeCommit(commit)) continue;

    mergeCommitCount++;
    const reviewers = parseReviewers(commit.body || commit.message);
    if (reviewers.length > 0) {
      reviewedMergeCount++;
    }

    for (const reviewer of reviewers) {
      const key = reviewer.email.toLowerCase();
      const existing = reviewerMap.get(key);
      if (existing) {
        existing.commits++;
      } else {
        reviewerMap.set(key, {
          ...reviewer,
          commits: 1,
          firstSeenIndex: order,
        });
        order++;
      }
    }
  }

  const reviewers = Array.from(reviewerMap.values())
    .sort((a, b) => {
      if (b.commits !== a.commits) return b.commits - a.commits;
      return a.firstSeenIndex - b.firstSeenIndex;
    })
    .map(({ firstSeenIndex, ...reviewer }) => reviewer);

  return {
    mergeCommitCount,
    reviewedMergeCount,
    reviewParticipationRate:
      mergeCommitCount > 0 ? roundRatio(reviewedMergeCount / mergeCommitCount) : 0,
    reviewers,
  };
}

function calculateCommitQuality(commits: CommitRecord[]): CommitQualityMetrics {
  if (commits.length === 0) {
    return {
      score: 0,
      conventionalRate: 0,
      scopeCoverageRate: 0,
      averageMessageLength: 0,
      typeDistribution: {},
    };
  }

  let conventionalCount = 0;
  let scopedCount = 0;
  let totalLength = 0;
  const typeDistribution: Record<string, number> = {};

  for (const commit of commits) {
    totalLength += commit.message.length;

    const conventionalMatch = commit.message.match(CONVENTIONAL_RE);
    if (conventionalMatch) {
      conventionalCount++;
      const type = conventionalMatch[1].toLowerCase();
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    } else {
      typeDistribution.other = (typeDistribution.other || 0) + 1;
    }

    if (SCOPED_CONVENTIONAL_RE.test(commit.message)) {
      scopedCount++;
    }
  }

  const averageMessageLength = roundTo(totalLength / commits.length, 1);
  const conventionalRate = roundRatio(conventionalCount / commits.length);
  const scopeCoverageRate = roundRatio(scopedCount / commits.length);
  const messageLengthScore = Math.min(averageMessageLength / 24, 1);
  const score = Math.round(
    conventionalRate * 60 + scopeCoverageRate * 25 + messageLengthScore * 15
  );

  return {
    score,
    conventionalRate,
    scopeCoverageRate,
    averageMessageLength,
    typeDistribution,
  };
}

function calculateChangeMix(commits: CommitRecord[]): ChangeMixMetrics {
  let createdFiles = 0;
  let deletedFiles = 0;
  let modifiedFiles = 0;

  for (const commit of commits) {
    for (const file of commit.files) {
      if (file.status === 'added' || file.status === 'copied') {
        createdFiles++;
      } else if (file.status === 'deleted') {
        deletedFiles++;
      } else {
        modifiedFiles++;
      }
    }
  }

  const total = createdFiles + deletedFiles + modifiedFiles;

  return {
    createdFiles,
    deletedFiles,
    modifiedFiles,
    featureRatio: total > 0 ? roundRatio((createdFiles + deletedFiles) / total) : 0,
    refactorRatio: total > 0 ? roundRatio(modifiedFiles / total) : 0,
  };
}

function selectOwnershipCandidates(commits: CommitRecord[]): string[] {
  const fileCounts = new Map<string, number>();

  for (const commit of commits) {
    for (const file of commit.files) {
      fileCounts.set(file.path, (fileCounts.get(file.path) || 0) + 1);
    }
  }

  return Array.from(fileCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([file]) => file);
}

function listTrackedFiles(repoPath: string): string[] {
  let output = '';
  try {
    output = execFileSync('git', ['ls-files', '-z'], {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return [];
  }

  return output
    .split('\0')
    .filter((path) => path && !isIgnoredOwnershipFile(path));
}

function calculateFileOwnership(
  repoPath: string,
  filePath: string
): FileOwnership | null {
  let output = '';
  try {
    output = execFileSync('git', ['blame', 'HEAD', '--line-porcelain', '--', filePath], {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }

  const contributors = parseBlameContributors(output);
  const totalLines = Array.from(contributors.values()).reduce(
    (sum, contributor) => sum + contributor.lines,
    0
  );
  if (totalLines === 0) return null;

  const sortedContributors: FileOwnerContribution[] = Array.from(
    contributors.values()
  )
    .map((contributor) => ({
      ...contributor,
      ratio: contributor.lines / totalLines,
    }))
    .sort((a, b) => b.lines - a.lines);

  const owner = sortedContributors[0];

  return {
    path: filePath,
    ownerName: owner.name,
    ownerEmail: owner.email,
    ownerLines: owner.lines,
    totalLines,
    ownershipRatio: owner.ratio,
    contributors: sortedContributors,
  };
}

function parseBlameContributors(
  output: string
): Map<string, { name: string; email: string; lines: number }> {
  const contributors = new Map<string, { name: string; email: string; lines: number }>();
  let currentName = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('author ')) {
      currentName = line.slice('author '.length);
    } else if (line.startsWith('author-mail ')) {
      const email = line
        .slice('author-mail '.length)
        .replace(/^<|>$/g, '')
        .toLowerCase();
      const key = email || currentName;
      const existing = contributors.get(key) || {
        name: currentName || email,
        email,
        lines: 0,
      };
      existing.lines++;
      contributors.set(key, existing);
    }
  }

  return contributors;
}

function parseReviewers(body: string): ReviewParticipant[] {
  const reviewers: ReviewParticipant[] = [];
  const seen = new Set<string>();
  REVIEW_TRAILER_RE.lastIndex = 0;

  let match = REVIEW_TRAILER_RE.exec(body);
  while (match) {
    const name = match[2].trim();
    const email = match[3].trim().toLowerCase();
    if (!seen.has(email)) {
      reviewers.push({ name, email, commits: 0 });
      seen.add(email);
    }
    match = REVIEW_TRAILER_RE.exec(body);
  }

  return reviewers;
}

function isMergeCommit(commit: CommitRecord): boolean {
  return (commit.parentHashes?.length || 0) > 1 || /^Merge\b/i.test(commit.message);
}

function isIgnoredOwnershipFile(filePath: string): boolean {
  return /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(filePath);
}

function isOwnershipTargetFile(filePath: string): boolean {
  if (isIgnoredOwnershipFile(filePath)) return false;
  const extension = filePath.includes('.')
    ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
    : '';
  return OWNERSHIP_EXTENSIONS.has(extension);
}

function roundRatio(value: number): number {
  return roundTo(value, 2);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
