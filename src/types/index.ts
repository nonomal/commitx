// ============================================================
// commitx 类型定义
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
  timeRange: TimeRange;
  author?: string;
}

/** 报告配置 */
export interface ReportOptions {
  outputPath: string;
  autoOpen: boolean;
  timeRange: TimeRange;
  repoNames: string[];
}

/** 传递给 HTML 模板的完整数据 */
export interface ReportData {
  stats: CommitStats;
  generatedAt: string;
  timeRange: {
    from: string;
    to: string;
  };
  repos: string[];
}
