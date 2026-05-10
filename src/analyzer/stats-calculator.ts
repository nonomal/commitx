import type {
  CommitRecord,
  CommitStats,
  AuthorStats,
  FileTypeStats,
  DirectoryStats,
  BusiestDay,
  AuthorFileTypeContribution,
  AICommit,
  AuthorAIStats,
  DirectoryAIStats,
  AITrendPoint,
} from '../types/index.js';
import { extname } from 'node:path';
import { calculateAIMetrics } from './ai-stats-calculator.js';
import {
  calculateAIQualityRisk,
  calculateChangeSizeDistribution,
  calculateDirectoryCoupling,
} from './extended-stats.js';
import { emptyStats } from './stats-empty.js';
import {
  calculateAuthorFileTypeContributions,
  calculateCollaboration,
  calculateCommitDetails,
  calculateMessageStats,
  calculateQualityMetrics,
  calculateTimePatterns,
  calculateTrends,
} from './stats-metrics.js';
import { formatDateKey, getTopDirectory } from './stats-utils.js';

/**
 * 根据解析后的提交记录，计算所有统计维度
 */
export function calculateStats(commits: CommitRecord[]): CommitStats {
  if (commits.length === 0) {
    return emptyStats();
  }

  // 排序：按日期升序
  const sorted = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  // 基础统计
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  const allFilePaths = new Set<string>();

  // 作者维度
  const authorMap = new Map<string, AuthorStats>();

  // 文件类型维度
  const fileTypeMap = new Map<string, FileTypeStats>();

  // 目录维度
  const directoryMap = new Map<string, DirectoryStats>();
  const directoryCommitSet = new Map<string, Set<string>>(); // dir -> Set<commitHash>

  // 时间分布
  const hourlyDistribution = new Array<number>(24).fill(0);
  const dailyHeatmap: Record<string, number> = {};
  const hourlyByAuthor: Map<number, Map<string, number>> = new Map(); // hour -> (author -> count)

  // 每日统计（用于计算最繁忙的一天）
  const dailyCounts = new Map<string, number>();

  for (const commit of sorted) {
    // 时间分布
    const hour = commit.date.getHours();
    hourlyDistribution[hour]++;

    // 按小时统计作者
    if (!hourlyByAuthor.has(hour)) {
      hourlyByAuthor.set(hour, new Map());
    }
    const hourAuthors = hourlyByAuthor.get(hour)!;
    hourAuthors.set(commit.author, (hourAuthors.get(commit.author) || 0) + 1);

    const dateKey = formatDateKey(commit.date);
    dailyHeatmap[dateKey] = (dailyHeatmap[dateKey] || 0) + 1;
    dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);

    // 作者统计
    const authorKey = commit.email.toLowerCase();
    let authorStat = authorMap.get(authorKey);
    if (!authorStat) {
      authorStat = {
        name: commit.author,
        email: commit.email,
        commits: 0,
        linesAdded: 0,
        linesDeleted: 0,
        lastActiveDate: commit.date,
      };
      authorMap.set(authorKey, authorStat);
    }
    authorStat.commits++;
    authorStat.lastActiveDate = commit.date;

    // 文件级别统计
    for (const file of commit.files) {
      totalLinesAdded += file.added;
      totalLinesDeleted += file.deleted;
      allFilePaths.add(file.path);

      // 作者行数统计
      authorStat.linesAdded += file.added;
      authorStat.linesDeleted += file.deleted;

      // 文件类型统计
      const ext = extname(file.path).toLowerCase() || '(无扩展名)';
      let ftStat = fileTypeMap.get(ext);
      if (!ftStat) {
        ftStat = { extension: ext, added: 0, deleted: 0, fileCount: 0 };
        fileTypeMap.set(ext, ftStat);
      }
      ftStat.added += file.added;
      ftStat.deleted += file.deleted;

      // 目录统计 —— 取第一层目录
      const topDir = getTopDirectory(file.path);
      let dirStat = directoryMap.get(topDir);
      if (!dirStat) {
        dirStat = { path: topDir, commits: 0, linesChanged: 0 };
        directoryMap.set(topDir, dirStat);
        directoryCommitSet.set(topDir, new Set());
      }
      dirStat.linesChanged += file.added + file.deleted;
      directoryCommitSet.get(topDir)!.add(commit.hash);
    }
  }

  // 计算目录的 commit 数量
  for (const [dir, commitSet] of directoryCommitSet) {
    const dirStat = directoryMap.get(dir);
    if (dirStat) {
      dirStat.commits = commitSet.size;
    }
  }

  // 计算文件类型的 fileCount
  const fileCountByExt = new Map<string, Set<string>>();
  for (const filePath of allFilePaths) {
    const ext = extname(filePath).toLowerCase() || '(无扩展名)';
    if (!fileCountByExt.has(ext)) {
      fileCountByExt.set(ext, new Set());
    }
    fileCountByExt.get(ext)!.add(filePath);
  }
  for (const [ext, files] of fileCountByExt) {
    const ftStat = fileTypeMap.get(ext);
    if (ftStat) {
      ftStat.fileCount = files.size;
    }
  }

  // 最繁忙的一天
  let busiestDay: BusiestDay = { date: '', count: 0 };
  for (const [date, count] of dailyCounts) {
    if (count > busiestDay.count) {
      busiestDay = { date, count };
    }
  }

  // 排序结果
  const authors = Array.from(authorMap.values()).sort(
    (a, b) => b.commits - a.commits
  );
  const fileTypes = Array.from(fileTypeMap.values()).sort(
    (a, b) => b.added + b.deleted - (a.added + a.deleted)
  );
  const directories = Array.from(directoryMap.values())
    .sort((a, b) => b.linesChanged - a.linesChanged)
    .slice(0, 10); // TOP 10

  // 转换 hourlyByAuthor 为数组格式
  const hourlyByAuthorArray = Array.from({ length: 24 }, (_, hour) => {
    const authorMap = hourlyByAuthor.get(hour);
    const authors: Record<string, number> = {};
    if (authorMap) {
      authorMap.forEach((count, author) => {
        authors[author] = count;
      });
    }
    return {
      count: hourlyDistribution[hour],
      authors,
    };
  });

  const aiStats = calculateAIMetrics(sorted);

  return {
    totalCommits: sorted.length,
    linesAdded: totalLinesAdded,
    linesDeleted: totalLinesDeleted,
    filesChanged: allFilePaths.size,
    firstCommitDate: sorted[0].date,
    lastCommitDate: sorted[sorted.length - 1].date,
    busiestDay,
    authors,
    fileTypes,
    directories,
    hourlyDistribution,
    dailyHeatmap,
    hourlyByAuthor: hourlyByAuthorArray,
    quality: calculateQualityMetrics(sorted),
    timePatterns: calculateTimePatterns(sorted),
    trends: calculateTrends(sorted),
    collaboration: calculateCollaboration(sorted),
    messageStats: calculateMessageStats(sorted),
    authorFileTypeContributions: calculateAuthorFileTypeContributions(sorted),
    commitDetails: calculateCommitDetails(sorted),
    aiMetrics: aiStats.aiMetrics,
    authorAIStats: aiStats.authorAIStats,
    directoryAIStats: aiStats.directoryAIStats,
    aiTrends: aiStats.aiTrends,
    changeSizeDistribution: calculateChangeSizeDistribution(sorted),
    directoryCoupling: calculateDirectoryCoupling(sorted),
    aiQualityRisk: calculateAIQualityRisk(sorted),
  };
}

