import type { RiskFile, ActionItem } from '../../types/index.js';

export function prioritizeActions(riskFiles: RiskFile[]): ActionItem[] {
  const actionItems: ActionItem[] = riskFiles.map(file => {
    const impact = calculateImpact(file);
    const effort = estimateEffort(file);
    const priority = (file.riskScore * impact) / Math.max(effort, 1);

    return {
      file: file.path,
      riskLevel: getRiskLevel(file.riskScore),
      impact,
      effort,
      priority,
      suggestedAction: generateSuggestion(file),
      owner: file.primaryAuthor,
    };
  });

  return actionItems.sort((a, b) => b.priority - a.priority).slice(0, 10);
}

function calculateImpact(file: RiskFile): number {
  let impact = 50;

  if (file.churnRate > 0.5) impact += 20;
  if (file.knowledgeRisk > 70) impact += 15;
  if (file.testCoverage < 30) impact += 15;

  return Math.min(impact, 100);
}

function estimateEffort(file: RiskFile): number {
  let effort = 1;

  if (file.complexity > 70) effort += 2;
  if (file.complexity > 50) effort += 1;
  if (file.knowledgeRisk > 70) effort += 1;

  return effort;
}

function getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function generateSuggestion(file: RiskFile): string {
  const suggestions: string[] = [];

  if (file.complexity > 70) {
    suggestions.push('拆分为多个小文件');
  }

  if (file.testCoverage < 30) {
    suggestions.push('增加单元测试覆盖');
  }

  if (file.knowledgeRisk > 70) {
    suggestions.push('进行知识分享和代码审查');
  }

  if (file.churnRate > 0.5) {
    suggestions.push('重构以提高稳定性');
  }

  if (suggestions.length === 0) {
    suggestions.push('代码审查和文档完善');
  }

  return suggestions.join('；');
}
