import type { CommitRecord, AdvancedCollaborationMetrics, FilePair, AuthorPair } from '../../types/index.js';

const MAX_FILES_PER_COMMIT = 50;

/**
 * 计算高级协作指标
 */
export function calculateAdvancedCollaboration(commits: CommitRecord[]): AdvancedCollaborationMetrics {
  if (commits.length === 0) {
    return emptyCollaboration();
  }

  // 统计文件修改次数
  const fileModifyCount = new Map<string, number>();
  for (const commit of commits) {
    commit.files.forEach(f => {
      fileModifyCount.set(f.path, (fileModifyCount.get(f.path) || 0) + 1);
    });
  }

  // Step 1: 检测紧密耦合 - 统计同提交文件对
  const tightCoupling = detectTightCoupling(commits, fileModifyCount);

  // Step 2: 检测结对编程
  const pairProgramming = detectPairProgramming(commits);

  // Step 3: 计算耦合评分
  const avgCoupling = tightCoupling.length > 0
    ? tightCoupling.reduce((sum, p) => sum + p.coupling, 0) / tightCoupling.length
    : 0;
  const couplingScore = Math.min(100, Math.round(avgCoupling * 100));

  return {
    tightCoupling,
    frequentPairs: [], // 简化版：跳过 24h 窗口分析
    pairProgramming,
    couplingScore,
  };
}

/**
 * 检测紧密耦合：统计同一提交中的文件对
 */
function detectTightCoupling(
  commits: CommitRecord[],
  fileModifyCount: Map<string, number>
): FilePair[] {
  const coCommitPairs = new Map<string, { count: number; file1: string; file2: string }>();

  for (const commit of commits) {
    // 性能优化：限制文件数，避免大型提交导致组合爆炸
    const files = commit.files
      .map(f => f.path)
      .slice(0, MAX_FILES_PER_COMMIT)
      .sort();

    // 组合文件对
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const pairKey = `${files[i]}|||${files[j]}`;
        const existing = coCommitPairs.get(pairKey) || {
          count: 0,
          file1: files[i],
          file2: files[j],
        };
        existing.count++;
        coCommitPairs.set(pairKey, existing);
      }
    }
  }

  // 计算耦合度并筛选
  const tightCoupling: FilePair[] = Array.from(coCommitPairs.values())
    .map(({ file1, file2, count }) => {
      const count1 = fileModifyCount.get(file1) || 1;
      const count2 = fileModifyCount.get(file2) || 1;
      const coupling = count / Math.min(count1, count2);

      return {
        file1,
        file2,
        coOccurrence: count,
        coupling,
      };
    })
    .filter(p => p.coOccurrence >= 3) // 至少共同出现 3 次
    .sort((a, b) => b.coupling - a.coupling)
    .slice(0, 20); // TOP 20

  return tightCoupling;
}

/**
 * 检测结对编程：找出在多个文件上协作的作者对
 */
function detectPairProgramming(commits: CommitRecord[]): AuthorPair[] {
  // 统计每个文件的作者贡献
  const fileAuthors = new Map<string, Map<string, number>>();

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!fileAuthors.has(file.path)) {
        fileAuthors.set(file.path, new Map());
      }
      const authorMap = fileAuthors.get(file.path)!;
      const email = commit.email.toLowerCase();
      authorMap.set(email, (authorMap.get(email) || 0) + 1);
    }
  }

  // 识别结对编程：两个作者都是文件的主要贡献者
  const authorPairMap = new Map<string, {
    author1: string;
    author2: string;
    files: Set<string>;
    count: number;
  }>();

  for (const [filePath, authorMap] of fileAuthors) {
    if (authorMap.size >= 2) {
      // 取贡献最多的两个作者
      const sortedAuthors = Array.from(authorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

      if (sortedAuthors.length === 2) {
        // 规范化作者对的键（按字母序）
        const [a1, a2] = [sortedAuthors[0][0], sortedAuthors[1][0]].sort();
        const pairKey = `${a1}|||${a2}`;

        const existing = authorPairMap.get(pairKey) || {
          author1: a1,
          author2: a2,
          files: new Set<string>(),
          count: 0,
        };

        existing.files.add(filePath);
        existing.count++;
        authorPairMap.set(pairKey, existing);
      }
    }
  }

  // 筛选并排序
  const pairProgramming: AuthorPair[] = Array.from(authorPairMap.values())
    .filter(p => p.files.size >= 3) // 至少 3 个共享文件
    .map(p => ({
      author1: p.author1,
      author2: p.author2,
      sharedFiles: Array.from(p.files),
      collaborationCount: p.count,
    }))
    .sort((a, b) => b.collaborationCount - a.collaborationCount)
    .slice(0, 10); // TOP 10

  return pairProgramming;
}

function emptyCollaboration(): AdvancedCollaborationMetrics {
  return {
    tightCoupling: [],
    frequentPairs: [],
    pairProgramming: [],
    couplingScore: 0,
  };
}
