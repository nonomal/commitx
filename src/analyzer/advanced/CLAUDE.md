[根目录](../../../CLAUDE.md) > [analyzer](../CLAUDE.md) > **advanced**

---

## 模块职责

Advanced 模块提供高级统计分析功能，超越基础的提交数、代码行数统计，深入分析团队协作健康度、代码稳定性、工作压力等维度。

**核心功能**:
- **团队健康度**: Bus Factor、知识集中度、关键作者识别
- **代码稳定性**: 文件流失率、目录流失率、回滚率、修复提交率
- **工作压力**: 深夜/凌晨/周末/节假日提交统计
- **贡献者流失**: 活跃/偶尔/休眠/流失/新加入作者分类
- **高级协作**: 文件耦合度、频繁配对文件、结对编程识别

**限制**: 仅在单仓库场景下有效，多仓库合并时这些字段为 `undefined`。

## 入口与启动

**主入口**: `src/analyzer/advanced/index.ts`

**导出函数**:
```typescript
function calculateAdvancedStats(commits: CommitRecord[]): AdvancedStats
```

**调用位置**: `src/analyzer/index.ts` 第 33 行

## 对外接口

### calculateAdvancedStats()

**参数**: `CommitRecord[]` - 原始提交记录数组

**返回值**:
```typescript
interface AdvancedStats {
  teamHealth: TeamHealthMetrics;
  stability: StabilityMetrics;
  workPressure: WorkPressureMetrics;
  contributorChurn: ContributorChurnMetrics;
  advancedCollaboration: AdvancedCollaborationMetrics;
}
```

### 子模块函数

每个子模块导出独立的计算函数：
- `calculateTeamHealth(commits)` - 团队健康度
- `calculateStability(commits)` - 代码稳定性
- `calculateWorkPressure(commits)` - 工作压力
- `calculateContributorChurn(commits)` - 贡献者流失
- `calculateAdvancedCollaboration(commits)` - 高级协作

## 关键依赖与配置

**依赖**: 无外部依赖，纯计算逻辑

**配置建议**:
- Bus Factor 阈值: 通常 < 3 为高风险
- 流失率阈值: > 0.5 表示代码不稳定
- 深夜时间: 22:00-06:00
- 休眠作者: > 90 天无提交
- 流失作者: > 180 天无提交

## 数据模型

**输入**: `CommitRecord[]`

**输出**: 5 个独立的指标对象

**计算流程**:
```
CommitRecord[] → 并行计算 5 个维度 → 合并为 AdvancedStats
```

## 测试与质量

**测试覆盖**: 无单元测试

**建议测试场景**:
- 单人项目（Bus Factor = 1）
- 大型团队项目（> 10 人）
- 高流失率项目（频繁重写）
- 加班严重项目（深夜提交多）
- 长期维护项目（贡献者流失）

## 常见问题 (FAQ)

**Q: 为什么多仓库场景下没有高级统计？**
A: 高级统计需要原始 CommitRecord[] 数据，多仓库合并后只有聚合统计，无法准确计算。见 `src/analyzer/stats-calculator.ts` 第 447-461 行注释。

**Q: Bus Factor 如何计算？**
A: 统计每个作者独占维护的文件数，Bus Factor = 独占文件数最多的前 N 人（N 使得覆盖 > 50% 文件）。

**Q: 如何判断"修复提交"？**
A: 通过 Commit Message 匹配 `fix`、`bugfix`、`hotfix` 等关键词。

**Q: 节假日数据从哪来？**
A: 需要在 `work-pressure.ts` 中硬编码或引入节假日 API。

## 相关文件清单

```
src/analyzer/advanced/
├── index.ts              # 入口，聚合所有高级统计（48 行）
├── team-health.ts        # 团队健康度计算
├── code-stability.ts     # 代码稳定性计算
├── work-pressure.ts      # 工作压力计算
├── contributor-churn.ts  # 贡献者流失计算
├── collaboration.ts      # 高级协作计算
└── .gitkeep              # 占位文件
```

**关键代码位置**:
- 主入口: `index.ts` 第 30-38 行
- 类型定义: `src/types/index.ts` 第 248-345 行

## 变更记录 (Changelog)

**2026-03-10 22:47:20** - 初始化模块文档
