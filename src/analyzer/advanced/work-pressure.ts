import type { CommitRecord, WorkPressureMetrics } from '../../types/index.js';

/**
 * 计算工作压力指标
 */
export function calculateWorkPressure(commits: CommitRecord[]): WorkPressureMetrics {
  return emptyWorkPressure();
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
