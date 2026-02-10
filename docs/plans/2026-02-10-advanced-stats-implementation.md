# Advanced Stats Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 commitx 添加 5 个高级统计维度（团队健康度、代码稳定性、工作压力、贡献者流失率、文件协作热度），提升从"统计工具"到"团队健康仪表板"的能力。

**Architecture:** 采用渐进式集成策略，创建独立的 `analyzer/advanced/` 模块，包含 5 个子模块。通过在 `CommitStats` 接口中添加可选字段来保持向后兼容。使用 TDD 方法，每个模块配有完整的单元测试。

**Tech Stack:** TypeScript 5.9, tsup (构建), D3.js (可视化), Tailwind CSS (样式)

**参考文档:** `docs/plans/2026-02-10-advanced-stats-design.md`

---

## Phase 1: 架构搭建（第 1-2 天）

### Task 1: 创建目录结构

**Files:**
- Create: `src/types/core.ts`
- Create: `src/types/advanced.ts`
- Modify: `src/types/index.ts`
- Create: `src/analyzer/advanced/index.ts`
- Create: `src/analyzer/advanced/team-health.ts`
- Create: `src/analyzer/advanced/code-stability.ts`
- Create: `src/analyzer/advanced/work-pressure.ts`
- Create: `src/analyzer/advanced/contributor-churn.ts`
- Create: `src/analyzer/advanced/collaboration.ts`

**Step 1: 创建目录**

```bash
mkdir -p src/analyzer/advanced
```

**Step 2: 验证目录创建**

Run: `ls -la src/analyzer/`
Expected: 看到 `advanced/` 目录

**Step 3: Commit**

```bash
git add src/analyzer/advanced/
git commit -m "chore: create advanced analyzer directory structure

Prepare for 5 advanced statistics modules.
"
```

---

### Task 2: 拆分类型定义 - 创建 types/core.ts

**Files:**
- Create: `src/types/core.ts`

**Step 1: 从 index.ts 复制现有类型到 core.ts**

```typescript
// ============================================================
// commitx 核心类型定义
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
  weekdayByAuthor: WeekdayAuthorStats[];
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

/** 作者×文件类型交叉统计 */
export interface AuthorFileTypeStats {
  author: string;
  extension: string;
  fileCount: number;
  linesAdded: number;
  linesDeleted: number;
  commits: number;
}

/** 最繁忙的一天 */
export interface BusiestDay {
  date: string;
  count: number;
}

/** 每小时作者分布 */
export interface HourlyAuthorStats {
  hour: number;
  total: number;
  authors: Record<string, number>;
}

/** 每周几作者分布 */
export interface WeekdayAuthorStats {
  day: number;
  total: number;
  authors: Record<string, number>;
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
  hourlyByAuthor: HourlyAuthorStats[];
  dailyHeatmap: Record<string, number>;

  // 扩展统计维度
  quality: QualityMetrics;
  timePatterns: TimePatterns;
  trends: TrendData;
  collaboration: CollaborationMetrics;
  messageStats: CommitMessageStats;

  // 作者×文件类型交叉统计
  authorFileTypes: AuthorFileTypeStats[];
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
```

**Step 2: 验证 TypeScript 编译**

Run: `pnpm build`
Expected: 编译成功（即使有未使用导出的警告）

**Step 3: Commit**

```bash
git add src/types/core.ts
git commit -m "refactor: extract core types to separate file

Prepare for type system modularization.
"
```

---

### Task 3: 创建高级统计类型定义 - types/advanced.ts

**Files:**
- Create: `src/types/advanced.ts`

**Step 1: 创建高级统计类型**

```typescript
// ============================================================
// 高级统计类型定义
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
```

**Step 2: 验证 TypeScript 编译**

Run: `pnpm build`
Expected: 编译成功

**Step 3: Commit**

```bash
git add src/types/advanced.ts
git commit -m "feat(types): add advanced statistics type definitions

Add type definitions for 5 advanced metrics:
- Team health (bus factor)
- Code stability (churn rate)
- Work pressure
- Contributor churn
- Advanced collaboration
"
```

---

### Task 4: 更新 types/index.ts - 重新导出并扩展 CommitStats

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 更新 types/index.ts**

在文件开头添加导出，并更新 CommitStats 接口：

```typescript
// 导出核心类型
export * from './core.js';

// 导出高级统计类型
export * from './advanced.js';
```

然后找到 CommitStats 接口，在末尾添加可选字段（如果 core.ts 中的 CommitStats 没有这些字段）：

