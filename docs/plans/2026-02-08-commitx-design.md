# commitx - Git 提交统计工具设计文档

## 概述

commitx 是一个命令行工具，用于统计 Git 仓库的提交数据，生成可视化 HTML 报告。

**核心特性**：
- 递归扫描目录查找 Git 仓库
- 多仓库交互式选择
- 多维度统计分析
- 生成单文件 HTML 报告（Tailwind CSS + D3.js）
- 支持明暗主题切换

## 技术栈

- **语言**：TypeScript
- **运行环境**：Node.js
- **分发方式**：npm（支持全局安装和 npx）

## 核心架构

```
commitx/
├── src/
│   ├── cli/
│   │   └── index.ts              # 命令入口，参数解析
│   ├── scanner/
│   │   └── index.ts              # 递归扫描 .git 仓库
│   ├── analyzer/
│   │   ├── index.ts              # 分析入口
│   │   ├── git-log-parser.ts     # 解析 git log 输出
│   │   └── stats-calculator.ts   # 统计计算
│   ├── reporter/
│   │   ├── index.ts              # 报告生成入口
│   │   ├── html-builder.ts       # 拼装 HTML
│   │   └── charts.ts             # D3.js 图表配置
│   └── types/
│       └── index.ts              # 所有类型定义
├── templates/
│   └── report.html               # HTML 模板骨架
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

**数据流**：
1. CLI 解析参数
2. Scanner 递归查找 .git 仓库
3. 用户选择仓库（多仓库时）
4. Analyzer 拉取 git log 并统计
5. Reporter 生成 HTML
6. 自动打开浏览器

## Git 仓库扫描逻辑

### 扫描规则

- 从当前目录开始递归查找包含 `.git` 的目录
- **忽略列表**：`node_modules`、`.git`（内部）、`vendor`、`dist`、`build`
- 找到 `.git` 后不再往该目录深层继续（避免子模块重复）
- 递归深度超过 20 层时，暂停并提示用户确认是否继续

### 交互流程

```
$ commitx

扫描中... 找到 3 个 Git 仓库：

  ┌─────────────────────────────────────────┐
  │ ☐ /projects/frontend-app    (128 commits) │
  │ ☐ /projects/backend-api     (256 commits) │
  │ ☐ /projects/shared-utils    (64 commits)  │
  └─────────────────────────────────────────┘

  ↑/↓ 移动   空格 选择   a 全选   回车 确认

已选择 2 个仓库，时间范围：最近 3 个月
分析中...
```

单仓库时跳过选择，直接开始分析。

## 统计维度与数据结构

### 核心统计指标

```typescript
interface CommitStats {
  // 基础统计
  totalCommits: number;           // 总提交次数
  linesAdded: number;             // 新增行数
  linesDeleted: number;           // 删除行数
  filesChanged: number;           // 变更文件数

  // 时间维度
  firstCommitDate: Date;          // 最早提交
  lastCommitDate: Date;           // 最晚提交
  busiestDay: {                   // 最繁忙的一天
    date: string;
    count: number;
  };

  // 作者维度
  authors: Map<string, AuthorStats>;

  // 文件类型维度
  fileTypes: Map<string, FileTypeStats>;  // .ts -> { added: 100, deleted: 50 }

  // 目录维度
  directories: Map<string, DirectoryStats>;  // src/components -> { commits: 20, changes: 150 }

