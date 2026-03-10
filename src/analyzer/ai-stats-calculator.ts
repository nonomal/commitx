import type {
  CommitRecord,
  AIMetrics,
  AICommit,
  AuthorAIStats,
  DirectoryAIStats,
  AITrendPoint,
} from '../types/index.js';
import { calculateAIScore } from './tech-debt/ai-detector.js';
import { extname } from 'node:path';

export function calculateAIMetrics(commits: CommitRecord[]): {
  aiMetrics: AIMetrics;
  authorAIStats: AuthorAIStats[];
  directoryAIStats: DirectoryAIStats[];
  aiTrends: AITrendPoint[];
} {
  if (commits.length === 0) {
    return {
      aiMetrics: { totalAILines: 0, totalLines: 0, aiPercentage: 0, suspiciousCommits: 0, highAICommits: [] },
      authorAIStats: [],
      directoryAIStats: [],
      aiTrends: [],
    };
  }

  const aiCommits: AICommit[] = [];
  const authorAIMap = new Map<string, { aiLines: number; totalLines: number }>();
  const directoryAIMap = new Map<string, { aiLines: number; totalLines: number; commits: Set<string>; lastModified: Date }>();
  const weeklyAIMap = new Map<string, { aiLines: number; totalLines: number }>();

  let totalAILines = 0;
  let totalLines = 0;
  let suspiciousCommits = 0;

  for (const commit of commits) {
    const aiScore = calculateAIScore(commit);
    const commitLines = commit.files.reduce((sum, f) => sum + f.added, 0);
    const estimatedAILines = Math.round((commitLines * aiScore) / 100);

    totalLines += commitLines;
    totalAILines += estimatedAILines;

    if (aiScore > 50) {
      suspiciousCommits++;
      aiCommits.push({
        hash: commit.hash,
        author: commit.author,
        date: commit.date,
        aiScore,
        linesAdded: commitLines,
        filesCount: commit.files.length,
        message: commit.message,
      });
    }

    const authorKey = commit.email.toLowerCase();
    const authorData = authorAIMap.get(authorKey) || { aiLines: 0, totalLines: 0 };
    authorData.aiLines += estimatedAILines;
    authorData.totalLines += commitLines;
    authorAIMap.set(authorKey, authorData);

    for (const file of commit.files) {
      const dir = getTopDirectory(file.path);
      const fileAILines = Math.round((file.added * aiScore) / 100);

      const dirData = directoryAIMap.get(dir) || {
        aiLines: 0,
        totalLines: 0,
        commits: new Set(),
        lastModified: commit.date,
      };
      dirData.aiLines += fileAILines;
      dirData.totalLines += file.added;
      dirData.commits.add(commit.hash);
      if (commit.date > dirData.lastModified) {
        dirData.lastModified = commit.date;
      }
      directoryAIMap.set(dir, dirData);
    }

    const week = getWeekKey(commit.date);
    const weekData = weeklyAIMap.get(week) || { aiLines: 0, totalLines: 0 };
    weekData.aiLines += estimatedAILines;
    weekData.totalLines += commitLines;
    weeklyAIMap.set(week, weekData);
  }

  const aiMetrics: AIMetrics = {
    totalAILines,
    totalLines,
    aiPercentage: totalLines > 0 ? (totalAILines / totalLines) * 100 : 0,
    suspiciousCommits,
    highAICommits: aiCommits.sort((a, b) => b.aiScore - a.aiScore).slice(0, 20),
  };

  const authorAIStats: AuthorAIStats[] = [];
  const authorMap = new Map<string, { name: string; email: string }>();
  for (const commit of commits) {
    authorMap.set(commit.email.toLowerCase(), { name: commit.author, email: commit.email });
  }

  for (const [authorKey, data] of authorAIMap) {
    const author = authorMap.get(authorKey);
    if (author) {
      authorAIStats.push({
        author: author.name,
        email: author.email,
        aiLines: data.aiLines,
        totalLines: data.totalLines,
        aiPercentage: data.totalLines > 0 ? (data.aiLines / data.totalLines) * 100 : 0,
      });
    }
  }

  const directoryAIStats: DirectoryAIStats[] = [];
  for (const [path, data] of directoryAIMap) {
    const aiPercentage = data.totalLines > 0 ? (data.aiLines / data.totalLines) * 100 : 0;
    const isHighRisk = data.commits.size > 50 && aiPercentage > 60;

    directoryAIStats.push({
      path,
      commits: data.commits.size,
      aiLines: data.aiLines,
      totalLines: data.totalLines,
      aiPercentage,
      lastModified: data.lastModified,
      isHighRisk,
    });
  }

  const aiTrends: AITrendPoint[] = Array.from(weeklyAIMap.entries())
    .map(([week, data]) => ({
      week,
      aiLines: data.aiLines,
      totalLines: data.totalLines,
      aiPercentage: data.totalLines > 0 ? (data.aiLines / data.totalLines) * 100 : 0,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return {
    aiMetrics,
    authorAIStats: authorAIStats.sort((a, b) => b.aiPercentage - a.aiPercentage),
    directoryAIStats: directoryAIStats.sort((a, b) => b.aiPercentage - a.aiPercentage),
    aiTrends,
  };
}

function getTopDirectory(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts[0] : '(根目录)';
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}
