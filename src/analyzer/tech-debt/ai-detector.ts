import type { CommitRecord, AIDetectionResult, AIScoreEvaluation, SuspiciousFile } from '../../types/index.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export function calculateAIScore(commit: CommitRecord): number {
  return evaluateAIScore(commit).score;
}

export function evaluateAIScore(commit: CommitRecord): AIScoreEvaluation {
  let score = 0;
  const reasons: string[] = [];
  const totalLines = commit.files.reduce((sum, f) => sum + f.added, 0);
  const addedFiles = commit.files.filter((file) => file.status === 'added').length;

  if (mentionsAITool(commit.message) || mentionsAITool(commit.body || '')) {
    score += 55;
    reasons.push('AI 工具关键词');
  }

  if (mentionsGeneratedOutput(commit.message) || mentionsGeneratedOutput(commit.body || '')) {
    score += 15;
    reasons.push('生成产物关键词');
  }

  if (totalLines > 100 && commit.files.length >= 3 && addedFiles / commit.files.length > 0.6) {
    score += 20;
    reasons.push('大批量新增文件');
  }

  if (totalLines > 80 && commit.files.reduce((sum, f) => sum + f.deleted, 0) <= totalLines * 0.05) {
    score += 15;
    reasons.push('低删除率大新增');
  }

  if (totalLines > 1000 && commit.files.length > 10 && isGenericMessage(commit.message)) {
    score += 40;
    reasons.push('大型通用提交');
  } else if (totalLines > 500) {
    score += 20;
    reasons.push('大型提交');
  }

  const anomalousFiles = commit.files.filter(f => hasAnomalousNaming(f.path));
  if (anomalousFiles.length > 0) {
    score += Math.min(30, (anomalousFiles.length / commit.files.length) * 30);
    reasons.push('异常命名');
  }

  return { score: Math.min(100, score), reasons };
}

export async function detectAICode(
  commits: CommitRecord[],
  repoPath: string
): Promise<AIDetectionResult> {
  const suspiciousFiles: SuspiciousFile[] = [];

  for (const commit of commits) {
    const totalLines = commit.files.reduce((sum, f) => sum + f.added, 0);

    if (totalLines > 1000 && commit.files.length > 10) {
      if (isGenericMessage(commit.message)) {
        suspiciousFiles.push({
          commit: commit.hash,
          reason: 'large-commit-generic-message',
          score: 80,
          description: `大型提交（${totalLines}行）配合通用提交信息`,
        });
      }
    }

    for (const file of commit.files) {
      if (hasAnomalousNaming(file.path)) {
        suspiciousFiles.push({
          file: file.path,
          reason: 'anomalous-naming',
          score: 60,
          description: '命名模式异常（如 function1, temp1）',
        });
      }
    }
  }

  const uniqueFiles = new Set(commits.flatMap(c => c.files.map(f => f.path)));
  const filesToCheck = Array.from(uniqueFiles).slice(0, 50);

  for (const filePath of filesToCheck) {
    const fullPath = join(repoPath, filePath);
    if (!existsSync(fullPath)) continue;

    try {
      const content = await readFile(fullPath, 'utf-8');
      const commentDensity = calculateCommentDensity(content);

      if (commentDensity > 0.3) {
        suspiciousFiles.push({
          file: filePath,
          reason: 'excessive-comments',
          score: 70,
          description: `注释密度过高（${(commentDensity * 100).toFixed(1)}%）`,
        });
      }
    } catch {
      // 忽略读取错误
    }
  }

  const uniqueSuspicious = Array.from(
    new Map(suspiciousFiles.map(f => [f.file || f.commit, f])).values()
  );

  return {
    suspiciousFiles: uniqueSuspicious.sort((a, b) => b.score - a.score).slice(0, 20),
    totalSuspicious: uniqueSuspicious.length,
  };
}

function isGenericMessage(message: string): boolean {
  const genericPatterns = [
    /^fix$/i,
    /^update$/i,
    /^refactor$/i,
    /^fix bug$/i,
    /^update code$/i,
    /^bug fix$/i,
    /^minor fix$/i,
    /^wip$/i,
    /^temp$/i,
    /^test$/i,
  ];

  const normalized = message.trim().toLowerCase();
  return genericPatterns.some(pattern => pattern.test(normalized));
}

function mentionsAITool(text: string): boolean {
  const aiPatterns = [
    /\bai\b/i,
    /\bcopilot\b/i,
    /\bclaude\b/i,
    /\bcursor\b/i,
    /\bchatgpt\b/i,
    /\bgpt[-\s]?\d*\b/i,
  ];

  return aiPatterns.some(pattern => pattern.test(text));
}

function mentionsGeneratedOutput(text: string): boolean {
  return /\bgenerated\b|\bcodegen\b|\bauto[-\s]?generated\b/i.test(text);
}

function hasAnomalousNaming(path: string): boolean {
  const anomalousPatterns = [
    /function\d+/i,
    /temp\d+/i,
    /test\d+/i,
    /file\d+/i,
    /component\d+/i,
    /generated/i,
    /auto[-_]?generated/i,
    /untitled/i,
    /copy\d*/i,
  ];

  return anomalousPatterns.some(pattern => pattern.test(path));
}

function calculateCommentDensity(content: string): number {
  const lines = content.split('\n');
  let commentLines = 0;
  let codeLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('#')
    ) {
      commentLines++;
    } else {
      codeLines++;
    }
  }

  const totalLines = commentLines + codeLines;
  return totalLines > 0 ? commentLines / totalLines : 0;
}
