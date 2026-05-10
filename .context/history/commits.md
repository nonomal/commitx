# Commit Decision History

> 此文件是 `commits.jsonl` 的人类可读视图，可由工具重生成。
> Canonical store: `commits.jsonl` (JSONL, append-only)

| Date | Context-Id | Commit | Summary | Decisions | Bugs | Risk |
|------|------------|--------|---------|-----------|------|------|
| 2026-05-10T13:10:50+0800 | 29CC5483-294E-48DF-AB60-D68D315A4B66 |  | chore(context): 初始化项目上下文管理 | 创建 .context prefs 与 history 目录结构，用于记录后续提交决策；在 AGENTS.md 注入 .context 引用，统一项目上下文入口 |  | 低：仅新增上下文管理文件和文档引用 |
| 2026-05-10T13:11:42+0800 | 83BBB2FA-883C-4FDD-9D93-C3101C4701C4 |  | feat(analyzer): 增强 AI 使用分析可信度 | 新增 AIScoreEvaluation，以 score + reasons 同时支持兼容评分和报告解释；多仓库 AI 提交与目录统计注入 repoName，避免报告中失去仓库定位；目录 AI TOP 按 repo + dir 合并，解决不同仓库同名目录被混合的问题；AI × 质量风险建议保持前端派生，避免把展示建议固化进统计模型；在当前工作区实施，严格避开未跟踪 commit-report.html |  | 中低：涉及统计展示字段和模板渲染，已补充回归测试并完成构建验证 |
