import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommitStats, ReportOptions, ReportData } from '../types/index.js';

/**
 * 组装完整的 HTML 报告
 */
export async function buildHtml(
  stats: CommitStats,
  options: ReportOptions
): Promise<string> {
  const template = await loadTemplate();

  const reportData: ReportData = {
    stats: serializeStats(stats),
    generatedAt: new Date().toLocaleString('zh-CN'),
    timeRange: {
      from: options.timeRange.from.toISOString().split('T')[0],
      to: options.timeRange.to.toISOString().split('T')[0],
    },
    repos: options.repoNames,
  };

  // 安全地序列化数据（防止 XSS）
  const jsonData = JSON.stringify(reportData)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return template.replace('__REPORT_DATA__', jsonData);
}

/**
 * 将 CommitStats 转为可 JSON 序列化的格式
 * Date 对象转为 ISO 字符串
 */
function serializeStats(stats: CommitStats): Record<string, unknown> {
  return {
    ...stats,
    firstCommitDate: stats.firstCommitDate.toISOString(),
    lastCommitDate: stats.lastCommitDate.toISOString(),
    authors: stats.authors.map((a) => ({
      ...a,
      lastActiveDate: a.lastActiveDate.toISOString(),
    })),
  };
}

/**
 * 加载 HTML 模板
 */
async function loadTemplate(): Promise<string> {
  // 支持两种路径：开发模式和打包后模式
  const currentDir = dirname(fileURLToPath(import.meta.url));

  // 打包后: dist/index.js -> ../templates/report.html
  // 开发模式: src/reporter/html-builder.ts -> ../../templates/report.html
  const possiblePaths = [
    resolve(currentDir, '../templates/report.html'),
    resolve(currentDir, '../../templates/report.html'),
    resolve(currentDir, '../../../templates/report.html'),
  ];

  for (const templatePath of possiblePaths) {
    try {
      return await readFile(templatePath, 'utf-8');
    } catch {
      // 继续尝试下一个路径
    }
  }

  throw new Error('无法找到 HTML 模板文件');
}