**注意**：由于我们在 Step 2 中已经把 CommitStats 放到 core.ts 了，现在需要修改 core.ts

**Step 2: 修改 src/types/core.ts 的 CommitStats 接口**

在 `CommitStats` 接口的末尾添加：

```typescript
  // 新增：高级统计（可选，向后兼容）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
```

但是这会导致循环依赖问题（core.ts 需要 advanced.ts 的类型）。

**正确做法**：在 index.ts 中重新声明扩展的 CommitStats

让我重新设计这个步骤：

**Step 1: 清空并重写 types/index.ts**

```typescript
// ============================================================
// commitx 类型定义入口
// ============================================================

// 导出核心类型
export * from './core.js';

// 导出高级统计类型
export * from './advanced.js';

// 类型扩展：在 CommitStats 中添加高级统计（可选字段）
import type { CommitStats as CoreCommitStats } from './core.js';
import type {
  TeamHealthMetrics,
  StabilityMetrics,
  WorkPressureMetrics,
  ContributorChurnMetrics,
  AdvancedCollaborationMetrics,
} from './advanced.js';

// 重新导出扩展的 CommitStats
export interface CommitStats extends CoreCommitStats {
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
}
```

等等，这会导致名称冲突。让我重新思考...

**更好的方案**：直接在 core.ts 的 CommitStats 中预留可选字段，使用 `unknown` 类型占位：

修改 core.ts 中的 CommitStats：

```typescript
  // 高级统计（可选，类型在 advanced.ts 中定义）
  teamHealth?: unknown;
  stability?: unknown;
  workPressure?: unknown;
  contributorChurn?: unknown;
  advancedCollaboration?: unknown;
```

然后在 index.ts 中通过类型断言或声明合并来提供正确的类型。

**最简单的方案**：不在 core.ts 中定义这些字段，而是在使用时通过类型交叉来扩展。

让我采用最实用的方案：

**Step 1: 删除原有的 src/types/index.ts 内容**

**Step 2: 重写 src/types/index.ts**

```typescript
// ============================================================
// commitx 类型定义入口
// ============================================================

// 重新导出所有类型（现在types/index.ts文件已经很大，我们需要保留原有内容并添加新的导出）
// 由于原文件已经定义了所有类型，我们采用渐进式策略：
// 1. 先导出新的 advanced 类型
// 2. 在 CommitStats 中添加可选字段

export * from './advanced.js';

// 以下是原有的类型定义（从 types/index.ts 保留）
// ... 保留所有现有类型定义 ...

// 在 CommitStats 接口末尾添加（找到 CommitStats 定义，在 authorFileTypes 字段后添加）:
/*
  // 新增：高级统计（可选，向后兼容）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
*/
```

**这个方案太复杂了。让我简化：保持 types/index.ts 不变，只添加 advanced.ts，在实际使用时再扩展。**

实际上，最实用的做法是：

**Step 1: 保持 src/types/index.ts 原样**

只在文件末尾添加一行：

```typescript
// 高级统计类型
export * from './advanced.js';
```

**Step 2: 在 CommitStats 接口定义中直接添加可选字段**

找到 `export interface CommitStats {` 的定义，在最后的 `}` 之前添加：

```typescript
  // 新增：高级统计（可选，向后兼容）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
```

**Step 3: 添加导入语句**

在 types/index.ts 文件顶部的类型导入区域添加：

```typescript
import type {
  TeamHealthMetrics,
  StabilityMetrics,
  WorkPressureMetrics,
  ContributorChurnMetrics,
  AdvancedCollaborationMetrics,
} from './advanced.js';
```

等等，这又导致了问题：advanced.ts 还没有被创建到正确的位置，而且会有循环依赖。

**最终方案（最简单）**：

不拆分 types 文件。直接在 types/index.ts 中添加所有高级统计类型，在 CommitStats 接口中添加可选字段。

**Step 1: 编辑 src/types/index.ts**

在文件末尾（最后一个接口定义之后）添加高级统计类型定义。

然后在 `CommitStats` 接口的 `authorFileTypes: AuthorFileTypeStats[];` 这一行之后添加可选字段。

**Step 2: 验证编译**

Run: `pnpm build`
Expected: 编译成功

**Step 3: Commit**

```bash
git add src/types/
git commit -m "feat(types): add advanced statistics type system

Add 5 advanced metrics types and extend CommitStats with optional fields.
Maintains backward compatibility.
"
```

---

由于类型重构变得复杂，让我重新设计这个任务，采用更简单的策略。

