import type {
  CommitRecord,
  CommitStats,
  AuthorStats,
  FileTypeStats,
  DirectoryStats,
  BusiestDay,
  QualityMetrics,
  TimePatterns,
  TrendData,
  CollaborationMetrics,
  CommitMessageStats,
  AuthorFileTypeContribution,
  HotFile,
  WeeklyPoint,
  CumulativePoint,
  SoloFile,
  CollabFile,
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
    quality: calculateQualityMetrics(sorted),
    timePatterns: calculateTimePatterns(sorted),
    trends: calculateTrends(sorted),
    collaboration: calculateCollaboration(sorted),
    messageStats: calculateMessageStats(sorted),
    authorFileTypeContributions: calculateAuthorFileTypeContributions(sorted),
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
    quality: emptyQualityMetrics(),
    timePatterns: emptyTimePatterns(),
    trends: emptyTrendData(),
    collaboration: emptyCollaborationMetrics(),
    messageStats: emptyMessageStats(),
    authorFileTypeContributions: [],
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

// ============================================================
// 扩展统计计算函数
// ============================================================

/** 计算代码质量指标 */
function calculateQualityMetrics(commits: CommitRecord[]): QualityMetrics {
  if (commits.length === 0) {
    return emptyQualityMetrics();
  }

  // 平均每次提交的文件数
  const totalFiles = commits.reduce((sum, c) => sum + c.files.length, 0);
  const avgFilesPerCommit = totalFiles / commits.length;

  // 平均每次提交的行数
  const totalLines = commits.reduce(
    (sum, c) => sum + c.files.reduce((s, f) => s + f.added + f.deleted, 0),
    0
  );
  const avgLinesPerCommit = totalLines / commits.length;

  // 代码流失率
  const totalAdded = commits.reduce(
    (sum, c) => sum + c.files.reduce((s, f) => s + f.added, 0),
    0
  );
  const totalDeleted = commits.reduce(
    (sum, c) => sum + c.files.reduce((s, f) => s + f.deleted, 0),
    0
  );
  const churnRate = totalAdded > 0 ? totalDeleted / totalAdded : 0;

  // 热点文件
  const fileModifyMap = new Map<string, { count: number; authors: Set<string> }>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const entry = fileModifyMap.get(file.path) || { count: 0, authors: new Set() };
      entry.count++;
      entry.authors.add(commit.author);
      fileModifyMap.set(file.path, entry);
    }
  }

  const hotFiles: HotFile[] = Array.from(fileModifyMap.entries())
    .map(([path, data]) => ({
      path,
      modifyCount: data.count,
      authors: Array.from(data.authors),
    }))
    .sort((a, b) => b.modifyCount - a.modifyCount)
    .slice(0, 10);

  return { avgFilesPerCommit, avgLinesPerCommit, churnRate, hotFiles };
}

/** 计算时间模式指标 */
function calculateTimePatterns(commits: CommitRecord[]): TimePatterns {
  if (commits.length === 0) {
    return emptyTimePatterns();
  }

  const weekdayDistribution = new Array<number>(7).fill(0);

  for (const commit of commits) {
    const day = commit.date.getDay(); // 0=周日
    const idx = day === 0 ? 6 : day - 1; // 转为周一=0
    weekdayDistribution[idx]++;
  }

  // 周末提交占比
  const weekendCommits =
    (weekdayDistribution[5] + weekdayDistribution[6]) / commits.length;

  // 提交间隔
  const sorted = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  let totalInterval = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalInterval += sorted[i].date.getTime() - sorted[i - 1].date.getTime();
  }
  const avgCommitInterval =
    sorted.length > 1 ? totalInterval / (sorted.length - 1) / 3600000 : 0;

  // 连续提交天数
  const { longestStreak, currentStreak } = calculateStreaks(sorted);

  return {
    weekdayDistribution,
    weekendCommits,
    avgCommitInterval,
    longestStreak,
    currentStreak,
  };
}

