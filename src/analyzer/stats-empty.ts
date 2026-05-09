import type { CommitStats } from '../types/index.js';
import {
  emptyCollaborationMetrics,
  emptyMessageStats,
  emptyQualityMetrics,
  emptyTimePatterns,
  emptyTrendData,
} from './stats-metrics.js';

/** 创建空的统计对象 */
export function emptyStats(): CommitStats {
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
    commitDetails: [],
  };
}
