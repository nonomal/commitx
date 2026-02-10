// ============================================================
// commit-report 类型定义
// ============================================================

/** 单条 Git 提交记录 */
export interface CommitRecord {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: FileChange[];
}

/** 单个文件的变更信息 */
export interface FileChange {
  added: number;
  deleted: number;
  path: string;
}

/** 作者统计信息 */
export interface AuthorStats {
  name: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  lastActiveDate: Date;
}

/** 文件类型统计 */
export interface FileTypeStats {
  extension: string;
  added: number;
  deleted: number;
  fileCount: number;
}

/** 目录统计 */
export interface DirectoryStats {
  path: string;
  commits: number;
  linesChanged: number;
}

// ============================================================
// 扩展统计类型
// ============================================================

/** 热点文件 */
export interface HotFile {
  path: string;
  modifyCount: number;
  authors: string[];
}

/** 代码质量指标 */
export interface QualityMetrics {
  avgFilesPerCommit: number;
  avgLinesPerCommit: number;
  churnRate: number;
  hotFiles: HotFile[];
}

/** 时间模式指标 */
export interface TimePatterns {
  weekdayDistribution: number[];
  weekendCommits: number;
  avgCommitInterval: number;
  longestStreak: number;
  currentStreak: number;
}

/** 周趋势数据点 */
export interface WeeklyPoint {
  week: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
}

/** 累计代码量数据点 */
export interface CumulativePoint {
  date: string;
  netLines: number;
}

/** 趋势数据 */
export interface TrendData {
  weeklyTrend: WeeklyPoint[];
  cumulativeLines: CumulativePoint[];
}

/** 单人维护文件（知识集中度风险） */
export interface SoloFile {
  path: string;
  author: string;
  commits: number;
}

/** 协作热点文件 */
export interface CollabFile {
  path: string;
  authorCount: number;
  totalCommits: number;
}

/** 协作指标 */
export interface CollaborationMetrics {
  soloFiles: SoloFile[];
  collaborationHotspots: CollabFile[];
}

/** Commit Message 分析 */
export interface CommitMessageStats {
  typeDistribution: Record<string, number>;
  avgMessageLength: number;
}

/** 作者文件类型贡献 */
export interface AuthorFileTypeContribution {
  author: string;
  email: string;
  extension: string;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
  fileCount: number;
}

/** 最繁忙的一天 */
export interface BusiestDay {
  date: string;
  count: number;
}

/** 核心统计指标 */
export interface CommitStats {
  // 基础统计
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;

  // 时间维度
  firstCommitDate: Date;
  lastCommitDate: Date;
  busiestDay: BusiestDay;

  // 作者维度
  authors: AuthorStats[];

  // 文件类型维度
  fileTypes: FileTypeStats[];

  // 目录维度
  directories: DirectoryStats[];

  // 时间分布
  hourlyDistribution: number[];
  dailyHeatmap: Record<string, number>;

  // 扩展统计维度
  quality: QualityMetrics;
  timePatterns: TimePatterns;
  trends: TrendData;
  collaboration: CollaborationMetrics;
  messageStats: CommitMessageStats;
  authorFileTypeContributions: AuthorFileTypeContribution[];

  // 高级统计（可选，向后兼容）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
}

/** 仓库信息 */
export interface RepoInfo {
  path: string;
  name: string;
  commitCount: number;
}

/** CLI 参数类型 */
export interface CliOptions {
  period: string;
  from?: string;
  to?: string;
  author?: string;
  output: string;
  open: boolean;
  depth: number;
}

/** 时间范围 */
export interface TimeRange {
  from: Date;
  to: Date;
}

/** 扫描配置 */
export interface ScanOptions {
  targetDir: string;
  maxDepth: number;
}

/** 分析配置 */
export interface AnalyzeOptions {
  repos: RepoInfo[];
  timeRange: TimeRange | null;
  author?: string;
}

/** 报告配置 */
export interface ReportOptions {
  outputPath: string;
  autoOpen: boolean;
  timeRange: TimeRange | null;
  repoNames: string[];
}

/** 传递给 HTML 模板的完整数据 */
export interface ReportData {
  stats: CommitStats;
  generatedAt: string;
  timeRange: {
    from: string;
    to: string;
  } | null;
  repos: string[];
}

// ============================================================
// 高级统计类型（新增）
// ============================================================

/** 团队健康度指标 */
export interface TeamHealthMetrics {
  busFactor: number;
  criticalAuthors: CriticalAuthor[];
  knowledgeDistribution: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CriticalAuthor {
  name: string;
  email: string;
  uniqueFiles: string[];
  dominantFiles: string[];
  knowledgeScore: number;
}

/** 代码稳定性指标 */
export interface StabilityMetrics {
  fileChurnRate: FileChurn[];
  directoryChurnRate: DirectoryChurn[];
  revertRate: number;
  fixCommitRate: number;
  stabilityScore: number;
}

export interface FileChurn {
  path: string;
  added: number;
  deleted: number;
  churnRate: number;
  modifyCount: number;
  isUnstable: boolean;
}

export interface DirectoryChurn {
  path: string;
  churnRate: number;
  totalChanges: number;
  fileCount: number;
}

/** 工作压力指标 */
export interface WorkPressureMetrics {
  lateNightCommits: number;
  earlyMorningCommits: number;
  weekendCommits: number;
  holidayCommits: HolidayCommit[];
  pressureScore: number;
  offHoursRate: number;
}

export interface HolidayCommit {
  date: string;
  holidayName: string;
  commits: number;
}

/** 贡献者流失指标 */
export interface ContributorChurnMetrics {
  active: AuthorDetail[];
  occasional: AuthorDetail[];
  dormant: AuthorDetail[];
  lost: AuthorDetail[];
  newJoiners: AuthorDetail[];
  churnRate: number;
  retentionRate: number;
  growthRate: number;
}

export interface AuthorDetail {
  name: string;
  email: string;
  lastCommitDate: Date;
  daysSinceLastCommit: number;
  totalCommits: number;
}

/** 高级协作指标 */
export interface AdvancedCollaborationMetrics {
  tightCoupling: FilePair[];
  frequentPairs: FilePair[];
  pairProgramming: AuthorPair[];
  couplingScore: number;
}

export interface FilePair {
  file1: string;
  file2: string;
  coOccurrence: number;
  coupling: number;
}

export interface AuthorPair {
  author1: string;
  author2: string;
  sharedFiles: string[];
  collaborationCount: number;
}
