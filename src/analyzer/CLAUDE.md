[根目录](../../CLAUDE.md) > **analyzer**

---

## 模块职责

Analyzer 模块是统计分析的核心，负责：
- 解析 Git 日志输出（`git log --numstat`）
- 计算基础统计指标（提交数、代码行数、作者分布等）
- 计算扩展统计（质量指标、时间模式、趋势、协作等）
- 调用高级统计模块（团队健康度、稳定性等）
- 合并多仓库统计结果

**核心算法**: 基于 `CommitRecord[]` 数组的单遍扫描 + Map 聚合

## 入口与启动

**主入口**: `src/analyzer/index.ts`

**导出函数**:
```typescript
async function analyzeRepos(options: AnalyzeOptions): Promise<CommitStats>
```

**调用示例**:
```typescript
import { analyzeRepos } from './analyzer/index.js';

const stats = await analyzeRepos({
  repos: [{ path: '/repo1', name: 'repo1', commitCount: 100 }],
  timeRange: { from: new Date('2025-01-01'), to: new Date() },
  author: '张三'
});
```

## 对外接口

### analyzeRepos()

**参数**:
```typescript
interface AnalyzeOptions {
  repos: RepoInfo[];           // 待分析的仓库列表
  timeRange: TimeRange | null; // 时间范围（null = 全部）
  author?: string;             // 作者过滤（可选）
}
```

**返回值**: `CommitStats` - 包含所有统计维度的完整对象

### parseGitLog()

**参数**:
```typescript
async function parseGitLog(
  repoPath: string,
  timeRange: TimeRange | null,
  author?: string
): Promise<CommitRecord[]>
```

**行为**:
- 通过参数化 Git CLI 调用执行 `git log --numstat`
- 应用 .gitignore 规则过滤文件
- 默认忽略 lock 文件（package-lock.json、pnpm-lock.yaml 等）
- 支持 100MB buffer（大型仓库）

### calculateStats()

**参数**: `CommitRecord[]`

**返回值**: `CommitStats`（不含高级统计字段）

**计算维度**:
- 基础统计：提交数、代码行数、文件数
- 作者维度：每位作者的提交数、代码行数、最后活跃时间
- 文件类型维度：按扩展名统计代码行数
- 目录维度：TOP 10 活跃目录
- 时间分布：24 小时分布、每日热力图、周几分布
- 质量指标：平均文件数/行数、流失率、热点文件
- 时间模式：周末占比、提交间隔、连续天数
- 趋势数据：周趋势、累计代码量
- 协作指标：单人维护文件、协作热点
- Commit Message 分析：类型分布、平均长度
- 作者文件类型贡献：TOP 20

### mergeStats()

**参数**: `CommitStats[]`

**返回值**: `CommitStats`（合并后的统计）

**注意**: 高级统计字段（teamHealth、stability 等）在多仓库场景下为 `undefined`，见第 447-461 行注释。

## 关键依赖与配置

**依赖**:
- `ignore`: .gitignore 规则解析
- `ora`: 进度指示器
- `chalk`: 终端颜色

**配置**:
- Git log buffer: 100MB（第 44 行）
- 热点文件阈值: TOP 10（第 553 行）
- 单人维护文件阈值: ≥3 commits（第 777 行）
- 协作热点阈值: ≥2 作者 && ≥5 commits（第 783 行）

## 数据模型

**核心数据结构**:
```typescript
CommitRecord → calculateStats() → CommitStats
                                   ├── 基础统计
                                   ├── 作者维度
                                   ├── 文件类型维度
                                   ├── 目录维度
                                   ├── 时间分布
                                   ├── 质量指标
                                   ├── 时间模式
                                   ├── 趋势数据
                                   ├── 协作指标
                                   ├── Commit Message 统计
                                   └── 作者文件类型贡献
```

**高级统计**（单仓库场景）:
```typescript
CommitRecord → calculateAdvancedStats() → AdvancedStats
                                          ├── teamHealth
                                          ├── stability
                                          ├── workPressure
                                          ├── contributorChurn
                                          └── advancedCollaboration
```

## 测试与质量

**测试覆盖**: `tests/commit-details.test.mjs` 覆盖提交明细与多仓库合并的关键路径

**已知问题**:
- 多仓库场景下高级统计缺失

**建议优化**:
1. 支持多仓库高级统计（需合并原始 CommitRecord[]）
2. 继续补充 Analyzer 单元测试，覆盖时间趋势、质量指标、AI 指标

## 常见问题 (FAQ)

**Q: 为什么多仓库场景下没有高级统计？**
A: 高级统计需要原始 CommitRecord[] 数据，mergeStats() 只有聚合后的统计数据，无法准确计算 busFactor、revertRate 等指标。

**Q: 如何添加新的统计维度？**
A:
1. 在 `src/types/index.ts` 中扩展 `CommitStats` 类型
2. 在 `stats-metrics.ts` 或对应统计模块中添加计算函数
3. 在 `calculateStats()` 中调用并返回

**Q: .gitignore 规则如何应用？**
A: 见 `git-log-parser.ts` 第 117-135 行，读取仓库的 .gitignore 并默认忽略 lock 文件。

**Q: 如何处理二进制文件？**
A: Git numstat 对二进制文件显示 `-`，解析时转为 0（第 92 行）。

## 相关文件清单

```
src/analyzer/
├── index.ts                  # 主入口，协调解析与计算（62 行）
├── git-log-parser.ts         # Git 日志解析（136 行）
├── stats-calculator.ts       # 统计入口与多仓库合并
├── stats-metrics.ts          # 扩展统计计算
├── stats-empty.ts            # 空统计对象工厂
├── stats-utils.ts            # 日期与路径工具
└── advanced/                 # 高级统计模块
    ├── index.ts              # 高级统计入口（48 行）
    ├── team-health.ts        # 团队健康度
    ├── code-stability.ts     # 代码稳定性
    ├── work-pressure.ts      # 工作压力
    ├── contributor-churn.ts  # 贡献者流失
    └── collaboration.ts      # 高级协作指标
```

**关键代码位置**:
- 主流程: `index.ts` 第 11-61 行
- Git 日志解析: `git-log-parser.ts` 第 16-56 行
- 统计计算: `stats-calculator.ts` 第 25-203 行
- 多仓库合并: `stats-calculator.ts` 第 208-463 行
- 高级统计调用: `index.ts` 第 33 行

## 变更记录 (Changelog)

**2026-03-10 22:47:20** - 初始化模块文档
