import { readdir, stat, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import type { ScanOptions, RepoInfo } from '../types/index.js';

/** 扫描时忽略的目录名 */
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'vendor',
  'dist',
  'build',
  '.cache',
  '.next',
  '.nuxt',
  '__pycache__',
  'target',
]);

/**
 * 递归扫描目录，查找所有 Git 仓库
 */
export async function scanRepositories(options: ScanOptions): Promise<RepoInfo[]> {
  const spinner = ora('扫描仓库中...').start();
  const repos: RepoInfo[] = [];
  let deepScanConfirmed = false;

  async function scan(dir: string, depth: number): Promise<void> {
    // 深度超过限制时，提示用户确认
    if (depth > options.maxDepth && !deepScanConfirmed) {
      spinner.stop();
      const shouldContinue = await confirm({
        message: `扫描深度已超过 ${options.maxDepth} 层，是否继续？`,
        default: false,
      });

      if (!shouldContinue) {
        return;
      }
      deepScanConfirmed = true;
      spinner.start('继续扫描中...');
    }

    // 检查当前目录是否有 .git
    try {
      const gitDir = join(dir, '.git');
      await access(gitDir);

      // 找到 .git，获取仓库信息
      const repoInfo = getRepoInfo(dir);
      if (repoInfo) {
        repos.push(repoInfo);
        spinner.text = `扫描仓库中... 已找到 ${repos.length} 个`;
      }
      // 找到 .git 后不再深层继续（避免子模块重复）
      return;
    } catch {
      // 没有 .git，继续扫描子目录
    }

    // 递归扫描子目录
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.git') continue;

        await scan(join(dir, entry.name), depth + 1);
      }
    } catch {
      // 权限不足时跳过
    }
  }

  await scan(options.targetDir, 0);

  if (repos.length > 0) {
    spinner.succeed(`找到 ${repos.length} 个 Git 仓库`);
  } else {
    spinner.fail('未找到 Git 仓库');
  }

  return repos;
}

/**
 * 获取单个仓库的基本信息
 */
function getRepoInfo(repoPath: string): RepoInfo | null {
  try {
    const countStr = execSync('git rev-list --count HEAD', {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8',
    }).trim();

    const commitCount = parseInt(countStr, 10) || 0;
    const name = basename(repoPath);

    return {
      path: repoPath,
      name,
      commitCount,
    };
  } catch {
    // 仓库可能损坏或为空
    return null;
  }
}
