[根目录](../../CLAUDE.md) > **types**

---

## 模块职责

Types 模块集中定义了 commit-report 项目的所有 TypeScript 类型，确保类型安全与代码可维护性。

**设计原则**:
- 单一来源：所有类型定义集中在一个文件
- 不与业务代码混合：纯类型定义，无实现逻辑
- 完整性：覆盖所有数据结构、配置、接口

## 入口与启动

**主入口**: `src/types/index.ts`（346 行）

**使用方式**:
```typescript
import type { CommitStats, RepoInfo, CommitRecord } from '../types/index.js';
```

## 对外接口

### 核心数据结构

**CommitRecord** - 单条 Git 提交记录
```typescript
interface CommitRecord {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: FileChange[];
}
```

**CommitStats** - 核心统计结果（包含所有维度）
```typescript
interface CommitStats {
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
  hourlyByAuthor?: TimeAuthorStats[];

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
```

**RepoInfo** - 仓库元信息
```typescript
interface RepoInfo {
  path: string;
  name: string;
  commitCount: number;
}
```

### 配置类型

**CliOptions** - CLI 参数
```typescript
interface CliOptions {
  period: string;
  from?: string;
  to?: string;
  author?: string;
  output: string;
  open: boolean;
  depth: number;
}
```

**ScanOptions** - 扫描配置
```typescript
interface ScanOptions {
  targetDir: string;
  maxDepth: number;
}
```

**AnalyzeOptions** - 分析配置
```typescript
interface AnalyzeOptions {
  repos: RepoInfo[];
  timeRange: TimeRange | null;
  author?: string;
}
```

**ReportOptions** - 报告配置
```typescript
interface ReportOptions {
  outputPath: string;
  autoOpen: boolean;
  timeRange: TimeRange | null;
  repoNames: string[];
}
```

### 扩展统计类型

**QualityMetrics** - 代码质量指标
```typescript
interface QualityMetrics {
  avgFilesPerCommit: number;
  avgLinesPerCommit: number;
  churnRate: number;
  hotFiles: HotFile[];
}
```

**TimePatterns** - 时间模式指标
```typescript
interface TimePatterns {
  weekdayDistribution: number[];
  weekendCommits: number;
  avgCommitInterval: number;
  longestStreak: number;
  currentStreak: number;
  weekdayByAuthor?: TimeAuthorStats[];
}
```

**TrendData** - 趋势数据
```typescript
interface TrendData {
  weeklyTrend: WeeklyPoint[];
  cumulativeLines: CumulativePoint[];
}
```

**CollaborationMetrics** - 协作指标
```typescript
interface CollaborationMetrics {
  soloFiles: SoloFile[];
  collaborationHotspots: CollabFile[];
}
```

### 高级统计类型

**TeamHealthMetrics** - 团队健康度
```typescript
interface TeamHealthMetrics {
  busFactor: number;
  criticalAuthors: CriticalAuthor[];
  knowledgeDistribution: number;
  riskLevel: 'low' | 'medium' | 'high';
}
```

**StabilityMetrics** - 代码稳定性
```typescript
interface StabilityMetrics {
  fileChurnRate: FileChurn[];
  directoryChurnRate: DirectoryChurn[];
  revertRate: number;
  fixCommitRate: number;
  stabilityScore: number;
}
```

**WorkPressureMetrics** - 工作压力
```typescript
interface WorkPressureMetrics {
  lateNightCommits: number;
  earlyMorningCommits: number;
  weekendCommits: number;
  holidayCommits: HolidayCommit[];
  pressureScore: number;
  offHoursRate: number;
}
```

**ContributorChurnMetrics** - 贡献者流失
```typescript
interface ContributorChurnMetrics {
  active: AuthorDetail[];
  occasional: AuthorDetail[];
  dormant: AuthorDetail[];
  lost: AuthorDetail[];
  newJoiners: AuthorDetail[];
  churnRate: number;
  retentionRate: number;
  growthRate: number;
}
```

**AdvancedCollaborationMetrics** - 高级协作
```typescript
interface AdvancedCollaborationMetrics {
  tightCoupling: FilePair[];
  frequentPairs: FilePair[];
  pairProgramming: AuthorPair[];
  couplingScore: number;
}
```

## 关键依赖与配置

**依赖**: 无外部依赖，纯类型定义

**组织结构**:
- 第 1-46 行: 基础提交与文件类型
- 第 48-126 行: 扩展统计类型
- 第 146-186 行: 核心 CommitStats 类型
- 第 188-243 行: 配置与选项类型
- 第 245-346 行: 高级统计类型

## 数据模型

**类型层级**:
```
CommitRecord (原始数据)
    ↓
CommitStats (聚合统计)
    ├── 基础统计
    ├── 作者维度 (AuthorStats[])
    ├── 文件类型维度 (FileTypeStats[])
    ├── 目录维度 (DirectoryStats[])
    ├── 时间分布
    ├── 质量指标 (QualityMetrics)
    ├── 时间模式 (TimePatterns)
    ├── 趋势数据 (TrendData)
    ├── 协作指标 (CollaborationMetrics)
    ├── Commit Message 统计 (CommitMessageStats)
    ├── 作者文件类型贡献 (AuthorFileTypeContribution[])
    └── 高级统计（可选）
        ├── teamHealth (TeamHealthMetrics)
        ├── stability (StabilityMetrics)
        ├── workPressure (WorkPressureMetrics)
        ├── contributorChurn (ContributorChurnMetrics)
        └── advancedCollaboration (AdvancedCollaborationMetrics)
```

## 测试与质量

**测试覆盖**: 无单元测试（类型定义无需测试）

**类型检查**: 通过 `tsc --noEmit` 验证

## 常见问题 (FAQ)

**Q: 为什么高级统计字段是可选的（`?`）？**
A: 多仓库场景下无法准确计算高级统计，这些字段为 `undefined`。

**Q: 如何添加新的统计维度？**
A:
1. 在此文件中定义新的 interface
2. 扩展 `CommitStats` 类型
3. 在 `stats-calculator.ts` 中实现计算逻辑

**Q: 为什么不拆分为多个文件？**
A: 单文件便于查找和维护，避免循环依赖。当前 346 行在可控范围内。

**Q: Date 类型在 JSON 序列化时如何处理？**
A: 在 `reporter/html-builder.ts` 中手动转为 ISO 字符串。

## 相关文件清单

```
src/types/
└── index.ts          # 唯一文件，包含所有类型定义（346 行）
```

**关键类型位置**:
- CommitRecord: 第 6-13 行
- CommitStats: 第 146-186 行
- 配置类型: 第 196-231 行
- 高级统计类型: 第 248-345 行

## 变更记录 (Changelog)

**2026-03-10 22:47:20** - 初始化模块文档
