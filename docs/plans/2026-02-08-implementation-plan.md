# commitx 分步实现计划

> 基于 `2026-02-08-commitx-design.md` 设计文档，拆分为 8 个开发阶段，共 25 个任务。

---

## 阶段 1：项目初始化与基础设施 (Phase 1)

**目标**：搭建项目骨架、配置工具链、定义所有类型。

### 任务 1.1：初始化项目结构

- 创建 `package.json`（name: commitx, type: module, bin 配置）
- 创建 `.gitignore`（node_modules, dist, *.html 报告文件）
- 初始化 Git 仓库

### 任务 1.2：配置 TypeScript + tsup 构建

- 创建 `tsconfig.json`（target: ES2022, module: ESNext, strict 模式）
- 创建 `tsup.config.ts`（入口 src/cli/index.ts, format: esm）
- 安装开发依赖：`typescript`, `tsup`, `@types/node`

### 任务 1.3：安装生产依赖

```bash
pnpm add commander inquirer simple-git open ora chalk ignore
pnpm add -D @types/inquirer
```

### 任务 1.4：定义类型系统 (`src/types/index.ts`)

定义所有核心类型：

```typescript
// 需要定义的类型：
interface CommitRecord       // 单条提交记录
interface AuthorStats        // 作者统计
interface FileTypeStats      // 文件类型统计
interface DirectoryStats     // 目录统计
interface CommitStats        // 核心统计指标（设计文档中定义的完整结构）
interface RepoInfo           // 仓库信息（路径、名称、提交数）
interface CliOptions         // CLI 参数类型
interface ScanOptions        // 扫描配置
interface AnalyzeOptions     // 分析配置
interface ReportOptions      // 报告配置
interface ReportData         // 传递给 HTML 模板的完整数据
```

**验收标准**：`pnpm build` 可以成功编译（即使只有空的入口文件）。

---

## 阶段 2：CLI 入口与参数解析 (Phase 2)

**目标**：完成命令行参数解析，能正确识别所有选项。

### 任务 2.1：创建 CLI 入口 (`src/cli/index.ts`)

- 使用 `commander` 定义所有参数：
  - `--period / -p`：时间预设 (7d/1m/3m/6m/1y)，默认 3m
  - `--from / -f`：起始日期
  - `--to / -t`：结束日期
  - `--author / -a`：过滤作者
  - `--output / -o`：输出文件名，默认 `commitx-report.html`
  - `--no-open`：不打开浏览器
  - `--depth / -d`：最大扫描深度，默认 20
- 位置参数：目标目录（默认当前目录）
- 添加 `#!/usr/bin/env node` shebang

### 任务 2.2：时间范围计算工具函数

- 实现 `parsePeriod(period: string): { from: Date; to: Date }` 函数
- 支持 `7d`, `1m`, `3m`, `6m`, `1y` 格式
- 支持 `--from` / `--to` 自定义日期范围覆盖
- 验证日期格式和逻辑（from < to）

**验收标准**：运行 `commitx --help` 正确显示所有参数说明。

---

## 阶段 3：Git 仓库扫描器 (Phase 3)

**目标**：递归扫描目录，找到所有 Git 仓库。

### 任务 3.1：实现仓库扫描逻辑 (`src/scanner/index.ts`)

- 递归遍历目录，查找包含 `.git` 的目录
- 忽略列表：`node_modules`, `.git`（内部）, `vendor`, `dist`, `build`
- 找到 `.git` 后停止向该目录深层继续（避免子模块重复）
- 支持最大深度参数（默认 20），超过时暂停提示用户
- 权限不足时跳过目录，输出警告但不中断

### 任务 3.2：获取仓库基本信息

- 对每个找到的仓库，快速获取提交总数（`git rev-list --count HEAD`）
- 获取仓库名称（目录名 or remote origin）
- 返回 `RepoInfo[]` 数组

**验收标准**：在包含多个 Git 仓库的目录运行，能正确列出所有仓库及其提交数。