/**
 * 合并多个仓库的统计结果
 */
export function mergeStats(statsList: CommitStats[]): CommitStats {
  if (statsList.length === 0) return emptyStats();
  if (statsList.length === 1) return statsList[0];

  const merged = emptyStats();

  for (const stats of statsList) {
    merged.totalCommits += stats.totalCommits;
    merged.linesAdded += stats.linesAdded;
    merged.linesDeleted += stats.linesDeleted;
    merged.filesChanged += stats.filesChanged;

    // 时间维度
    if (
      !merged.firstCommitDate ||
      stats.firstCommitDate < merged.firstCommitDate
    ) {
      merged.firstCommitDate = stats.firstCommitDate;
    }
    if (
      !merged.lastCommitDate ||
      stats.lastCommitDate > merged.lastCommitDate
    ) {
      merged.lastCommitDate = stats.lastCommitDate;
    }

    // 小时分布
    for (let i = 0; i < 24; i++) {
      merged.hourlyDistribution[i] += stats.hourlyDistribution[i];
    }

    // 每日热力图
    for (const [date, count] of Object.entries(stats.dailyHeatmap)) {
      merged.dailyHeatmap[date] = (merged.dailyHeatmap[date] || 0) + count;
    }

    // 作者合并
    for (const author of stats.authors) {
      const existing = merged.authors.find(
        (a) => a.email.toLowerCase() === author.email.toLowerCase()
      );
      if (existing) {
        existing.commits += author.commits;
        existing.linesAdded += author.linesAdded;
        existing.linesDeleted += author.linesDeleted;
        if (author.lastActiveDate > existing.lastActiveDate) {
          existing.lastActiveDate = author.lastActiveDate;
        }
      } else {
        merged.authors.push({ ...author });
      }
    }

    // 文件类型合并
    for (const ft of stats.fileTypes) {
      const existing = merged.fileTypes.find(
        (f) => f.extension === ft.extension
      );
      if (existing) {
        existing.added += ft.added;
        existing.deleted += ft.deleted;
        existing.fileCount += ft.fileCount;
      } else {
        merged.fileTypes.push({ ...ft });
      }
    }

    // 目录合并
    for (const dir of stats.directories) {
      const existing = merged.directories.find((d) => d.path === dir.path);
      if (existing) {
        existing.commits += dir.commits;
        existing.linesChanged += dir.linesChanged;
      } else {
        merged.directories.push({ ...dir });
      }
    }

    // 质量指标合并
    merged.quality.avgFilesPerCommit += stats.quality.avgFilesPerCommit;
    merged.quality.avgLinesPerCommit += stats.quality.avgLinesPerCommit;
    merged.quality.churnRate += stats.quality.churnRate;
    for (const hf of stats.quality.hotFiles) {
      const existing = merged.quality.hotFiles.find((h) => h.path === hf.path);
      if (existing) {
        existing.modifyCount += hf.modifyCount;
        for (const author of hf.authors) {
          if (!existing.authors.includes(author)) {
            existing.authors.push(author);
          }
        }
      } else {
        merged.quality.hotFiles.push({ ...hf, authors: [...hf.authors] });
      }
    }

    // 时间模式合并
    for (let i = 0; i < 7; i++) {
      merged.timePatterns.weekdayDistribution[i] +=
        stats.timePatterns.weekdayDistribution[i];
    }

    // 趋势数据合并
    for (const wp of stats.trends.weeklyTrend) {
      const existing = merged.trends.weeklyTrend.find((w) => w.week === wp.week);
      if (existing) {
        existing.commits += wp.commits;
        existing.linesAdded += wp.linesAdded;
        existing.linesDeleted += wp.linesDeleted;
      } else {
        merged.trends.weeklyTrend.push({ ...wp });
      }
    }
    for (const cp of stats.trends.cumulativeLines) {
      const existing = merged.trends.cumulativeLines.find(
        (c) => c.date === cp.date
      );
      if (existing) {
        existing.netLines += cp.netLines;
      } else {
        merged.trends.cumulativeLines.push({ ...cp });
      }
    }

    // 协作指标合并
    for (const sf of stats.collaboration.soloFiles) {
      const existing = merged.collaboration.soloFiles.find(
        (s) => s.path === sf.path
      );
      if (existing) {
        existing.commits += sf.commits;
      } else {
        merged.collaboration.soloFiles.push({ ...sf });
      }
    }
    for (const ch of stats.collaboration.collaborationHotspots) {
      const existing = merged.collaboration.collaborationHotspots.find(
        (c) => c.path === ch.path
      );
      if (existing) {
        existing.totalCommits += ch.totalCommits;
        existing.authorCount = Math.max(existing.authorCount, ch.authorCount);
      } else {
        merged.collaboration.collaborationHotspots.push({ ...ch });
      }
    }

    // Commit Message 统计合并
    for (const [type, count] of Object.entries(stats.messageStats.typeDistribution)) {
      merged.messageStats.typeDistribution[type] =
        (merged.messageStats.typeDistribution[type] || 0) + count;
    }
    merged.messageStats.avgMessageLength += stats.messageStats.avgMessageLength;

    merged.commitDetails.push(...stats.commitDetails);
  }

  // 重新计算最繁忙的一天
  let busiestDay: BusiestDay = { date: '', count: 0 };
  for (const [date, count] of Object.entries(merged.dailyHeatmap)) {
    if (count > busiestDay.count) {
      busiestDay = { date, count };
    }
  }
  merged.busiestDay = busiestDay;

  // 排序
  merged.authors.sort((a, b) => b.commits - a.commits);
  merged.fileTypes.sort(
    (a, b) => b.added + b.deleted - (a.added + a.deleted)
  );
  merged.directories.sort((a, b) => b.linesChanged - a.linesChanged);
  merged.directories = merged.directories.slice(0, 10);

  // 重新计算扩展字段的平均值和排序
  const repoCount = statsList.length;
  merged.quality.avgFilesPerCommit /= repoCount;
  merged.quality.avgLinesPerCommit /= repoCount;
  merged.quality.churnRate /= repoCount;
  merged.quality.hotFiles.sort((a, b) => b.modifyCount - a.modifyCount);
  merged.quality.hotFiles = merged.quality.hotFiles.slice(0, 10);

  // 时间模式重新计算
  const totalWeekdayCommits = merged.timePatterns.weekdayDistribution.reduce(
    (a, b) => a + b,
    0
  );
  if (totalWeekdayCommits > 0) {
    merged.timePatterns.weekendCommits =
      (merged.timePatterns.weekdayDistribution[5] +
        merged.timePatterns.weekdayDistribution[6]) /
      totalWeekdayCommits;
  }

  // 趋势数据排序
  merged.trends.weeklyTrend.sort((a, b) => a.week.localeCompare(b.week));
  merged.trends.cumulativeLines.sort((a, b) => a.date.localeCompare(b.date));

  // 重新计算累计代码量
  let cumulative = 0;
  for (const point of merged.trends.cumulativeLines) {
    cumulative += point.netLines;
    point.netLines = cumulative;
  }

  // 协作指标排序
  merged.collaboration.soloFiles.sort((a, b) => b.commits - a.commits);
  merged.collaboration.soloFiles = merged.collaboration.soloFiles.slice(0, 10);
  merged.collaboration.collaborationHotspots.sort(
    (a, b) => b.totalCommits - a.totalCommits
  );
  merged.collaboration.collaborationHotspots =
    merged.collaboration.collaborationHotspots.slice(0, 10);

  // Commit Message 平均长度
  merged.messageStats.avgMessageLength /= repoCount;

  // 提交明细排序
  merged.commitDetails.sort((a, b) => a.date.getTime() - b.date.getTime());

  mergeAIStats(merged, statsList);

  // 作者文件类型贡献合并
  const contributionMap = new Map<string, AuthorFileTypeContribution>();
  for (const stats of statsList) {
    for (const contrib of stats.authorFileTypeContributions) {
      const key = `${contrib.email.toLowerCase()}|||${contrib.extension}`;
      const existing = contributionMap.get(key);
      if (existing) {
        existing.linesAdded += contrib.linesAdded;
        existing.linesDeleted += contrib.linesDeleted;
        existing.commits += contrib.commits;
        existing.fileCount += contrib.fileCount;
      } else {
        contributionMap.set(key, { ...contrib });
      }
    }
  }
  merged.authorFileTypeContributions = Array.from(contributionMap.values())
    .sort((a, b) => {
      const totalA = a.linesAdded + a.linesDeleted;
      const totalB = b.linesAdded + b.linesDeleted;
      return totalB - totalA;
    })
    .slice(0, 20);

  // ============================================================
  // 高级统计字段不进行多仓库合并
  // ============================================================
  // 原因：高级统计（teamHealth, stability, workPressure, contributorChurn, advancedCollaboration）
  // 需要原始 CommitRecord[] 数据才能准确计算。在 mergeStats 中仅有聚合后的统计数据，
  // 强行合并会导致结果不准确（例如 busFactor、revertRate 等指标无法简单累加）。
  //
  // 当前行为：
  // - 单仓库场景：直接返回（第184行），保留所有高级统计
  // - 多仓库场景：merged 中高级字段保持 undefined
  //
  // 如需多仓库的高级统计分析，建议：
  // 1. 使用时间范围过滤单个仓库
  // 2. 或在 analyzer/index.ts 中基于合并后的原始 commits 重新计算

  return merged;
}

