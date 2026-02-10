import type { CommitRecord, ContributorChurnMetrics } from '../../types/index.js';

/**
 * 计算贡献者流失率指标
 */
export function calculateContributorChurn(commits: CommitRecord[]): ContributorChurnMetrics {
  return emptyContributorChurn();
}

function emptyContributorChurn(): ContributorChurnMetrics {
  return {
    active: [],
    occasional: [],
    dormant: [],
    lost: [],
    newJoiners: [],
    churnRate: 0,
    retentionRate: 0,
    growthRate: 0,
  };
}
