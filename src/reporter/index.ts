import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { buildHtml } from './html-builder.js';
import type { CommitStats, ReportOptions } from '../types/index.js';

/**
 * 生成 HTML 报告并可选地打开浏览器
 */
export async function generateReport(
  stats: CommitStats,
  options: ReportOptions
): Promise<void> {
  const spinner = ora('生成报告...').start();

  try {
    const html = await buildHtml(stats, options);
    const outputPath = resolve(process.cwd(), options.outputPath);

    await writeFile(outputPath, html, 'utf-8');
    spinner.succeed(`报告已生成: ${chalk.cyan(outputPath)}`);

    if (options.autoOpen) {
      await open(outputPath);
      console.log(chalk.green('✓ 已在浏览器中打开'));
    }
  } catch (error) {
    spinner.fail('生成报告失败');
    throw error;
  }
}
