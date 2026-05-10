import type {
  AIQualityRiskFile,
  AIQualityRiskMetrics,
  AIQualityScatterPoint,
  ChangeSizeBucket,
  ChangeSizeDistribution,
  CommitRecord,
  DirectoryCouplingMetrics,
  DirectoryMatrixCell,
  DirectoryPair,
  LargeCommit,
} from '../types/index.js';
import { calculateAIScore } from './tech-debt/ai-detector.js';
import { getTopDirectory } from './stats-utils.js';

const MAX_FILES_PER_COMMIT_FOR_PAIRS = 80;
const MAX_DIRS_FOR_MATRIX = 12;

/**
 * #2 变更尺寸分布
 */
export function calculateChangeSizeDistribution(
  commits: CommitRecord[]
): ChangeSizeDistribution {
  if (commits.length === 0) {
    return {
      buckets: emptyBuckets(),
      avgChangeSize: 0,
      medianChangeSize: 0,
      p95ChangeSize: 0,
      largeCommits: [],
    };
  }

  const sizes: number[] = [];
  const commitInfo: LargeCommit[] = [];

  for (const commit of commits) {
    let total = 0;
    for (const f of commit.files) total += f.added + f.deleted;
    sizes.push(total);
    commitInfo.push({
      hash: commit.hash,
      author: commit.author,
      date: commit.date,
      message: commit.message,
      totalLines: total,
      filesCount: commit.files.length,
    });
  }

  // 分桶
  const counts = { XS: 0, S: 0, M: 0, L: 0, XL: 0 };
  for (const size of sizes) {
    if (size < 10) counts.XS++;
    else if (size < 50) counts.S++;
    else if (size < 200) counts.M++;
    else if (size < 1000) counts.L++;
    else counts.XL++;
  }

  const total = sizes.length;
  const buckets: ChangeSizeBucket[] = [
    { label: 'XS', range: '<10', count: counts.XS, percentage: pct(counts.XS, total) },
    { label: 'S', range: '10-49', count: counts.S, percentage: pct(counts.S, total) },
    { label: 'M', range: '50-199', count: counts.M, percentage: pct(counts.M, total) },
    { label: 'L', range: '200-999', count: counts.L, percentage: pct(counts.L, total) },
    { label: 'XL', range: '≥1000', count: counts.XL, percentage: pct(counts.XL, total) },
  ];

  const sorted = [...sizes].sort((a, b) => a - b);
  const avgChangeSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const medianChangeSize = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95ChangeSize = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

  const largeCommits = commitInfo
    .sort((a, b) => b.totalLines - a.totalLines)
    .slice(0, 20);

  return {
    buckets,
    avgChangeSize,
    medianChangeSize,
    p95ChangeSize,
    largeCommits,
  };
}

/**
 * #6 目录耦合（跨第一层目录共变）
 */
export function calculateDirectoryCoupling(
  commits: CommitRecord[]
): DirectoryCouplingMetrics {
  if (commits.length === 0) {
    return { pairs: [], matrix: [], directories: [] };
  }

  // 每个目录被改动的提交数
  const dirCommitCount = new Map<string, number>();
  // 跨目录共现次数
  const pairMap = new Map<string, { dir1: string; dir2: string; count: number }>();

  for (const commit of commits) {
    const files = commit.files.slice(0, MAX_FILES_PER_COMMIT_FOR_PAIRS);
    const dirs = new Set<string>();
    for (const f of files) dirs.add(getTopDirectory(f.path));

    const dirArr = Array.from(dirs).sort();
    for (const d of dirArr) {
      dirCommitCount.set(d, (dirCommitCount.get(d) || 0) + 1);
    }

    for (let i = 0; i < dirArr.length; i++) {
      for (let j = i + 1; j < dirArr.length; j++) {
        const key = `${dirArr[i]}|||${dirArr[j]}`;
        const existing = pairMap.get(key) || { dir1: dirArr[i], dir2: dirArr[j], count: 0 };
        existing.count++;
        pairMap.set(key, existing);
      }
    }
  }

  // 计算耦合度
  const pairs: DirectoryPair[] = Array.from(pairMap.values())
    .map(({ dir1, dir2, count }) => {
      const c1 = dirCommitCount.get(dir1) || 1;
      const c2 = dirCommitCount.get(dir2) || 1;
      const coupling = count / Math.min(c1, c2);
      return { dir1, dir2, coOccurrence: count, coupling };
    })
    .filter((p) => p.coOccurrence >= 2)
    .sort((a, b) => b.coupling - a.coupling)
    .slice(0, 30);

  // 矩阵：取活跃 TOP N 目录
  const topDirs = Array.from(dirCommitCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DIRS_FOR_MATRIX)
    .map(([d]) => d);

  const matrix: DirectoryMatrixCell[] = [];
  for (const d1 of topDirs) {
    for (const d2 of topDirs) {
      if (d1 === d2) {
        matrix.push({ dir1: d1, dir2: d2, value: dirCommitCount.get(d1) || 0 });
      } else {
        const key = d1 < d2 ? `${d1}|||${d2}` : `${d2}|||${d1}`;
        matrix.push({ dir1: d1, dir2: d2, value: pairMap.get(key)?.count || 0 });
      }
    }
  }

  return {
    pairs,
    matrix,
    directories: topDirs,
  };
}