  // 时间分布
  hourlyDistribution: number[];    // 长度 24，每小时提交次数
  dailyHeatmap: Map<string, number>;  // 2024-01-15 -> 5 次提交
}
```

### Git 命令

- `git log --numstat --format="%H|%an|%ae|%aI|%s"` — 一次性获取所有需要的数据
- 过滤 `.gitignore` 中的文件：读取 `.gitignore`，匹配排除

## HTML 报告结构

### 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  commitx Report          [主题切换]   [时间: 最近3月]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ 128     │ │ +12,450 │ │ -3,200  │ │ 86      │           │
│  │ commits │ │ added   │ │ deleted │ │ files   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           提交热力图 (GitHub 风格)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ 提交时间分布 (24h)  │  │ 文件类型占比 (饼图) │            │
│  └────────────────────┘  └────────────────────┘            │
│                                                             │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ 作者贡献排行        │  │ 活跃目录 TOP 10     │            │
│  └────────────────────┘  └────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 技术实现

- 单个 HTML 文件，内联 Tailwind CSS (CDN) + D3.js (CDN)
- 数据通过 `<script>const DATA = {...}</script>` 内嵌
- 暗色/亮色主题通过 Tailwind `dark:` 类 + JS 切换按钮

## CLI 命令设计

### 基础用法

```bash
# 默认：当前目录，最近 3 个月
commitx

# 指定时间预设
commitx --period 7d      # 最近 7 天
commitx --period 1m      # 最近 1 个月
commitx --period 3m      # 最近 3 个月（默认）
commitx --period 6m      # 最近 6 个月
commitx --period 1y      # 最近 1 年

# 自定义时间范围
commitx --from 2024-01-01 --to 2024-06-30

# 指定目录
commitx /path/to/projects

# 指定作者过滤（只统计某人）
commitx --author "Alice"

# 输出文件名
commitx --output my-report.html

# 不自动打开浏览器
commitx --no-open
```

### 完整参数列表

| 参数 | 缩写 | 默认值 | 说明 |
|------|------|--------|------|
| `--period` | `-p` | `3m` | 时间预设 (7d/1m/3m/6m/1y) |
| `--from` | `-f` | - | 起始日期 (YYYY-MM-DD) |
| `--to` | `-t` | - | 结束日期 (YYYY-MM-DD) |
| `--author` | `-a` | - | 过滤作者 |
| `--output` | `-o` | `commitx-report.html` | 输出文件 |
| `--no-open` | - | `false` | 不打开浏览器 |
| `--depth` | `-d` | `20` | 最大扫描深度 |

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 当前目录无 Git 仓库 | 提示 "未找到 Git 仓库" 并退出 |
| 选定时间范围内无提交 | 生成空报告，提示 "该时间段无提交记录" |
| Git 未安装 | 检测失败时提示 "请先安装 Git" |
| 权限不足无法读取目录 | 跳过该目录，继续扫描其他 |
| 仓库损坏 (.git 不完整) | 跳过并警告，不中断整体流程 |
| 超大仓库 (10万+ commits) | 显示进度条，提示预计耗时 |
| 用户取消选择 (Ctrl+C) | 优雅退出，清理临时文件 |

### 进度反馈

```
$ commitx

扫描仓库... 找到 2 个
分析提交记录 [████████████░░░░░░░░] 60% (1,234 / 2,048 commits)
生成报告...
✓ 报告已生成: /projects/commitx-report.html
✓ 已在浏览器中打开
```

## 技术依赖

### 生产依赖

| 包名 | 用途 |
|------|------|
| `commander` | CLI 参数解析 |
| `inquirer` | 交互式多选菜单 |
| `simple-git` | Git 命令封装 |
| `open` | 跨平台打开浏览器 |
| `ora` | 终端加载动画/进度 |
| `chalk` | 终端彩色输出 |
| `ignore` | 解析 .gitignore 规则 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| `typescript` | TS 编译 |
| `tsup` | 打包构建 |
| `@types/node` | Node 类型 |
| `@types/inquirer` | inquirer 类型 |

### HTML 内联资源 (CDN)

- Tailwind CSS: `https://cdn.tailwindcss.com`
- D3.js: `https://d3js.org/d3.v7.min.js`

## package.json 关键配置

```json
{
  "name": "commitx",
  "version": "1.0.0",
  "bin": {
    "commitx": "./dist/cli/index.js"
  },
  "files": ["dist", "templates"],
  "type": "module"
}
```

## 构建产物

- `dist/` — 编译后的 JS 文件
- `bin/commitx` — CLI 入口脚本（指向 `dist/cli/index.js`）
