[根目录](../../CLAUDE.md) > **scanner**

---

## 模块职责

Scanner 模块负责递归扫描指定目录，发现所有 Git 仓库（包含 `.git` 目录），并返回仓库基本信息。

**核心功能**:
- 递归目录遍历（深度可控）
- 检测 `.git` 目录
- 获取仓库提交数（`git rev-list --count HEAD`）
- 智能跳过常见忽略目录（node_modules、dist 等）
- 深度超限时交互式确认

## 入口与启动

**主入口**: `src/scanner/index.ts`

**导出函数**:
```typescript
async function scanRepositories(options: ScanOptions): Promise<RepoInfo[]>
```

**调用示例**:
```typescript
import { scanRepositories } from './scanner/index.js';

const repos = await scanRepositories({
  targetDir: '/path/to/projects',
  maxDepth: 20
});
```

## 对外接口

### scanRepositories()

**参数**:
```typescript
interface ScanOptions {
  targetDir: string;   // 扫描起始目录
  maxDepth: number;    // 最大递归深度
}
```

**返回值**:
```typescript
interface RepoInfo {
  path: string;        // 仓库绝对路径
  name: string;        // 仓库名称（目录名）
  commitCount: number; // 提交总数
}
```

**行为**:
- 找到 `.git` 后不再深入（避免子模块重复）
- 深度超限时弹出确认提示
- 权限不足时静默跳过
- 使用 ora spinner 显示进度

## 关键依赖与配置

**依赖**:
- `ora`: 进度指示器
- `chalk`: 终端颜色
- `@inquirer/prompts`: 深度确认提示

**忽略目录** (第 10-21 行):
```typescript
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build',
  '.cache', '.next', '.nuxt', '__pycache__', 'target'
]);
```

**配置建议**:
- 默认深度 20 层适合大多数场景
- 扫描大型 monorepo 时建议设置 `--depth 10`

## 数据模型

**输入**: `ScanOptions`

**输出**: `RepoInfo[]`

**内部逻辑**:
1. 检查当前目录是否有 `.git`
2. 有 → 调用 `getRepoInfo()` 获取信息，停止深入
3. 无 → 递归扫描子目录（跳过忽略列表）
4. 深度超限 → 提示用户确认

## 测试与质量

**测试覆盖**: 无单元测试

**手动测试场景**:
- 单仓库目录
- 多仓库 monorepo
- 嵌套仓库（Git 子模块）
- 深度限制触发
- 权限不足目录
- 空目录 / 无 Git 仓库

## 常见问题 (FAQ)

**Q: 为什么找到 `.git` 后不再深入？**
A: 避免 Git 子模块被重复统计，见第 58-59 行注释。

**Q: 如何添加新的忽略目录？**
A: 修改 `IGNORE_DIRS` Set（第 10 行）。

**Q: 深度确认只提示一次吗？**
A: 是的，`deepScanConfirmed` 标志确保只提示一次（第 29 行）。

**Q: 为什么使用 `execSync` 而不是 `simple-git`？**
A: 轻量级操作，避免引入额外依赖开销。

## 相关文件清单

```
src/scanner/
└── index.ts          # 唯一文件，包含所有扫描逻辑（115 行）
```

**关键代码位置**:
- 主扫描函数: 第 26-89 行
- 递归逻辑: 第 31-78 行
- 仓库信息获取: 第 94-114 行
- 忽略目录配置: 第 10-21 行

## 变更记录 (Changelog)

**2026-03-10 22:47:20** - 初始化模块文档
