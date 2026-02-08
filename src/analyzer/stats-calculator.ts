import type {
  CommitRecord,
  CommitStats,
  AuthorStats,
  FileTypeStats,
  DirectoryStats,
  BusiestDay,
} from '../types/index.js';
import { extname } from 'node:path';

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

  // 每日统计（用于计算最繁忙的一天）
  const dailyCounts = new Map<string, number>();

  for (const commit of sorted) {
    // 时间分布
    const hour = commit.date.getHours();
    hourlyDistribution[hour]++;

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

  return merged;
}

/** 创建空的统计对象 */
function emptyStats(): CommitStats {
  return {
    totalCommits: 0,
    linesAdded: 0,
    linesDeleted: 0,
    filesChanged: 0,
    firstCommitDate: new Date(),
    lastCommitDate: new Date(),
    busiestDay: { date: '', count: 0 },
    authors: [],
    fileTypes: [],
    directories: [],
    hourlyDistribution: new Array<number>(24).fill(0),
    dailyHeatmap: {},
  };
}

/** 获取文件路径的第一层目录 */
function getTopDirectory(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts[0] : '(根目录)';
}

/** 格式化日期为 YYYY-MM-DD */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
