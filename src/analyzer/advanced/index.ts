import type { CommitRecord } from '../../types/index.js';
import type {
  TeamHealthMetrics,
  StabilityMetrics,
  WorkPressureMetrics,
  ContributorChurnMetrics,
  AdvancedCollaborationMetrics,
} from '../../types/index.js';

import { calculateTeamHealth } from './team-health.js';
import { calculateStability } from './code-stability.js';
import { calculateWorkPressure } from './work-pressure.js';
import { calculateContributorChurn } from './contributor-churn.js';
import { calculateAdvancedCollaboration } from './collaboration.js';

/**
 * 高级统计结果集合
 */
export interface AdvancedStats {
  teamHealth: TeamHealthMetrics;
  stability: StabilityMetrics;
  workPressure: WorkPressureMetrics;
  contributorChurn: ContributorChurnMetrics;
  advancedCollaboration: AdvancedCollaborationMetrics;
}

/**
 * 一次性计算所有高级统计
 */
export function calculateAdvancedStats(commits: CommitRecord[]): AdvancedStats {
  return {
    teamHealth: calculateTeamHealth(commits),
    stability: calculateStability(commits),
    workPressure: calculateWorkPressure(commits),
    contributorChurn: calculateContributorChurn(commits),
    advancedCollaboration: calculateAdvancedCollaboration(commits),
  };
}

// 导出单独的计算函数
export {
  calculateTeamHealth,
  calculateStability,
  calculateWorkPressure,
  calculateContributorChurn,
  calculateAdvancedCollaboration,
};
