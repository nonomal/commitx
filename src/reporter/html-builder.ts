import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommitStats, ReportOptions, ReportData } from '../types/index.js';

type JsonReportData = Omit<ReportData, 'stats'> & {
  stats: Record<string, unknown>;
};

const REPORT_SCRIPT_FILES = [
  'report-scripts/01-core.html',
  'report-scripts/02-commit-details.html',
  'report-scripts/03-basic-charts.html',
  'report-scripts/04-trend-charts.html',
  'report-scripts/05-tables-team-stability.html',
  'report-scripts/06-pressure-churn.html',
  'report-scripts/07-collab-debt-ai.html',
];

const REPORT_SECTION_FILES = [
  'report-sections/01-overview.html',
  'report-sections/02-advanced.html',
];

/**
 * 组装完整的 HTML 报告
 */
export async function buildHtml(
  stats: CommitStats,
  options: ReportOptions
): Promise<string> {
  const template = await loadTemplateFile('report.html');
  const reportSections = await loadTemplateParts(REPORT_SECTION_FILES);
  const reportScript = await loadReportScript();

  const reportData: JsonReportData = {
    stats: serializeStats(stats),
    generatedAt: new Date().toLocaleString('zh-CN'),
    timeRange: options.timeRange
      ? {
          from: options.timeRange.from.toISOString().split('T')[0],
          to: options.timeRange.to.toISOString().split('T')[0],
        }
      : null,
    repos: options.repoNames,
  };

  // 安全地序列化数据（防止 XSS）
  const jsonData = JSON.stringify(reportData)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return template
    .replace('__REPORT_DATA__', jsonData)
    .replace('__REPORT_SECTIONS__', reportSections)
    .replace('__REPORT_SCRIPT__', reportScript);
}

/**
 * 将 CommitStats 转为可 JSON 序列化的格式
 * Date 对象转为 ISO 字符串
 */
function serializeStats(stats: CommitStats): Record<string, unknown> {
  const serializeAuthorDetail = <T extends { lastCommitDate: Date }>(author: T) => ({
    ...author,
    lastCommitDate: author.lastCommitDate.toISOString(),
  });

  return {
    ...stats,
    firstCommitDate: stats.firstCommitDate.toISOString(),
    lastCommitDate: stats.lastCommitDate.toISOString(),
    authors: stats.authors.map((a) => ({
      ...a,
      lastActiveDate: a.lastActiveDate.toISOString(),
    })),
    commitDetails: stats.commitDetails.map((commit) => ({
      ...commit,
      date: commit.date.toISOString(),
    })),
    contributorChurn: stats.contributorChurn
      ? {
          ...stats.contributorChurn,
          active: stats.contributorChurn.active.map(serializeAuthorDetail),
          occasional: stats.contributorChurn.occasional.map(serializeAuthorDetail),
          dormant: stats.contributorChurn.dormant.map(serializeAuthorDetail),
          lost: stats.contributorChurn.lost.map(serializeAuthorDetail),
          newJoiners: stats.contributorChurn.newJoiners.map(serializeAuthorDetail),
        }
      : undefined,
  };
}

async function loadReportScript(): Promise<string> {
  return loadTemplateParts(REPORT_SCRIPT_FILES);
}

async function loadTemplateParts(fileNames: string[]): Promise<string> {
  const parts = await Promise.all(
    fileNames.map((fileName) => loadTemplateFile(fileName))
  );

  return parts.join('\n');
}

/**
 * 加载 HTML 模板
 */
async function loadTemplateFile(fileName: string): Promise<string> {
  // 支持两种路径：开发模式和打包后模式
  const currentDir = dirname(fileURLToPath(import.meta.url));

  // 打包后: dist/index.js -> ../templates
  // 开发模式: src/reporter/html-builder.ts -> ../../templates
  const possiblePaths = [
    resolve(currentDir, '../templates', fileName),
    resolve(currentDir, '../../templates', fileName),
    resolve(currentDir, '../../../templates', fileName),
  ];

  for (const templatePath of possiblePaths) {
    try {
      return await readFile(templatePath, 'utf-8');
    } catch {
      // 继续尝试下一个路径
    }
  }

  throw new Error(`无法找到 HTML 模板文件: ${fileName}`);
}
