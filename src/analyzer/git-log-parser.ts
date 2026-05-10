import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ig from 'ignore';
import type { Ignore } from 'ignore';
import type { CommitRecord, FileChange, TimeRange } from '../types/index.js';

/** git log 的格式化分隔符 */
const COMMIT_SEPARATOR = '---COMMITX_SEP---';
const COMMIT_END = '---COMMITX_END---';
const FIELD_SEPARATOR = '|';
const FORMAT =
  `${COMMIT_SEPARATOR}%H${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%an` +
  `${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s%n%B${COMMIT_END}`;

/**
 * 从指定仓库解析 git log，返回提交记录数组
 * timeRange 为 null 时表示获取所有提交
 */
export async function parseGitLog(
  repoPath: string,
  timeRange: TimeRange | null,
  author?: string
): Promise<CommitRecord[]> {
  const ignoreFilter = await loadGitignore(repoPath);

  const args = [
    'log',
    `--format=${FORMAT}`,
    '--raw',
    '--numstat',
    '--find-renames',
    '--find-copies',
  ];

  if (timeRange) {
    args.push(`--since=${timeRange.from.toISOString()}`);
    args.push(`--until=${timeRange.to.toISOString()}`);
  }

  if (author) {
    args.push(`--author=${author}`);
  }

  let output: string;
  try {
    output = execFileSync('git', args, {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large repos
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return [];
  }

  if (!output.trim()) {
    return [];
  }

  return parseOutput(output, ignoreFilter);
}

/**
 * 解析 git log 输出文本为 CommitRecord 数组
 */
function parseOutput(
  output: string,
  ignoreFilter: ReturnType<typeof ig>
): CommitRecord[] {
  const commits: CommitRecord[] = [];
  const blocks = output.split(COMMIT_SEPARATOR).filter((b) => b.trim());

  for (const block of blocks) {
    const endIndex = block.indexOf(COMMIT_END);
    const metadataText = endIndex >= 0 ? block.slice(0, endIndex) : block;
    const changesText = endIndex >= 0
      ? block.slice(endIndex + COMMIT_END.length)
      : '';
    const metadataLines = metadataText.trim().split('\n');
    if (metadataLines.length === 0) continue;

    // 第一行是提交元信息
    const headerLine = metadataLines[0].replace(/^"|"$/g, '');
    const parts = headerLine.split(FIELD_SEPARATOR);
    if (parts.length < 6) continue;

    const [hash, parentHashText, authorName, email, dateStr, ...messageParts] = parts;
    const message = messageParts.join(FIELD_SEPARATOR); // message 可能包含 |
    const body = metadataLines.slice(1).join('\n').trim();
    const parentHashes = parentHashText.trim()
      ? parentHashText.trim().split(/\s+/)
      : [];

    const changeLines = changesText.trim().split('\n');
    const statusByPath = parseFileStatuses(changeLines);

    // 后续行包含 raw status 和 numstat（新增\t删除\t文件路径）
    const files: FileChange[] = [];
    for (const rawLine of changeLines) {
      const line = rawLine.trim();
      if (!line) continue;

      const tabParts = line.split('\t');
      if (tabParts.length !== 3) continue;

      const [addedStr, deletedStr, filePath] = tabParts;

      // 二进制文件显示为 -
      const added = addedStr === '-' ? 0 : parseInt(addedStr, 10) || 0;
      const deleted = deletedStr === '-' ? 0 : parseInt(deletedStr, 10) || 0;

      // 应用 gitignore 过滤
      if (ignoreFilter.ignores(filePath)) continue;

      const status = statusByPath.get(filePath);
      files.push({
        added,
        deleted,
        path: filePath,
        ...(status && { status }),
      });
    }

    commits.push({
      hash,
      author: authorName,
      email,
      date: new Date(dateStr),
      message,
      body,
      parentHashes,
      files,
    });
  }

  return commits;
}

function parseFileStatuses(lines: string[]): Map<string, FileChange['status']> {
  const statusByPath = new Map<string, FileChange['status']>();

  for (const line of lines) {
    if (!line.startsWith(':')) continue;

    const parts = line.trim().split('\t');
    if (parts.length < 2) continue;

    const metadata = parts[0].split(/\s+/);
    const statusToken = metadata[4] || '';
    const status = normalizeStatus(statusToken);
    const path = status === 'renamed' || status === 'copied'
      ? parts[2] || parts[1]
      : parts[1];

    if (path) {
      statusByPath.set(path, status);
    }
  }

  return statusByPath;
}

function normalizeStatus(statusToken: string): FileChange['status'] {
  const type = statusToken[0];
  if (type === 'A') return 'added';
  if (type === 'M') return 'modified';
  if (type === 'D') return 'deleted';
  if (type === 'R') return 'renamed';
  if (type === 'C') return 'copied';
  return 'unknown';
}

/**
 * 读取仓库的 .gitignore 规则
 */
async function loadGitignore(repoPath: string): Promise<Ignore> {
  const ignoreInstance = ig();

  try {
    const content = await readFile(join(repoPath, '.gitignore'), 'utf-8');
    ignoreInstance.add(content);
  } catch {
    // 没有 .gitignore 文件，跳过
  }

  // 默认忽略一些常见的生成文件
  ignoreInstance.add([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ]);

  return ignoreInstance;
}