/**
 * #18 AI × 质量交叉风险
 */
export function calculateAIQualityRisk(commits: CommitRecord[]): AIQualityRiskMetrics {
  if (commits.length === 0) {
    return {
      files: [],
      scatter: [],
      summary: { highAIHighChurn: 0, highAILowChurn: 0, lowAIHighChurn: 0, lowAILowChurn: 0 },
    };
  }

  // 文件级聚合：累计 AI 分数（加权）+ churn
  const fileMap = new Map<
    string,
    { added: number; deleted: number; modifyCount: number; weightedAI: number; weight: number }
  >();

  for (const commit of commits) {
    const aiScore = calculateAIScore(commit);
    for (const file of commit.files) {
      const lines = file.added + file.deleted;
      const entry = fileMap.get(file.path) || {
        added: 0,
        deleted: 0,
        modifyCount: 0,
        weightedAI: 0,
        weight: 0,
      };
      entry.added += file.added;
      entry.deleted += file.deleted;
      entry.modifyCount++;
      // 用 lines 作为权重，避免一次小修改主导分数
      const w = Math.max(lines, 1);
      entry.weightedAI += aiScore * w;
      entry.weight += w;
      fileMap.set(file.path, entry);
    }
  }

  const files: AIQualityRiskFile[] = [];
  const scatter: AIQualityScatterPoint[] = [];
  let highAIHighChurn = 0,
    highAILowChurn = 0,
    lowAIHighChurn = 0,
    lowAILowChurn = 0;

  for (const [path, data] of fileMap) {
    const avgAI = data.weight > 0 ? data.weightedAI / data.weight : 0;
    const churnRate = data.added > 0 ? data.deleted / data.added : 0;
    const totalLines = data.added + data.deleted;

    // 仅纳入有意义的文件（修改 ≥ 2 次或行数 ≥ 50）
    if (data.modifyCount < 2 && totalLines < 50) continue;

    // 综合风险：AI 占比 × churn × log(modifyCount)
    const riskScore =
      (avgAI / 100) * Math.min(churnRate, 2) * Math.log2(data.modifyCount + 1) * 50;

    files.push({
      path,
      aiScore: avgAI,
      churnRate,
      modifyCount: data.modifyCount,
      totalLines,
      riskScore,
    });

    scatter.push({ path, aiScore: avgAI, churnRate, modifyCount: data.modifyCount });

    const highAI = avgAI > 50;
    const highChurn = churnRate > 0.5;
    if (highAI && highChurn) highAIHighChurn++;
    else if (highAI) highAILowChurn++;
    else if (highChurn) lowAIHighChurn++;
    else lowAILowChurn++;
  }

  files.sort((a, b) => b.riskScore - a.riskScore);

  return {
    files: files.slice(0, 20),
    scatter: scatter.slice(0, 500), // 限制散点数
    summary: { highAIHighChurn, highAILowChurn, lowAIHighChurn, lowAILowChurn },
  };
}

function emptyBuckets(): ChangeSizeBucket[] {
  return [
    { label: 'XS', range: '<10', count: 0, percentage: 0 },
    { label: 'S', range: '10-49', count: 0, percentage: 0 },
    { label: 'M', range: '50-199', count: 0, percentage: 0 },
    { label: 'L', range: '200-999', count: 0, percentage: 0 },
    { label: 'XL', range: '≥1000', count: 0, percentage: 0 },
  ];
}

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}
