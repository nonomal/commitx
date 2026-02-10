import type { CommitRecord, StabilityMetrics, FileChurn, DirectoryChurn } from '../../types/index.js';

/**
 * 计算代码稳定性指标
 */
export function calculateStability(commits: CommitRecord[]): StabilityMetrics {
  if (commits.length === 0) {
    return emptyStability();
  }

  // Step 1: 统计文件级流失率
  const fileStats = new Map<string, { added: number; deleted: number; modifyCount: number }>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const stat = fileStats.get(file.path) || { added: 0, deleted: 0, modifyCount: 0 };
      stat.added += file.added;
      stat.deleted += file.deleted;
      stat.modifyCount++;
      fileStats.set(file.path, stat);
    }
  }

  // 转换为 FileChurn 数组，按流失率排序，取 TOP 20
  const fileChurnRate: FileChurn[] = Array.from(fileStats.entries())
    .map(([path, { added, deleted, modifyCount }]) => ({
      path,
      added,
      deleted,
      churnRate: added > 0 ? deleted / added : 0,
      modifyCount,
      isUnstable: deleted / Math.max(added, 1) > 0.5,
    }))
    .sort((a, b) => b.churnRate - a.churnRate)
    .slice(0, 20);

  // Step 2: 统计目录级流失率
  const dirStats = new Map<string, { added: number; deleted: number; files: Set<string> }>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const dir = getTopDirectory(file.path);
      const stat = dirStats.get(dir) || { added: 0, deleted: 0, files: new Set() };
      stat.added += file.added;
      stat.deleted += file.deleted;
      stat.files.add(file.path);
      dirStats.set(dir, stat);
    }
  }

  const directoryChurnRate: DirectoryChurn[] = Array.from(dirStats.entries())
    .map(([path, { added, deleted, files }]) => ({
      path,
      churnRate: added > 0 ? deleted / added : 0,
      totalChanges: added + deleted,
      fileCount: files.size,
    }))
    .sort((a, b) => b.churnRate - a.churnRate)
    .slice(0, 10);

  // Step 3: 计算 Revert 率
  const revertCommits = commits.filter((c) => /revert|rollback/i.test(c.message)).length;
  const revertRate = revertCommits / commits.length;

  // Step 4: 计算 Fix 提交率
  const fixCommits = commits.filter((c) => /^fix(\(.+\))?:/i.test(c.message)).length;
  const fixCommitRate = fixCommits / commits.length;

  // Step 5: 计算稳定性评分
  const avgChurnRate =
    fileChurnRate.length > 0
      ? fileChurnRate.reduce((sum, f) => sum + f.churnRate, 0) / fileChurnRate.length
      : 0;

  const stabilityScore = Math.max(
    0,
    Math.round(100 - (avgChurnRate * 50 + revertRate * 100 + fixCommitRate * 50))
  );

  return {
    fileChurnRate,
    directoryChurnRate,
    revertRate: Math.round(revertRate * 100) / 100,
    fixCommitRate: Math.round(fixCommitRate * 100) / 100,
    stabilityScore,
  };
}

/**
 * 获取文件路径的第一层目录
 */
function getTopDirectory(filePath: string): string {
  const parts = filePath.split('/');
  return parts.length > 1 ? parts[0] : '(根目录)';
}

function emptyStability(): StabilityMetrics {
  return {
    fileChurnRate: [],
    directoryChurnRate: [],
    revertRate: 0,
    fixCommitRate: 0,
    stabilityScore: 100,
  };
}
