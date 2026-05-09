[根目录](../../CLAUDE.md) > **reporter**

---

## 模块职责

Reporter 模块负责将统计结果渲染为交互式 HTML 报告，并可选地在浏览器中打开。

**核心功能**:
- 加载 HTML 模板壳、页面片段与脚本片段
- 将 `CommitStats` 序列化为 JSON（Date 对象转 ISO 字符串）
- 注入数据到模板（防 XSS）
- 写入文件系统
- 自动打开浏览器

## 入口与启动

**主入口**: `src/reporter/index.ts`

**导出函数**:
```typescript
async function generateReport(
  stats: CommitStats,
  options: ReportOptions
): Promise<void>
```

**调用位置**: `src/cli/index.ts` 第 102 行

## 对外接口

### generateReport()

**参数**:
```typescript
interface ReportOptions {
  outputPath: string;          // 输出文件路径
  autoOpen: boolean;           // 是否自动打开浏览器
  timeRange: TimeRange | null; // 时间范围（用于报告标题）
  repoNames: string[];         // 仓库名称列表
}
```

**返回值**: `Promise<void>`

**行为**:
1. 调用 `buildHtml()` 生成完整 HTML
2. 写入文件到 `outputPath`
3. 如果 `autoOpen = true`，调用 `open()` 打开浏览器

### buildHtml()

**参数**: `CommitStats` + `ReportOptions`

**返回值**: `Promise<string>` - 完整的 HTML 字符串

**内部逻辑**:
1. 加载模板壳、页面片段与脚本片段（支持开发模式和打包后模式）
2. 序列化 `CommitStats`（Date → ISO 字符串）
3. 构建 `ReportData` 对象
4. JSON 序列化并防 XSS（转义 `<`, `>`, `&`）
5. 替换模板中的 `__REPORT_DATA__`、`__REPORT_SECTIONS__`、`__REPORT_SCRIPT__` 占位符

## 关键依赖与配置

**依赖**:
- `open`: 打开浏览器
- `ora`: 进度指示器
- `chalk`: 终端颜色

**模板路径解析**:
```typescript
const possiblePaths = [
  resolve(currentDir, '../templates', fileName),      // 打包后
  resolve(currentDir, '../../templates', fileName),   // 开发模式
  resolve(currentDir, '../../../templates', fileName) // 备用
];
```

**安全措施**:
- JSON 序列化时转义 `<`, `>`, `&`（第 28-31 行）
- 防止 XSS 攻击

## 数据模型

**输入**: `CommitStats` + `ReportOptions`

**输出**: HTML 文件 + 浏览器打开（可选）

**中间数据结构**:
```typescript
interface ReportData {
  stats: CommitStats;          // 序列化后的统计数据
  generatedAt: string;         // 生成时间（本地化）
  timeRange: {                 // 时间范围（可选）
    from: string;
    to: string;
  } | null;
  repos: string[];             // 仓库名称列表
}
```

## 测试与质量

**测试覆盖**: 无单元测试

**手动测试场景**:
- 单仓库报告
- 多仓库报告
- 不同时间范围
- 自动打开 vs 手动打开
- 模板路径解析（开发模式 vs 打包后）

## 常见问题 (FAQ)

**Q: 为什么需要序列化 Date 对象？**
A: JSON.stringify() 会将 Date 转为字符串，但格式不统一。手动转为 ISO 字符串确保前端解析一致。

**Q: 如何自定义 HTML 模板？**
A: 修改 `templates/report.html`、`templates/report-sections/` 或 `templates/report-scripts/`，保留占位符。

**Q: 为什么有多个模板路径？**
A: 支持开发模式（src/）和打包后（dist/）两种目录结构。

**Q: 如何添加新的图表？**
A: 在 `templates/report-sections/` 添加容器，在 `templates/report-scripts/` 添加 D3.js 代码，数据从 `DATA.stats` 获取。

## 相关文件清单

```
src/reporter/
├── index.ts          # 主入口，生成报告并打开浏览器（34 行）
└── html-builder.ts   # HTML 构建与模板加载

templates/
├── report.html       # HTML 模板壳
├── report-sections/  # 页面主体片段
└── report-scripts/   # D3.js 与交互脚本片段
```

**关键代码位置**:
- 主流程: `index.ts`
- 模板加载: `html-builder.ts`
- 数据序列化: `html-builder.ts`
- XSS 防护: `html-builder.ts`

## 变更记录 (Changelog)

**2026-03-10 22:47:20** - 初始化模块文档
