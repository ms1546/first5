import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { intakeNormalizedSchema } from '../schemas/intake';
import { planSchema, criticReportSchema } from '../schemas/plan';
import { Urgency } from '../schemas/intake';
import { getUrgencyLabel } from '../utils/labels';

const criticInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  plan: planSchema,
});

function escalateRisk(current: 'low' | 'medium' | 'high', target: 'low' | 'medium' | 'high') {
  const ordering: Record<'low' | 'medium' | 'high', number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  return ordering[target] > ordering[current] ? target : current;
}

function urgencyToRisk(urgency: Urgency): 'low' | 'medium' | 'high' {
  switch (urgency) {
    case 'high':
      return 'high';
    case 'mid':
      return 'medium';
    default:
      return 'low';
  }
}

export const criticStep = createStep({
  id: 'critic-review',
  description: 'プランの整合性とリスクを確認し、改善点を提示する。',
  inputSchema: criticInputSchema,
  outputSchema: z.object({
    review: criticReportSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, plan } = inputData;

    const issues: {
      id: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
      suggestion: string | null;
    }[] = [];

    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    const urgency = normalized.urgency_final ?? normalized.urgency_suggested;
    const urgencyLabel = getUrgencyLabel(urgency);
    riskLevel = escalateRisk(riskLevel, urgencyToRisk(urgency));

    if (!normalized.deadline && urgency !== 'low') {
      issues.push({
        id: 'missing-deadline',
        message: `緊急度が${urgencyLabel}のタスクですが期限が設定されていません。`,
        severity: 'warning',
        suggestion: '確認画面で現実的な期限を入力してください。',
      });
      riskLevel = escalateRisk(riskLevel, 'medium');
    }

    if (normalized.constraints.resources.length > 0) {
      const gatherStep = plan.steps.find((step) => step.id === 'gather-resources');
      if (!gatherStep) {
        issues.push({
          id: 'resources-not-addressed',
          message: '必要なリソースがプラン内で準備されていません。',
          severity: 'error',
          suggestion: 'リソース準備のステップを追加してください。',
        });
        riskLevel = escalateRisk(riskLevel, 'high');
      }
    }

    if (plan.steps[plan.steps.length - 1]?.id !== 'first-five-minutes') {
      issues.push({
        id: 'missing-kickoff',
        message: 'プランの末尾に即時着手（最初の5分）のステップがありません。',
        severity: 'warning',
        suggestion: '最後に「最初の5分」ステップを追加して勢いを作りましょう。',
      });
      riskLevel = escalateRisk(riskLevel, 'medium');
    }

    const approvals = [
      `緊急度: ${urgencyLabel}`,
      'ブロッカー確認済み',
      normalized.deadline ? '期限確認済み' : '期限設定のリマインド',
    ];

    return {
      review: {
        riskLevel,
        issues,
        approvals,
      },
    };
  },
});
