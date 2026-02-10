import type { CommitRecord, WorkPressureMetrics, HolidayCommit } from '../../types/index.js';

/**
 * 计算工作压力指标
 */
export function calculateWorkPressure(commits: CommitRecord[]): WorkPressureMetrics {
  if (commits.length === 0) {
    return emptyWorkPressure();
  }

  let lateNightCommits = 0;
  let earlyMorningCommits = 0;
  let weekendCommits = 0;

  const holidayMap = new Map<string, { name: string; commits: number }>();
  const holidays = getHolidays();

  for (const commit of commits) {
    const hour = commit.date.getHours();
    const day = commit.date.getDay();
    const dateKey = formatDate(commit.date);

    // 深夜 (23:00-02:00)
    if (hour >= 23 || hour < 2) {
      lateNightCommits++;
    }

    // 凌晨 (02:00-06:00)
    if (hour >= 2 && hour < 6) {
      earlyMorningCommits++;
    }

    // 周末
    if (day === 0 || day === 6) {
      weekendCommits++;
    }

    // 假期
    const holiday = holidays.get(dateKey);
    if (holiday) {
      const entry = holidayMap.get(dateKey) || { name: holiday, commits: 0 };
      entry.commits++;
      holidayMap.set(dateKey, entry);
    }
  }

  const holidayCommits: HolidayCommit[] = Array.from(holidayMap.entries())
    .map(([date, { name, commits }]) => ({ date, holidayName: name, commits }))
    .sort((a, b) => b.commits - a.commits);

  // 非工作时间占比
  const holidayTotal = holidayCommits.reduce((sum, h) => sum + h.commits, 0);
  const offHoursCount = lateNightCommits + earlyMorningCommits + weekendCommits + holidayTotal;
  const offHoursRate = offHoursCount / commits.length;

  // 压力评分 (0-100)
  const lateNightWeight = (lateNightCommits / commits.length) * 40;
  const earlyMorningWeight = (earlyMorningCommits / commits.length) * 30;
  const weekendWeight = (weekendCommits / commits.length) * 20;
  const holidayWeight = (holidayCommits.length > 0 ? 1 : 0) * 10;

  const pressureScore = Math.round(lateNightWeight + earlyMorningWeight + weekendWeight + holidayWeight);

  return {
    lateNightCommits,
    earlyMorningCommits,
    weekendCommits,
    holidayCommits,
    pressureScore,
    offHoursRate: Math.round(offHoursRate * 1000) / 1000
  };
}

function emptyWorkPressure(): WorkPressureMetrics {
  return {
    lateNightCommits: 0,
    earlyMorningCommits: 0,
    weekendCommits: 0,
    holidayCommits: [],
    pressureScore: 0,
    offHoursRate: 0,
  };
}

/**
 * 获取中国 2024-2026 主要节假日
 */
function getHolidays(): Map<string, string> {
  const holidays = new Map<string, string>();

  // 2024
  const dates2024: Array<[string, string]> = [
    ['2024-01-01', '元旦'],
    ['2024-02-10', '春节'], ['2024-02-11', '春节'], ['2024-02-12', '春节'],
    ['2024-04-04', '清明节'], ['2024-04-05', '清明节'], ['2024-04-06', '清明节'],
    ['2024-05-01', '劳动节'], ['2024-05-02', '劳动节'], ['2024-05-03', '劳动节'],
    ['2024-06-10', '端午节'],
    ['2024-09-15', '中秋节'], ['2024-09-16', '中秋节'], ['2024-09-17', '中秋节'],
    ['2024-10-01', '国庆节'], ['2024-10-02', '国庆节'], ['2024-10-03', '国庆节']
  ];

  // 2025
  const dates2025: Array<[string, string]> = [
    ['2025-01-01', '元旦'],
    ['2025-01-29', '春节'], ['2025-01-30', '春节'], ['2025-01-31', '春节'],
    ['2025-04-04', '清明节'], ['2025-04-05', '清明节'], ['2025-04-06', '清明节'],
    ['2025-05-01', '劳动节'], ['2025-05-02', '劳动节'], ['2025-05-03', '劳动节'],
    ['2025-05-31', '端午节'],
    ['2025-10-01', '国庆节'], ['2025-10-02', '国庆节'], ['2025-10-06', '中秋节']
  ];

  // 2026
  const dates2026: Array<[string, string]> = [
    ['2026-01-01', '元旦'],
    ['2026-02-17', '春节'], ['2026-02-18', '春节'], ['2026-02-19', '春节'],
    ['2026-04-05', '清明节'],
    ['2026-05-01', '劳动节'],
    ['2026-06-19', '端午节'],
    ['2026-09-25', '中秋节'],
    ['2026-10-01', '国庆节'], ['2026-10-02', '国庆节']
  ];

  [...dates2024, ...dates2025, ...dates2026].forEach(([date, name]) => {
    holidays.set(date, name);
  });

  return holidays;
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
