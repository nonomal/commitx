import type { CommitRecord, StabilityMetrics } from '../../types/index.js';

/**
 * 计算代码稳定性指标
 */
export function calculateStability(commits: CommitRecord[]): StabilityMetrics {
  return emptyStability();
}

function emptyStability(): StabilityMetrics {
  return {
    fileChurnRate: [],
    directoryChurnRate: [],
    revertRate: 0,
    fixCommitRate: 0,
    stabilityScore: 100,
  };
}
