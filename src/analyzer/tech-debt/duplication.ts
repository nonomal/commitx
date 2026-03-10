import type { DuplicationResult, DuplicationCluster, DuplicationFileScore } from '../../types/index.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

export async function detectDuplication(repoPath: string): Promise<DuplicationResult> {
  const codeFiles = findCodeFiles(repoPath);
  const fileHashes = new Map<string, string[]>();
  const fileSizes = new Map<string, number>();

  for (const file of codeFiles.slice(0, 100)) {
    try {
      const content = await readFile(file, 'utf-8');
      const normalized = normalizeCode(content);
      const hash = simpleHash(normalized);

      if (!fileHashes.has(hash)) {
        fileHashes.set(hash, []);
      }
      fileHashes.get(hash)!.push(file.replace(repoPath, '').replace(/^[/\\]/, ''));
      fileSizes.set(file, content.split('\n').length);
    } catch {
      // 忽略读取错误
    }
  }

  const clusters: DuplicationCluster[] = [];
  for (const [hash, files] of fileHashes) {
    if (files.length > 1) {
      const lines = fileSizes.get(join(repoPath, files[0])) || 0;
      clusters.push({
        files,
        similarity: 100,
        lines,
      });
    }
  }

  const fileScores = new Map<string, number>();
  for (const cluster of clusters) {
    for (const file of cluster.files) {
      fileScores.set(file, (fileScores.get(file) || 0) + cluster.lines);
    }
  }

  const sortedScores: DuplicationFileScore[] = Array.from(fileScores.entries())
    .map(([file, score]) => ({ file, score }))
    .sort((a, b) => b.score - a.score);

  return {
    clusters: clusters.sort((a, b) => b.lines - a.lines).slice(0, 10),
    fileScores: sortedScores.slice(0, 20),
  };
}

function findCodeFiles(dir: string, maxDepth = 3, currentDepth = 0): string[] {
  if (currentDepth > maxDepth) return [];

  const files: string[] = [];
  const ignorePatterns = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next'];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (ignorePatterns.includes(entry)) continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...findCodeFiles(fullPath, maxDepth, currentDepth + 1));
        } else if (stat.isFile() && isCodeFile(entry)) {
          files.push(fullPath);
        }
      } catch {
        // 忽略权限错误
      }
    }
  } catch {
    // 忽略目录读取错误
  }

  return files;
}

function isCodeFile(filename: string): boolean {
  const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];
  return codeExtensions.some(ext => filename.endsWith(ext));
}

function normalizeCode(content: string): string {
  return content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function simpleHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}
