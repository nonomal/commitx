import { extname } from 'node:path';
import type {
  AuthorFileTypeContribution,
  CollabFile,
  CollaborationMetrics,
  CommitDetail,
  CommitMessageStats,
  CommitRecord,
  CumulativePoint,
  HotFile,
  QualityMetrics,
  SoloFile,
  TimePatterns,
  TrendData,
  WeeklyPoint,
} from '../types/index.js';
import { formatDateKey } from './stats-utils.js';

/** 生成报告页筛选用的提交明细 */
export function calculateCommitDetails(commits: CommitRecord[]): CommitDetail[] {
  return commits.map((commit) => {
    let linesAdded = 0;
    let linesDeleted = 0;

    for (const file of commit.files) {
      linesAdded += file.added;
      linesDeleted += file.deleted;
    }

    return {
      hash: commit.hash,
      author: commit.author,
      email: commit.email,
      repoName: '',
      date: commit.date,
      message: commit.message,
      linesAdded,
      linesDeleted,
      files: commit.files.map((file) => ({ ...file })),
    };
  });
}

/** 计算代码质量指标 */
export function calculateQualityMetrics(commits: CommitRecord[]): QualityMetrics {
  if (commits.length === 0) {
    return emptyQualityMetrics();
  }

  const totalFiles = commits.reduce((sum, commit) => sum + commit.files.length, 0);
  const avgFilesPerCommit = totalFiles / commits.length;

  const totalLines = commits.reduce(
    (sum, commit) => sum + commit.files.reduce((s, file) => s + file.added + file.deleted, 0),
    0
  );
  const avgLinesPerCommit = totalLines / commits.length;

  const totalAdded = commits.reduce(
    (sum, commit) => sum + commit.files.reduce((s, file) => s + file.added, 0),
    0
  );
  const totalDeleted = commits.reduce(
    (sum, commit) => sum + commit.files.reduce((s, file) => s + file.deleted, 0),
    0
  );
  const churnRate = totalAdded > 0 ? totalDeleted / totalAdded : 0;

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
export function calculateTimePatterns(commits: CommitRecord[]): TimePatterns {
  if (commits.length === 0) {
    return emptyTimePatterns();
  }

  const weekdayDistribution = new Array<number>(7).fill(0);
  const weekdayByAuthor: Map<number, Map<string, number>> = new Map();

  for (const commit of commits) {
    const day = commit.date.getDay();
    const idx = day === 0 ? 6 : day - 1;
    weekdayDistribution[idx]++;

    if (!weekdayByAuthor.has(idx)) {
      weekdayByAuthor.set(idx, new Map());
    }
    const dayAuthors = weekdayByAuthor.get(idx)!;
    dayAuthors.set(commit.author, (dayAuthors.get(commit.author) || 0) + 1);
  }

  const weekendCommits =
    (weekdayDistribution[5] + weekdayDistribution[6]) / commits.length;

  const sorted = [...commits].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  let totalInterval = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalInterval += sorted[i].date.getTime() - sorted[i - 1].date.getTime();
  }
  const avgCommitInterval =
    sorted.length > 1 ? totalInterval / (sorted.length - 1) / 3600000 : 0;

  const { longestStreak, currentStreak } = calculateStreaks(sorted);

  const weekdayByAuthorArray = Array.from({ length: 7 }, (_, day) => {
    const authorMap = weekdayByAuthor.get(day);
    const authors: Record<string, number> = {};
    if (authorMap) {
      authorMap.forEach((count, author) => {
        authors[author] = count;
      });
    }
    return {
      count: weekdayDistribution[day],
      authors,
    };
  });

  return {
    weekdayDistribution,
    weekendCommits,
    avgCommitInterval,
    longestStreak,
    currentStreak,
    weekdayByAuthor: weekdayByAuthorArray,
  };
}

/** 计算趋势数据 */
export function calculateTrends(commits: CommitRecord[]): TrendData {
  if (commits.length === 0) {
    return emptyTrendData();
  }

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

  const dailyNet = new Map<string, number>();
  for (const commit of commits) {
    const dateKey = formatDateKey(commit.date);
    const net = commit.files.reduce((sum, file) => sum + file.added - file.deleted, 0);
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
export function calculateCollaboration(commits: CommitRecord[]): CollaborationMetrics {
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
export function calculateMessageStats(commits: CommitRecord[]): CommitMessageStats {
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
export function calculateAuthorFileTypeContributions(
  commits: CommitRecord[]
): AuthorFileTypeContribution[] {
  if (commits.length === 0) {
    return [];
  }

  const contributionMap = new Map<string, AuthorFileTypeContribution>();
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

  for (const [key, contribution] of contributionMap) {
    contribution.commits = commitCountMap.get(key)?.size || 0;
    contribution.fileCount = uniqueFilesMap.get(key)?.size || 0;
  }

  return Array.from(contributionMap.values())
    .sort((a, b) => {
      const totalA = a.linesAdded + a.linesDeleted;
      const totalB = b.linesAdded + b.linesDeleted;
      return totalB - totalA;
    })
    .slice(0, 20);
}

export function emptyQualityMetrics(): QualityMetrics {
  return {
    avgFilesPerCommit: 0,
    avgLinesPerCommit: 0,
    churnRate: 0,
    hotFiles: [],
  };
}

export function emptyTimePatterns(): TimePatterns {
  return {
    weekdayDistribution: new Array<number>(7).fill(0),
    weekendCommits: 0,
    avgCommitInterval: 0,
    longestStreak: 0,
    currentStreak: 0,
  };
}

export function emptyTrendData(): TrendData {
  return {
    weeklyTrend: [],
    cumulativeLines: [],
  };
}

export function emptyCollaborationMetrics(): CollaborationMetrics {
  return {
    soloFiles: [],
    collaborationHotspots: [],
  };
}

export function emptyMessageStats(): CommitMessageStats {
  return {
    typeDistribution: {},
    avgMessageLength: 0,
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

  const today = formatDateKey(new Date());
  const lastCommitDate = sortedDates[sortedDates.length - 1];
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
