[根目录](../../CLAUDE.md) > **cli**

---

## 模块职责

CLI 模块是 commit-report 的命令行入口，负责：
- 解析用户输入的命令行参数（Commander.js）
- 验证 Git 环境
- 协调 Scanner、Analyzer、Reporter 三大模块的执行流程
- 提供交互式仓库选择（多仓库场景）
- 处理时间范围解析与验证

## 入口与启动

**主入口**: `src/cli/index.ts`

```bash
# 开发模式
pnpm dev

# 生产模式
node dist/index.js [directory] [options]
```

**执行流程**:
1. 检查 Git 是否安装
2. 解析时间范围（--period / --from / --to）
3. 调用 Scanner 扫描仓库
4. 交互式选择仓库（多仓库时）
5. 调用 Analyzer 分析提交记录
6. 调用 Reporter 生成 HTML 报告

## 对外接口

### 命令行参数

```typescript
interface CliOptions {
  period: string;        // 时间预设: 7d/1m/3m/6m/1y/all
  from?: string;         // 起始日期: YYYY-MM-DD
  to?: string;           // 结束日期: YYYY-MM-DD
  author?: string;       // 过滤作者
  output: string;        // 输出文件名（默认 commit-report.html）
  open: boolean;         // 是否自动打开浏览器
  depth: number;         // 最大扫描深度（默认 20）
}
```

### 导出函数

无导出函数，仅作为 CLI 入口执行。

## 关键依赖与配置

**依赖**:
- `commander`: CLI 框架
- `chalk`: 终端颜色输出
- `@inquirer/prompts`: 交互式选择（checkbox）

**配置**:
- 默认输出文件: `commit-report.html`
- 默认扫描深度: 20 层
- 默认时间范围: `all`（所有提交）

## 数据模型

**输入**: 命令行参数 + 目标目录路径

**输出**: 无返回值，通过副作用调用其他模块

**内部数据流**:
```
CliOptions → TimeRange → ScanOptions → RepoInfo[] → AnalyzeOptions → CommitStats → ReportOptions
```

## 测试与质量

**测试覆盖**: 无单元测试

**手动测试场景**:
- 无参数运行（使用默认值）
- 指定时间范围（--period 3m）
- 自定义日期范围（--from 2025-01-01 --to 2025-12-31）
- 作者过滤（--author "张三"）
- 深度限制（--depth 5）
- 多仓库选择交互

## 常见问题 (FAQ)

**Q: 为什么 --from / --to 优先于 --period？**
A: 自定义日期范围比预设更精确，见 `time-utils.ts` 第 56 行。

**Q: 如何支持新的时间预设格式？**
A: 修改 `time-utils.ts` 的 `PERIOD_REGEX` 和 `parsePeriod()` 函数。

**Q: 多仓库场景下如何自动全选？**
A: 见 `index.ts` 第 69 行，`checked: true` 默认全选。

## 相关文件清单

```
src/cli/
├── index.ts          # 主入口，协调各模块（131 行）
└── time-utils.ts     # 时间范围解析（74 行）
```

**关键代码位置**:
- 参数定义: `index.ts` 第 10-35 行
- 执行流程: `index.ts` 第 37-108 行
- Git 检查: `index.ts` 第 110-118 行
- 时间解析: `time-utils.ts` 第 10-73 行

## 变更记录 (Changelog)

**2026-03-10 22:47:20** - 初始化模块文档
