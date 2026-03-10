import type { CommitRecord, RiskFile } from '../../types/index.js';

export function calculateRiskScores(commits: CommitRecord[]): RiskFile[] {
  if (commits.length === 0) return [];

  const fileMap = new Map<string, FileRiskData>();

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!fileMap.has(file.path)) {
        fileMap.set(file.path, {
          path: file.path,
          commits: [],
          authors: new Set(),
          totalAdded: 0,
          totalDeleted: 0,
          lastModified: commit.date,
        });
      }

      const data = fileMap.get(file.path)!;
      data.commits.push(commit);
      data.authors.add(commit.author);
      data.totalAdded += file.added;
      data.totalDeleted += file.deleted;
      if (commit.date > data.lastModified) {
        data.lastModified = commit.date;
      }
    }
  }

  const riskFiles: RiskFile[] = [];

  for (const [path, data] of fileMap) {
    const complexity = calculateComplexity(data);
    const churnRate = calculateChurnRate(data, commits.length);
    const testCoverage = estimateTestCoverage(path, fileMap);
    const knowledgeRisk = calculateKnowledgeRisk(data);

    const riskScore =
      complexity * 0.3 +
      churnRate * 100 * 0.25 +
      (100 - testCoverage) * 0.2 +
      knowledgeRisk * 0.15 +
      (data.totalAdded > 500 ? 10 : 0);

    riskFiles.push({
      path,
      riskScore: Math.min(riskScore, 100),
      complexity,
      churnRate,
      testCoverage,
      knowledgeRisk,
      primaryAuthor: getMostActiveAuthor(data),
      lastModified: data.lastModified,
    });
  }

  return riskFiles.sort((a, b) => b.riskScore - a.riskScore);
}

interface FileRiskData {
  path: string;
  commits: CommitRecord[];
  authors: Set<string>;
  totalAdded: number;
  totalDeleted: number;
  lastModified: Date;
}

function calculateComplexity(data: FileRiskData): number {
  const linesOfCode = data.totalAdded;

  if (linesOfCode > 1000) return 90;
  if (linesOfCode > 500) return 70;
  if (linesOfCode > 300) return 50;
  if (linesOfCode > 100) return 30;
  return 10;
}

function calculateChurnRate(data: FileRiskData, totalCommits: number): number {
  return data.commits.length / totalCommits;
}

function estimateTestCoverage(path: string, fileMap: Map<string, FileRiskData>): number {
  const testPatterns = ['.test.', '.spec.', '__tests__', '/test/', '/tests/'];
  const isTestFile = testPatterns.some(pattern => path.includes(pattern));

  if (isTestFile) return 100;

  const baseName = path.replace(/\.(ts|js|tsx|jsx)$/, '');
  const possibleTestFiles = [
    `${baseName}.test.ts`,
    `${baseName}.test.js`,
    `${baseName}.spec.ts`,
    `${baseName}.spec.js`,
  ];

  for (const testFile of possibleTestFiles) {
    if (fileMap.has(testFile)) {
      return 80;
    }
  }

  const dir = path.split('/').slice(0, -1).join('/');
  for (const [filePath] of fileMap) {
    if (filePath.startsWith(dir) && testPatterns.some(p => filePath.includes(p))) {
      return 40;
    }
  }

  return 0;
}

function calculateKnowledgeRisk(data: FileRiskData): number {
  const authorCount = data.authors.size;

  if (authorCount === 1) return 100;
  if (authorCount === 2) return 60;
  if (authorCount === 3) return 30;
  return 10;
}

function getMostActiveAuthor(data: FileRiskData): string {
  const authorCommits = new Map<string, number>();

  for (const commit of data.commits) {
    authorCommits.set(commit.author, (authorCommits.get(commit.author) || 0) + 1);
  }

  let maxAuthor = '';
  let maxCommits = 0;

  for (const [author, count] of authorCommits) {
    if (count > maxCommits) {
      maxCommits = count;
      maxAuthor = author;
    }
  }

  return maxAuthor;
}