---

## 阶段 4：交互式仓库选择 (Phase 4)

**目标**：多仓库时提供交互式多选界面。

### 任务 4.1：实现仓库选择交互 (`src/cli/index.ts` 内集成)

- 使用 `inquirer` 的 checkbox 类型实现多选
- 显示仓库路径和提交数
- 单仓库时自动跳过选择，直接进入分析
- 无仓库时友好提示 "未找到 Git 仓库" 并退出
- 支持 Ctrl+C 优雅退出

**验收标准**：多仓库场景下出现多选菜单，单仓库时直接跳过。

---

## 阶段 5：Git 日志分析器 (Phase 5)

**目标**：解析 git log 输出，计算所有统计维度。

### 任务 5.1：实现 Git 日志解析器 (`src/analyzer/git-log-parser.ts`)

- 执行 `git log --numstat --format="%H|%an|%ae|%aI|%s"`
- 解析每条提交记录为 `CommitRecord` 对象
- 支持时间范围过滤（`--since`, `--until`）
- 支持作者过滤（`--author`）
- 读取并应用 `.gitignore` 规则过滤文件

### 任务 5.2：实现统计计算器 (`src/analyzer/stats-calculator.ts`)

基于解析后的 `CommitRecord[]`，计算：

- **基础统计**：总提交数、新增行数、删除行数、变更文件数
- **时间维度**：最早/最晚提交日期、最繁忙的一天
- **作者维度**：每个作者的提交数、新增/删除行数、最近活跃时间
- **文件类型维度**：按文件扩展名分组统计（.ts, .js, .css 等）
- **目录维度**：按顶层目录分组统计提交数和变更行数
- **时间分布**：24 小时每小时提交次数数组
- **热力图数据**：每日提交次数 Map

### 任务 5.3：分析入口编排 (`src/analyzer/index.ts`)

- 对选定的每个仓库调用解析和统计
- 多仓库时合并统计结果
- 显示进度条（ora）：`分析提交记录 [████░░░░] 60%`
- 超大仓库（10万+ commits）时显示预计耗时提示

**验收标准**：对真实仓库运行分析，输出完整的 `CommitStats` 对象，数据正确。

---

## 阶段 6：HTML 报告生成器 (Phase 6)

**目标**：生成包含所有图表的单文件 HTML 报告。

### 任务 6.1：创建 HTML 模板骨架 (`templates/report.html`)

- 单文件 HTML，内联引用 Tailwind CSS CDN + D3.js CDN
- 页面结构：
  - Header：标题 + 主题切换按钮 + 时间范围显示
  - Summary Cards：4 个卡片（提交数、新增行、删除行、文件数）
  - Charts Area：热力图 + 时间分布 + 文件类型 + 作者排行 + 目录排行
  - Footer：生成时间
- 支持明暗主题（Tailwind `dark:` 类 + JS 切换）
- 数据占位符：`<script>const DATA = __REPORT_DATA__;</script>`

### 任务 6.2：实现 D3.js 图表配置 (`src/reporter/charts.ts`)

生成内联的 D3.js 图表代码（字符串）：

| 图表 | 类型 | 数据源 |
|------|------|--------|
| 提交热力图 | GitHub 风格日历热力图 | `dailyHeatmap` |
| 提交时间分布 | 24 小时柱状图 | `hourlyDistribution` |
| 文件类型占比 | 甜甜圈/饼图 | `fileTypes` |
| 作者贡献排行 | 横向柱状图 | `authors` |
| 活跃目录 TOP 10 | 横向柱状图 | `directories` |

- 每个图表需要同时支持亮色和暗色主题的颜色方案
- 图表需要自适应容器宽度（responsive）

### 任务 6.3：实现 HTML 组装器 (`src/reporter/html-builder.ts`)

- 读取 `templates/report.html` 模板
- 将 `CommitStats` 序列化为 JSON，替换 `__REPORT_DATA__` 占位符
- 将图表初始化代码注入 HTML
- 处理特殊字符转义（防止 XSS）

