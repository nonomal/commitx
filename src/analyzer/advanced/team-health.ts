import type { CommitRecord, TeamHealthMetrics, CriticalAuthor } from '../../types/index.js';

/**
 * 计算团队健康度指标
 */
export function calculateTeamHealth(commits: CommitRecord[]): TeamHealthMetrics {
  // 边界情况：空提交
  if (commits.length === 0) {
    return emptyTeamHealth();
  }

  // Step 1: 构建数据结构
  const authorFiles = buildAuthorFilesMap(commits);
  const fileAuthors = buildFileAuthorsMap(commits);

  // 边界情况：无文件变更
  if (fileAuthors.size === 0) {
    return emptyTeamHealth();
  }

  // Step 2: 计算每个作者的知识独占度
  const authorScores = calculateAuthorScores(authorFiles, fileAuthors);

  // Step 3: 筛选关键人员（评分 >10）
  const criticalAuthors = authorScores.filter((a) => a.knowledgeScore > 10);

  // Step 4: 计算知识分布均匀度
  const totalUniqueFiles = criticalAuthors.reduce(
    (sum, a) => sum + a.uniqueFiles.length,
    0
  );
  const knowledgeDistribution = 1 - totalUniqueFiles / fileAuthors.size;

  // Step 5: 评估风险等级
  const busFactor = criticalAuthors.length;
  const riskLevel = busFactor === 1 ? 'high' : busFactor <= 3 ? 'medium' : 'low';

  return {
    busFactor,
    criticalAuthors,
    knowledgeDistribution,
    riskLevel,
  };
}

/**
 * 构建 作者 -> 文件集合 映射
 */
function buildAuthorFilesMap(commits: CommitRecord[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const commit of commits) {
    const authorKey = `${commit.author} <${commit.email}>`;
    if (!map.has(authorKey)) {
      map.set(authorKey, new Set());
    }
    const files = map.get(authorKey)!;
    for (const file of commit.files) {
      files.add(file.path);
    }
  }

  return map;
}

/**
 * 构建 文件 -> (作者 -> 提交次数) 映射
 */
function buildFileAuthorsMap(commits: CommitRecord[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();

  for (const commit of commits) {
    const authorKey = `${commit.author} <${commit.email}>`;
    for (const file of commit.files) {
      if (!map.has(file.path)) {
        map.set(file.path, new Map());
      }
      const authors = map.get(file.path)!;
      authors.set(authorKey, (authors.get(authorKey) || 0) + 1);
    }
  }

  return map;
}

/**
 * 计算每个作者的知识独占度评分
 */
function calculateAuthorScores(
  authorFiles: Map<string, Set<string>>,
  fileAuthors: Map<string, Map<string, number>>
): CriticalAuthor[] {
  const scores: CriticalAuthor[] = [];

  for (const [authorKey, files] of authorFiles) {
    const uniqueFiles: string[] = [];
    const dominantFiles: string[] = [];

    for (const filePath of files) {
      const authors = fileAuthors.get(filePath)!;
      const authorCount = authors.size;

      // 独有文件：只有该作者修改过
      if (authorCount === 1) {
        uniqueFiles.push(filePath);
        continue;
      }

      // 主导文件：该作者贡献 >50%
      const authorCommits = authors.get(authorKey) || 0;
      const totalCommits = Array.from(authors.values()).reduce((a, b) => a + b, 0);
      if (authorCommits / totalCommits > 0.5) {
        dominantFiles.push(filePath);
      }
    }

    // 知识独占度评分 = (独有文件*2 + 主导文件) / 总文件数 * 100
    const knowledgeScore =
      ((uniqueFiles.length * 2 + dominantFiles.length) / fileAuthors.size) * 100;

    const [name, email] = parseAuthorKey(authorKey);
    scores.push({
      name,
      email,
      uniqueFiles,
      dominantFiles,
      knowledgeScore,
    });
  }

  return scores;
}

/**
 * 解析作者键 "name <email>" -> [name, email]
 */
function parseAuthorKey(authorKey: string): [string, string] {
  const match = authorKey.match(/^(.+) <(.+)>$/);
  if (match) {
    return [match[1], match[2]];
  }
  return [authorKey, ''];
}

function emptyTeamHealth(): TeamHealthMetrics {
  return {
    busFactor: 0,
    criticalAuthors: [],
    knowledgeDistribution: 1,
    riskLevel: 'low',
  };
}