function mergeAIStats(merged: CommitStats, statsList: CommitStats[]): void {
  const aiStatsList = statsList.filter((stats) => stats.aiMetrics);
  if (aiStatsList.length === 0) return;

  const highAICommits: AICommit[] = [];
  const authorMap = new Map<string, AuthorAIStats>();
  const directoryMap = new Map<string, DirectoryAIStats>();
  const trendMap = new Map<string, AITrendPoint>();
  let totalAILines = 0;
  let totalLines = 0;
  let suspiciousCommits = 0;

  for (const stats of aiStatsList) {
    const metrics = stats.aiMetrics!;
    totalAILines += metrics.totalAILines;
    totalLines += metrics.totalLines;
    suspiciousCommits += metrics.suspiciousCommits;
    highAICommits.push(...metrics.highAICommits);

    for (const author of stats.authorAIStats || []) {
      const key = author.email.toLowerCase();
      const existing = authorMap.get(key);
      if (existing) {
        existing.aiLines += author.aiLines;
        existing.totalLines += author.totalLines;
        existing.aiPercentage = calculatePercentage(existing.aiLines, existing.totalLines);
      } else {
        authorMap.set(key, { ...author });
      }
    }

    for (const directory of stats.directoryAIStats || []) {
      const existing = directoryMap.get(directory.path);
      if (existing) {
        existing.commits += directory.commits;
        existing.aiLines += directory.aiLines;
        existing.totalLines += directory.totalLines;
        existing.aiPercentage = calculatePercentage(existing.aiLines, existing.totalLines);
        existing.lastModified =
          new Date(directory.lastModified) > new Date(existing.lastModified)
            ? directory.lastModified
            : existing.lastModified;
        existing.isHighRisk = existing.commits > 50 && existing.aiPercentage > 60;
      } else {
        directoryMap.set(directory.path, { ...directory });
      }
    }

    for (const trend of stats.aiTrends || []) {
      const existing = trendMap.get(trend.week);
      if (existing) {
        existing.aiLines += trend.aiLines;
        existing.totalLines += trend.totalLines;
        existing.aiPercentage = calculatePercentage(existing.aiLines, existing.totalLines);
      } else {
        trendMap.set(trend.week, { ...trend });
      }
    }
  }

  merged.aiMetrics = {
    totalAILines,
    totalLines,
    aiPercentage: calculatePercentage(totalAILines, totalLines),
    suspiciousCommits,
    highAICommits: highAICommits.sort((a, b) => b.aiScore - a.aiScore).slice(0, 20),
  };
  merged.authorAIStats = Array.from(authorMap.values())
    .sort((a, b) => b.aiPercentage - a.aiPercentage);
  merged.directoryAIStats = Array.from(directoryMap.values())
    .sort((a, b) => b.aiPercentage - a.aiPercentage);
  merged.aiTrends = Array.from(trendMap.values())
    .sort((a, b) => a.week.localeCompare(b.week));
}

function calculatePercentage(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}