### Task 4 (简化版): 在 types/index.ts 中添加高级统计类型

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 在 types/index.ts 末尾添加高级统计类型**

在文件的最后（`ReportData` 接口之后）添加：

```typescript
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
```

**Step 2: 在 CommitStats 接口中添加可选字段**

找到 `export interface CommitStats {`，在 `authorFileTypes: AuthorFileTypeStats[];` 之后、接口结束的 `}` 之前添加：

```typescript
  // 高级统计（可选，向后兼容）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
```

**Step 3: 验证编译**

Run: `pnpm build`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add advanced statistics type definitions

Extend CommitStats with 5 optional advanced metrics:
- Team health (bus factor)
- Code stability (churn rate)
- Work pressure
- Contributor churn
- Advanced collaboration

Maintains backward compatibility.
"
```

---

### Task 5: 创建空的高级统计模块框架

**Files:**
- Create: `src/analyzer/advanced/team-health.ts`
- Create: `src/analyzer/advanced/code-stability.ts`
- Create: `src/analyzer/advanced/work-pressure.ts`
- Create: `src/analyzer/advanced/contributor-churn.ts`
- Create: `src/analyzer/advanced/collaboration.ts`
- Create: `src/analyzer/advanced/index.ts`

**Step 1: 创建 team-health.ts**

```typescript
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
```

**Step 2: 创建 code-stability.ts**

```typescript
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
```

**Step 3: 创建 work-pressure.ts**

```typescript
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
```

**Step 4: 创建 contributor-churn.ts**

```typescript
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
```

**Step 5: 创建 collaboration.ts**

```typescript
import type { CommitRecord, AdvancedCollaborationMetrics } from '../../types/index.js';

/**
 * 计算高级协作指标
 */
export function calculateAdvancedCollaboration(commits: CommitRecord[]): AdvancedCollaborationMetrics {
  return emptyCollaboration();
}

function emptyCollaboration(): AdvancedCollaborationMetrics {
  return {
    tightCoupling: [],
    frequentPairs: [],
    pairProgramming: [],
    couplingScore: 0,
  };
}
```

**Step 6: 创建 advanced/index.ts**

```typescript
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
```

**Step 7: 验证编译**

Run: `pnpm build`
Expected: 编译成功

**Step 8: Commit**

```bash
git add src/analyzer/advanced/
git commit -m "feat(analyzer): create advanced statistics module framework

Add 5 empty calculation modules:
- team-health.ts
- code-stability.ts
- work-pressure.ts
- contributor-churn.ts
- collaboration.ts

Each returns empty/default values, ready for implementation.
"
```

---

### Task 6: 验证架构搭建完成

**Step 1: 运行构建**

Run: `pnpm build`
Expected: 构建成功，无错误

**Step 2: 检查文件结构**

Run: `tree src/types src/analyzer/advanced -L 2`
Expected: 看到完整的目录结构

**Step 3: 最终 Commit**

```bash
git commit --allow-empty -m "chore: Phase 1 (架构搭建) 完成

✅ 类型系统扩展完成
✅ 5个空模块框架就绪
✅ 构建验证通过

Next: Phase 2 - 核心功能实现
"
```

---

## Phase 2: 核心功能实现（第 3-7 天）

**注意**: Phase 2 的详细任务将在 Phase 1 完成后创建。每个模块将包含：
- TDD 测试用例（5+ 个）
- 完整算法实现
- 边界情况处理

预计每个模块需要 1 个工作日，按优先级：
- Day 3: Team Health (团队健康度)
- Day 4: Code Stability (代码稳定性)
- Day 5: Work Pressure (工作压力)
- Day 6: Contributor Churn (贡献者流失)
- Day 7: Advanced Collaboration (文件协作)

---

## 验收标准

**Phase 1 完成标志:**
- [ ] 所有文件编译无错误
- [ ] 类型定义完整（5个高级统计类型）
- [ ] 5个空模块返回默认值
- [ ] Git 提交历史清晰（每个任务 1 次提交）

**后续阶段:**
- Phase 2: 核心功能实现 + 单元测试
- Phase 3: 集成与合并逻辑
- Phase 4: 前端报告开发
- Phase 5: 测试与优化
- Phase 6: 发布准备

---

## 参考资料

- 设计文档: `docs/plans/2026-02-10-advanced-stats-design.md`
- 现有类型: `src/types/index.ts`
- 核心统计: `src/analyzer/stats-calculator.ts`

---

**实施时使用**: `superpowers:executing-plans` 或 `superpowers:subagent-driven-development`
