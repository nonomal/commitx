# commitx 高级统计功能设计文档

**文档版本**: 1.0
**创建日期**: 2026-02-10
**状态**: 已批准

---

## 📋 目录

1. [功能概述](#功能概述)
2. [架构设计](#架构设计)
3. [类型定义](#类型定义)
4. [核心算法](#核心算法)
5. [前端展示](#前端展示)
6. [性能优化](#性能优化)
7. [测试策略](#测试策略)
8. [实施计划](#实施计划)
9. [风险控制](#风险控制)

---

## 功能概述

### 目标

为 commitx 添加 5 个高级统计维度，提升从"统计工具"到"团队健康仪表板"的能力。

### 新增功能

| 功能模块 | 核心指标 | 价值 |
|---------|---------|------|
| **1. 团队健康度** | 总线因子、关键人员、知识分布 | 识别单点故障风险 |
| **2. 代码稳定性** | 文件/目录流失率、Revert率、Fix占比 | 定位不稳定模块 |
| **3. 工作压力** | 深夜/凌晨/周末/假期提交分析 | 反映团队工作压力 |
| **4. 贡献者流失率** | 四级分类（active/occasional/dormant/lost） | 团队健康度核心指标 |
| **5. 文件协作热度** | 文件耦合、结对编程检测 | 发现代码耦合问题 |

### 设计原则

- ✅ **向后兼容**：现有功能零破坏，旧版报告仍可正常工作
- ✅ **渐进式集成**：新功能作为 `CommitStats` 的可选字段
- ✅ **模块化清晰**：每个统计模块独立文件，<500 行
- ✅ **性能优先**：10万提交 <30秒

---

## 架构设计

### 目录结构

```
src/
├── types/
│   ├── index.ts              # 导出所有类型
│   ├── core.ts              # 核心类型（重构）
│   └── advanced.ts          # 高级统计类型（新建）
│
├── analyzer/
│   ├── stats-calculator.ts   # 核心统计（保持）
│   ├── git-log-parser.ts    # Git解析（保持）
│   ├── index.ts             # 主分析流程（更新）
│   └── advanced/            # 高级统计模块（新建）
│       ├── index.ts         # 整合导出
│       ├── team-health.ts   # 团队健康度
│       ├── code-stability.ts # 代码稳定性
│       ├── work-pressure.ts  # 工作压力
│       ├── contributor-churn.ts # 贡献者流失
│       └── collaboration.ts  # 文件协作
│
└── reporter/
    ├── html-builder.ts      # 数据序列化（更新）
    └── templates/
        └── report.html      # HTML模板（更新）
```

### 数据流

```
CLI 参数解析
    ↓
Scanner: 扫描仓库
    ↓
GitLogParser: 解析提交记录
    ↓
[核心统计]              [高级统计]
calculateStats()  +  calculateAdvancedStats()
    ↓                       ↓
    └─────── 合并 ─────────┘
              ↓
        CommitStats (完整)
              ↓
      Reporter: 生成 HTML
              ↓
        打开浏览器
```

### 集成方式

**analyzer/index.ts 更新**：

```typescript
export async function analyzeRepos(options: AnalyzeOptions): Promise<CommitStats> {
  // ... 现有逻辑

  // 核心统计
  const coreStats = calculateStats(commits);

  // 高级统计（新增）
  const advancedStats = calculateAdvancedStats(commits);

  // 合并
  return {
    ...coreStats,
    teamHealth: advancedStats.teamHealth,
    stability: advancedStats.stability,
    workPressure: advancedStats.workPressure,
    contributorChurn: advancedStats.contributorChurn,
    advancedCollaboration: advancedStats.advancedCollaboration
  };
}
```

---

## 类型定义

### types/advanced.ts

```typescript
// 1. 团队健康度
export interface TeamHealthMetrics {
  busFactor: number;
  criticalAuthors: CriticalAuthor[];
  knowledgeDistribution: number;  // 0-1
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CriticalAuthor {
  name: string;
  email: string;
  uniqueFiles: string[];      // 独有文件
  dominantFiles: string[];    // 主导文件（贡献>50%）
  knowledgeScore: number;     // 0-100
}

// 2. 代码稳定性
export interface StabilityMetrics {
  fileChurnRate: FileChurn[];
  directoryChurnRate: DirectoryChurn[];
  revertRate: number;
  fixCommitRate: number;
  stabilityScore: number;     // 0-100
}

export interface FileChurn {
  path: string;
  added: number;
  deleted: number;
  churnRate: number;          // deleted / added
  modifyCount: number;
  isUnstable: boolean;
}

export interface DirectoryChurn {
  path: string;
  churnRate: number;
  totalChanges: number;
  fileCount: number;
}

// 3. 工作压力
export interface WorkPressureMetrics {
  lateNightCommits: number;       // 23:00-02:00
  earlyMorningCommits: number;    // 02:00-06:00
  weekendCommits: number;
  holidayCommits: HolidayCommit[];
  pressureScore: number;          // 0-100
  offHoursRate: number;
}

export interface HolidayCommit {
  date: string;
  holidayName: string;
  commits: number;
}

// 4. 贡献者流失率
export interface ContributorChurnMetrics {
  active: AuthorDetail[];         // <30天
  occasional: AuthorDetail[];     // 30-90天
  dormant: AuthorDetail[];        // 90-180天
  lost: AuthorDetail[];           // >180天
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

// 5. 高级协作
export interface AdvancedCollaborationMetrics {
  tightCoupling: FilePair[];      // 同提交文件对
  frequentPairs: FilePair[];      // 24h窗口文件对
  pairProgramming: AuthorPair[];  // 结对编程
  couplingScore: number;          // 0-100
}

export interface FilePair {
  file1: string;
  file2: string;
  coOccurrence: number;
  coupling: number;               // 0-1
}

export interface AuthorPair {
  author1: string;
  author2: string;
  sharedFiles: string[];
  collaborationCount: number;
}
```

### types/core.ts 更新

```typescript
// CommitStats 添加可选字段
export interface CommitStats {
  // ... 现有所有字段保持不变

  // 新增：高级统计（可选）
  teamHealth?: TeamHealthMetrics;
  stability?: StabilityMetrics;
  workPressure?: WorkPressureMetrics;
  contributorChurn?: ContributorChurnMetrics;
  advancedCollaboration?: AdvancedCollaborationMetrics;
}
```

---

## 核心算法

### 1. 团队健康度算法

**目标**：计算 Bus Factor（多少人离职会严重影响项目）

**算法**：混合法（独有文件 + 主导文件）

```
For each author:
  1. 统计独有文件：只有该作者修改过的文件
  2. 统计主导文件：该作者贡献 >50% 的文件
  3. 知识独占度 = (独有文件*2 + 主导文件) / 总文件数 * 100
  4. 如果评分 >10，标记为关键人员

Bus Factor = 关键人员数量
知识分布均匀度 = 1 - (总独有文件数 / 总文件数)
风险等级 = Bus Factor=1 ? 'high' : <=3 ? 'medium' : 'low'
```

**时间复杂度**: O(n*m)，n=提交数，m=文件数

---

### 2. 代码稳定性算法

**目标**：识别不稳定模块（高流失率）

**算法**：

```
For each file:
  流失率 = 删除行数 / 新增行数

  if 流失率 > 0.5:
    标记为不稳定文件

稳定性评分 = 100 - (平均流失率*50 + Revert率*100 + Fix率*50)
```

**输出**：
- 文件级 TOP 20
- 目录级 TOP 10

---

### 3. 工作压力算法

**目标**：量化团队工作压力

**算法**：

```
For each commit:
  if hour in [23, 0, 1]:  lateNightCommits++
  if hour in [2, 3, 4, 5]: earlyMorningCommits++
  if weekday in [6, 0]:   weekendCommits++
  if date in holidays:    holidayCommits++

压力评分 =
  深夜提交率 * 40 +
  凌晨提交率 * 30 +
  周末提交率 * 20 +
  (有假期提交 ? 10 : 0)
```

**假期数据**：硬编码中国 2024-2026 主要节假日

---

### 4. 贡献者流失率算法

**目标**：识别沉默或流失的贡献者

**算法**：

```
For each author:
  daysSinceLast = now - lastCommitDate

  if daysSinceLast < 30:   active
  elif daysSinceLast < 90:  occasional
  elif daysSinceLast < 180: dormant
  else:                     lost

流失率 = lost人数 / 总人数
留存率 = active人数 / 总人数
增长率 = newJoiners人数 / 总人数
```

---

### 5. 文件协作热度算法

**目标**：发现紧密耦合的文件对

**算法**：

```
同提交耦合：
For each commit:
  For each file pair in commit.files:
    coCommitCount++

耦合度 = coCommitCount / min(file1修改次数, file2修改次数)

24小时窗口耦合：
For each commit:
  收集 [commit.date, commit.date + 24h] 内所有文件
  组合文件对并计数

结对编程检测：
For each file:
  找出贡献最多的两个作者
  if 共同修改文件数 >= 3:
    标记为结对编程
```

**性能优化**：
- 限制单提交文件数 ≤50（超出采样）
- 使用 Set 去重
- 输出限制 TOP 20

---

## 前端展示

### 报告布局

```html
<section id="advanced-analytics">
  <h2>📊 高级分析</h2>

  <!-- Tab 导航 -->
  <div class="tabs">
    <button data-tab="team-health">团队健康度</button>
    <button data-tab="stability">代码稳定性</button>
    <button data-tab="work-pressure">工作压力</button>
    <button data-tab="contributor-churn">贡献者流失</button>
    <button data-tab="collaboration">协作热度</button>
  </div>

  <!-- Tab 内容 -->
  <div id="team-health" class="tab-content">
    <div id="bus-factor-gauge"></div>      <!-- D3 仪表盘 -->
    <div id="critical-authors-list"></div> <!-- 列表 -->
  </div>

  <!-- ... 其他 Tab -->
</section>
```

### 图表类型

| 统计维度 | 主图表 | D3.js API |
|---------|--------|-----------|
| 团队健康度 | 半圆仪表盘 | `d3.arc()` |
| 代码稳定性 | 横向柱状图 | `d3.scaleBand()` |
| 工作压力 | 饼图 | `d3.pie()` |
| 贡献者流失 | 漏斗图 | 自定义 SVG |
| 协作热度 | 网络图 | `d3.forceSimulation()` |

### 样式设计

- 使用现有 Tailwind CSS
- 支持明暗主题切换
- 响应式布局（移动端友好）

---

## 性能优化

### 瓶颈与优化

| 瓶颈 | 优化策略 |
|------|---------|
| 文件协作 O(n²) | 1. 限制文件数≤50/提交<br>2. 使用 Set 去重 |
| 24h窗口分析 | 提前排序 + 二分查找 |
| 多仓库合并 | Map 查找代替数组遍历 |
| 前端渲染 | 虚拟滚动 + 按需加载 Tab |

### 性能目标

- 1万提交: <5秒
- 10万提交: <30秒
- 报告生成: <5秒
- 前端渲染: <2秒

### 大仓库处理

```typescript
if (commits.length > 100000) {
  console.warn('提交数过多，建议使用时间范围过滤');
  // 可选：采样模式（每10次取1次）
}
```

---

## 测试策略

### 测试结构

```
tests/
├── unit/
│   ├── team-health.test.ts
│   ├── code-stability.test.ts
│   ├── work-pressure.test.ts
│   ├── contributor-churn.test.ts
│   └── collaboration.test.ts
└── integration/
    ├── advanced-stats.test.ts
    └── merge-stats.test.ts
```

### 覆盖率目标

- 单元测试: >80%
- 边界情况: 100%（空数据、单作者、极端值）
- 集成测试: 端到端流程验证

### 测试用例（每个模块 ≥5 个）

**团队健康度**：
1. 单作者项目 → Bus Factor=1, riskLevel=high
2. 多人协作 → Bus Factor>1, riskLevel=low
3. 空提交列表 → 返回空对象
4. 所有文件都多人协作 → knowledgeDistribution 接近 1
5. 混合独有+主导文件 → 正确计算知识评分

---

## 实施计划

### 时间线（15 工作日）

| 阶段 | 工期 | 任务 | 交付物 |
|------|------|------|--------|
| **Phase 1** | 2天 | 架构搭建 | 目录结构、类型定义、空模块 |
| **Phase 2** | 5天 | 核心功能实现 | 5个统计模块 + 单元测试 |
| **Phase 3** | 2天 | 集成与合并 | 主流程集成 + 多仓库合并 |
| **Phase 4** | 3天 | 前端报告 | HTML模板 + D3图表 |
| **Phase 5** | 2天 | 测试与优化 | 覆盖率>80% + 性能优化 |
| **Phase 6** | 1天 | 发布准备 | 文档 + CHANGELOG + npm |

### 每日节奏（Phase 2）

```
Day 3: 团队健康度
Day 4: 代码稳定性
Day 5: 工作压力
Day 6: 贡献者流失
Day 7: 文件协作热度

每天流程：
1. 编写测试用例（TDD）
2. 实现核心逻辑
3. 通过所有测试
4. Code Review（检查500行限制）
```

---

## 风险控制

### 风险矩阵

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 文件协作性能差 | 高 | 中 | ✅ 限制文件数 + 采样模式 |
| 多仓库合并复杂 | 中 | 中 | ✅ Map优化 + 充分测试 |
| 前端渲染慢 | 中 | 低 | ✅ 虚拟滚动 + 按需加载 |
| 代码膨胀 | 低 | 高 | ✅ 已缓解（独立模块） |
| 假期数据维护 | 低 | 中 | ✅ 硬编码近3年数据 |

### 质量检查清单

**代码质量**：
- [ ] 所有文件 <500 行
- [ ] 无 TypeScript `any` 类型
- [ ] 函数复杂度 <10
- [ ] 测试覆盖率 >80%

**功能验证**：
- [ ] 单仓库分析正确
- [ ] 多仓库合并正确
- [ ] 边界情况处理
- [ ] 前端图表渲染

**性能基准**：
- [ ] 10万提交 <30秒
- [ ] 报告生成 <5秒
- [ ] 前端渲染 <2秒

---

## 后续扩展

### v2.1（短期）
- 导出功能（JSON/CSV）
- 报告对比模式
- 自定义阈值配置

### v2.2（中期）
- 增量缓存系统
- `--advanced-only` 参数
- 多国假期支持

### v3.0（长期）
- 插件化架构
- 外部集成（Jira/GitHub）
- Web 服务模式

---

## 附录

### 技术债务处理

**现有问题**：
- `stats-calculator.ts` 已达 928 行

**解决方案**：
- 不直接修改该文件
- 新增 `advanced/` 模块独立实现
- 后续可重构 core 模块（可选）

### 依赖管理

**新增依赖**：无

**可选依赖**：
- `date-holidays`: 多国假期支持（暂不需要）

---

**文档结束**

审核人: _________
批准日期: 2026-02-10
