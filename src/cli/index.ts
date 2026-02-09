import { Command } from 'commander';
import chalk from 'chalk';
import { checkbox } from '@inquirer/prompts';
import { scanRepositories } from '../scanner/index.js';
import { analyzeRepos } from '../analyzer/index.js';
import { generateReport } from '../reporter/index.js';
import { parsePeriod, resolveTimeRange } from './time-utils.js';
import type { CliOptions, RepoInfo } from '../types/index.js';

const program = new Command();

program
  .name('commitx')
  .description('Git 提交统计工具，生成可视化 HTML 报告')
  .version('1.0.0')
  .argument('[directory]', '要扫描的目录路径', process.cwd())
  .option('-p, --period <period>', '时间预设 (7d/1m/3m/6m/1y)', '1y')
  .option('-f, --from <date>', '起始日期 (YYYY-MM-DD)')
  .option('-t, --to <date>', '结束日期 (YYYY-MM-DD)')
  .option('-a, --author <name>', '过滤作者')
  .option('-o, --output <file>', '输出文件名', 'commitx-report.html')
  .option('--no-open', '不自动打开浏览器')
  .option('-d, --depth <number>', '最大扫描深度', '20')
  .action(async (directory: string, opts: CliOptions) => {
    try {
      await run(directory, opts);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_CANCEL') {
        console.log(chalk.yellow('\n已取消操作'));
        process.exit(0);
      }
      console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

async function run(directory: string, opts: CliOptions): Promise<void> {
  // 1. 检查 Git 是否安装
  await checkGitInstalled();

  // 2. 解析时间范围
  const timeRange = resolveTimeRange(opts);

  // 3. 扫描仓库
  const repos = await scanRepositories({
    targetDir: directory,
    maxDepth: Number(opts.depth),
  });

  if (repos.length === 0) {
    console.log(chalk.red('未找到 Git 仓库'));
    process.exit(1);
  }

  // 4. 选择仓库
  let selectedRepos: RepoInfo[];

  if (repos.length === 1) {
    selectedRepos = repos;
    console.log(chalk.cyan(`找到 1 个 Git 仓库: ${repos[0].name}`));
  } else {
    console.log(chalk.cyan(`\n找到 ${repos.length} 个 Git 仓库:\n`));

    const selected = await checkbox<string>({
      message: '选择要分析的仓库（空格选择，回车确认）',
      choices: repos.map((repo) => ({
        name: `${repo.name} (${repo.commitCount} commits)`,
        value: repo.path,
        checked: true,
      })),
    });

    if (selected.length === 0) {
      console.log(chalk.yellow('未选择任何仓库'));
      process.exit(0);
    }

    selectedRepos = repos.filter((r) => selected.includes(r.path));
  }

  console.log(
    chalk.gray(
      `\n已选择 ${selectedRepos.length} 个仓库，时间范围：${formatDate(timeRange.from)} ~ ${formatDate(timeRange.to)}\n`
    )
  );

  // 5. 分析提交记录
  const stats = await analyzeRepos({
    repos: selectedRepos,
    timeRange,
    author: opts.author,
  });

  if (stats.totalCommits === 0) {
    console.log(chalk.yellow('该时间段无提交记录'));
  }

  // 6. 生成报告
  await generateReport(stats, {
    outputPath: opts.output,
    autoOpen: opts.open,
    timeRange,
    repoNames: selectedRepos.map((r) => r.name),
  });
}

async function checkGitInstalled(): Promise<void> {
  const { execSync } = await import('child_process');
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.error(chalk.red('请先安装 Git'));
    process.exit(1);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n已取消操作'));
  process.exit(0);
});

program.parse();