### 任务 6.4：报告生成入口 (`src/reporter/index.ts`)

- 组装完整 HTML 并写入文件
- 使用 `open` 库自动打开浏览器（除非 `--no-open`）
- 输出生成结果路径

**验收标准**：生成的 HTML 文件在浏览器中正确展示所有图表，暗色/亮色切换正常。

---

## 阶段 7：错误处理与体验优化 (Phase 7)

**目标**：完善错误处理和用户体验。

### 任务 7.1：全局错误处理

按设计文档覆盖所有错误场景：

| 场景 | 处理 |
|------|------|
| 当前目录无 Git 仓库 | chalk 红色提示 "未找到 Git 仓库" 并 exit(1) |
| 选定时间范围内无提交 | 生成空报告，提示 "该时间段无提交记录" |
| Git 未安装 | 检测 `git --version` 失败时提示 "请先安装 Git" |
| 权限不足 | 跳过该目录，chalk 黄色警告 |
| 仓库损坏 | 跳过并警告，不中断整体流程 |
| 用户取消 (Ctrl+C) | 优雅退出，清理临时状态 |

### 任务 7.2：进度反馈优化

- 扫描阶段：`ora` spinner 显示 "扫描中..."
- 分析阶段：显示进度百分比和当前处理的仓库名
- 生成阶段：spinner 显示 "生成报告..."
- 完成阶段：chalk 绿色输出成功信息和文件路径

**验收标准**：各种异常场景不会导致程序崩溃，都有友好的错误提示。

---

## 阶段 8：构建、测试与发布准备 (Phase 8)

**目标**：确保项目可构建、可发布。

### 任务 8.1：完善构建配置

- 确认 `tsup` 构建产物正确（ESM 格式）
- 确认 `bin` 入口可执行
- 确认 `templates/` 目录包含在 npm 发布文件中
- 添加构建脚本：`"build": "tsup"`, `"dev": "tsup --watch"`

### 任务 8.2：编写 README.md

- 项目简介与截图占位
- 安装方式（npm / npx）
- 使用示例
- 参数说明表格
- 开发指南

### 任务 8.3：本地端到端测试

- 在真实的多仓库目录测试完整流程
- 验证所有参数组合
- 验证生成的 HTML 报告显示正确
- 验证 `npx` 方式可用

**验收标准**：`pnpm build && npx . /path/to/repos` 完整流程正常运行。

---

## 开发顺序与依赖关系

```
Phase 1 (项目初始化)
  │
  ├── Phase 2 (CLI 入口)
  │     │
  │     ├── Phase 3 (仓库扫描)
  │     │     │
  │     │     └── Phase 4 (交互选择)
  │     │
  │     └── Phase 5 (日志分析)
  │
  └── Phase 6 (HTML 报告) ← 依赖 Phase 5 的类型定义
        │
        └── Phase 7 (错误处理) ← 集成所有模块
              │
              └── Phase 8 (构建发布)
```

## 预估工作量

| 阶段 | 预估时间 | 核心产出 |
|------|----------|----------|
| Phase 1 | 30 min | 项目骨架 + 类型定义 |
| Phase 2 | 30 min | CLI 参数解析 |
| Phase 3 | 45 min | 仓库扫描器 |
| Phase 4 | 30 min | 交互式选择 |
| Phase 5 | 90 min | Git 日志解析 + 统计计算 |
| Phase 6 | 120 min | HTML 报告 + 5 个图表 |
| Phase 7 | 45 min | 错误处理 + 进度优化 |
| Phase 8 | 30 min | 构建配置 + README |
| **总计** | **~7 小时** | **完整可用的 commitx 工具** |

---

## 快速启动命令

```bash
# 一键创建目录结构
mkdir -p src/{cli,scanner,analyzer,reporter,types} templates

# 安装依赖
pnpm add commander inquirer simple-git open ora chalk ignore
pnpm add -D typescript tsup @types/node @types/inquirer
```