/** 计算连续提交天数 */
function calculateStreaks(sortedCommits: CommitRecord[]): {
  longestStreak: number;
  currentStreak: number;
} {
  if (sortedCommits.length === 0) {
    return { longestStreak: 0, currentStreak: 0 };
  }

  // 提取唯一日期
  const uniqueDates = new Set<string>();
  for (const commit of sortedCommits) {
    uniqueDates.add(formatDateKey(commit.date));
  }

  const sortedDates = Array.from(uniqueDates).sort();
  if (sortedDates.length === 0) {
    return { longestStreak: 0, currentStreak: 0 };
  }

  let longestStreak = 1;
  let currentStreakCount = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }

    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // 计算当前连续天数（从最后一天往前数）
  const today = formatDateKey(new Date());
  const lastCommitDate = sortedDates[sortedDates.length - 1];

  // 如果最后提交日期是今天或昨天，计算当前连续
  const lastDate = new Date(lastCommitDate);
  const todayDate = new Date(today);
  const daysSinceLastCommit = Math.round(
    (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastCommit <= 1) {
    currentStreakCount = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currDate = new Date(sortedDates[i + 1]);
      const prevDate = new Date(sortedDates[i]);
      const diffDays = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        currentStreakCount++;
      } else {
        break;
      }
    }
  } else {
    currentStreakCount = 0;
  }

  return { longestStreak, currentStreak: currentStreakCount };
}

/** 获取 ISO 周标识 */
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** 计算趋势数据 */
function calculateTrends(commits: CommitRecord[]): TrendData {
  if (commits.length === 0) {
    return emptyTrendData();
  }

  // 周趋势
  const weekMap = new Map<string, WeeklyPoint>();
  for (const commit of commits) {
    const week = getWeekKey(commit.date);
    const entry = weekMap.get(week) || {
      week,
      commits: 0,
      linesAdded: 0,
      linesDeleted: 0,
    };
    entry.commits++;
    for (const file of commit.files) {
      entry.linesAdded += file.added;
      entry.linesDeleted += file.deleted;
    }
    weekMap.set(week, entry);
  }
  const weeklyTrend = Array.from(weekMap.values()).sort((a, b) =>
    a.week.localeCompare(b.week)
  );

  // 累计代码量
  const dailyNet = new Map<string, number>();
  for (const commit of commits) {
    const dateKey = formatDateKey(commit.date);
    const net = commit.files.reduce((sum, f) => sum + f.added - f.deleted, 0);
    dailyNet.set(dateKey, (dailyNet.get(dateKey) || 0) + net);
  }

  let cumulative = 0;
  const cumulativeLines: CumulativePoint[] = Array.from(dailyNet.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, net]) => {
      cumulative += net;
      return { date, netLines: cumulative };
    });

  return { weeklyTrend, cumulativeLines };
}

/** 计算协作指标 */
function calculateCollaboration(commits: CommitRecord[]): CollaborationMetrics {
  if (commits.length === 0) {
    return emptyCollaborationMetrics();
  }

  const fileAuthors = new Map<string, Set<string>>();
  const fileCommits = new Map<string, number>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const authors = fileAuthors.get(file.path) || new Set();
      authors.add(commit.email.toLowerCase());
      fileAuthors.set(file.path, authors);
      fileCommits.set(file.path, (fileCommits.get(file.path) || 0) + 1);
    }
  }

  const soloFiles: SoloFile[] = [];
  const collaborationHotspots: CollabFile[] = [];

  for (const [path, authors] of fileAuthors) {
    const commitCount = fileCommits.get(path) || 0;
    if (authors.size === 1 && commitCount >= 3) {
      soloFiles.push({
        path,
        author: Array.from(authors)[0],
        commits: commitCount,
      });
    } else if (authors.size >= 2 && commitCount >= 5) {
      collaborationHotspots.push({
        path,
        authorCount: authors.size,
        totalCommits: commitCount,
      });
    }
  }

  return {
    soloFiles: soloFiles.sort((a, b) => b.commits - a.commits).slice(0, 10),
    collaborationHotspots: collaborationHotspots
      .sort((a, b) => b.totalCommits - a.totalCommits)
      .slice(0, 10),
  };
}

