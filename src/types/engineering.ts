/** 基于当前 HEAD blame 的文件所有权 */
export interface CodeOwnershipMetrics {
  totalFiles: number;
  files: FileOwnership[];
}

export interface FileOwnership {
  path: string;
  ownerName: string;
  ownerEmail: string;
  ownerLines: number;
  totalLines: number;
  ownershipRatio: number;
  contributors: FileOwnerContribution[];
}

export interface FileOwnerContribution {
  name: string;
  email: string;
  lines: number;
  ratio: number;
}

/** fix: 提交反推的 Bug 高发文件 */
export interface BugFixHotFile {
  path: string;
  fixCount: number;
  lastFixDate: Date;
  fixAuthors: string[];
}

export interface BugFixAnalysis {
  fixCommitCount: number;
  hotFiles: BugFixHotFile[];
}

/** Merge commit trailer 解析得到的评审参与度 */
export interface ReviewQualityMetrics {
  mergeCommitCount: number;
  reviewedMergeCount: number;
  reviewParticipationRate: number;
  reviewers: ReviewParticipant[];
}

export interface ReviewParticipant {
  name: string;
  email: string;
  commits: number;
}

/** Conventional Commits 质量评分 */
export interface CommitQualityMetrics {
  score: number;
  conventionalRate: number;
  scopeCoverageRate: number;
  averageMessageLength: number;
  typeDistribution: Record<string, number>;
}

/** 文件创建/删除/修改推导的新增 vs 重构比例 */
export interface ChangeMixMetrics {
  createdFiles: number;
  deletedFiles: number;
  modifiedFiles: number;
  featureRatio: number;
  refactorRatio: number;
}

export interface EngineeringMetrics {
  codeOwnership?: CodeOwnershipMetrics;
  bugFixHotFiles: BugFixAnalysis;
  reviewQuality: ReviewQualityMetrics;
  commitQuality: CommitQualityMetrics;
  changeMix: ChangeMixMetrics;
}
