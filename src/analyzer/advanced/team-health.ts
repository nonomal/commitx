import type { CommitRecord, TeamHealthMetrics } from '../../types/index.js';

/**
 * 计算团队健康度指标
 */
export function calculateTeamHealth(commits: CommitRecord[]): TeamHealthMetrics {
  return emptyTeamHealth();
}

function emptyTeamHealth(): TeamHealthMetrics {
  return {
    busFactor: 0,
    criticalAuthors: [],
    knowledgeDistribution: 1,
    riskLevel: 'low',
  };
}
