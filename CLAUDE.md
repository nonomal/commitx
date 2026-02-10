# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

commit-report - Git 提交统计 CLI 工具，递归扫描目录发现 Git 仓库，生成 D3.js 可视化 HTML 报告。

## Commands

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发模式（监听文件变化）
pnpm build            # 构建到 dist/
node dist/index.js    # 本地测试
```

## Architecture

数据流：CLI → Scanner → Analyzer → Reporter

```
src/
├── cli/              # 入口 + 命令行解析
│   ├── index.ts      # Commander.js 主程序，协调各模块
│   └── time-utils.ts # 时间范围解析 (7d/1m/3m/6m/1y)
├── scanner/          # 仓库发现
│   └── index.ts      # 递归扫描目录，检测 .git
├── analyzer/         # 统计分析
│   ├── index.ts      # 聚合多仓库数据
│   ├── git-log-parser.ts   # 解析 git log 输出
│   └── stats-calculator.ts # 计算统计指标
├── reporter/         # 报告生成
│   ├── index.ts      # 输出 HTML 并打开浏览器
│   └── html-builder.ts     # 模板渲染
└── types/            # 所有 TypeScript 类型定义
    └── index.ts
```

## Key Data Structures

- `CommitStats`: 核心统计结果（提交数、代码行数、作者、文件类型、时间分布）
- `RepoInfo`: 仓库元信息（路径、名称、提交数）
- `TimeRange`: 分析的时间范围

## Build

- tsup 打包，ESM 格式，目标 Node 18+
- 入口：`src/cli/index.ts` → `dist/index.js`
- 输出带 shebang，可直接执行