/** 计算 Commit Message 统计 */
function calculateMessageStats(commits: CommitRecord[]): CommitMessageStats {
  if (commits.length === 0) {
    return emptyMessageStats();
  }

  const typeDistribution: Record<string, number> = {};
  let totalLength = 0;

  const typeRegex =
    /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/i;

  for (const commit of commits) {
    totalLength += commit.message.length;
    const match = commit.message.match(typeRegex);
    if (match) {
      const type = match[1].toLowerCase();
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    } else {
      typeDistribution['other'] = (typeDistribution['other'] || 0) + 1;
    }
  }

  return {
    typeDistribution,
    avgMessageLength: totalLength / commits.length,
  };
}

/** 计算作者文件类型贡献 */
function calculateAuthorFileTypeContributions(
  commits: CommitRecord[]
): AuthorFileTypeContribution[] {
  if (commits.length === 0) {
    return [];
  }

  // 数据结构: Map<author-email-extension, contribution>
  const contributionMap = new Map<string, AuthorFileTypeContribution>();

  // 跟踪每个作者-扩展名组合修改的唯一文件
  const uniqueFilesMap = new Map<string, Set<string>>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const ext = extname(file.path).toLowerCase() || '(无扩展名)';
      const key = `${commit.email.toLowerCase()}|||${ext}`;

      let contribution = contributionMap.get(key);
      if (!contribution) {
        contribution = {
          author: commit.author,
          email: commit.email,
          extension: ext,
          linesAdded: 0,
          linesDeleted: 0,
          commits: 0,
          fileCount: 0,
        };
        contributionMap.set(key, contribution);
        uniqueFilesMap.set(key, new Set());
      }

      contribution.linesAdded += file.added;
      contribution.linesDeleted += file.deleted;
      uniqueFilesMap.get(key)!.add(file.path);
    }
  }

  // 统计每个组合的提交数（去重）
  const commitCountMap = new Map<string, Set<string>>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const ext = extname(file.path).toLowerCase() || '(无扩展名)';
      const key = `${commit.email.toLowerCase()}|||${ext}`;

      if (!commitCountMap.has(key)) {
        commitCountMap.set(key, new Set());
      }
      commitCountMap.get(key)!.add(commit.hash);
    }
  }

  // 更新 commits 和 fileCount
  for (const [key, contribution] of contributionMap) {
    contribution.commits = commitCountMap.get(key)?.size || 0;
    contribution.fileCount = uniqueFilesMap.get(key)?.size || 0;
  }

  // 按总变更行数（增+删）降序排序，取 TOP 20
  return Array.from(contributionMap.values())
    .sort((a, b) => {
      const totalA = a.linesAdded + a.linesDeleted;
      const totalB = b.linesAdded + b.linesDeleted;
      return totalB - totalA;
    })
    .slice(0, 20);
}

// ============================================================
// 空值工厂函数
// ============================================================

function emptyQualityMetrics(): QualityMetrics {
  return {
    avgFilesPerCommit: 0,
    avgLinesPerCommit: 0,
    churnRate: 0,
    hotFiles: [],
  };
}

function emptyTimePatterns(): TimePatterns {
  return {
    weekdayDistribution: new Array<number>(7).fill(0),
    weekendCommits: 0,
    avgCommitInterval: 0,
    longestStreak: 0,
    currentStreak: 0,
  };
}

function emptyTrendData(): TrendData {
  return {
    weeklyTrend: [],
    cumulativeLines: [],
  };
}

function emptyCollaborationMetrics(): CollaborationMetrics {
  return {
    soloFiles: [],
    collaborationHotspots: [],
  };
}

function emptyMessageStats(): CommitMessageStats {
  return {
    typeDistribution: {},
    avgMessageLength: 0,
  };
}
