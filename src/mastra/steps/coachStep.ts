import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { intakeNormalizedSchema } from '../schemas/intake';
import { planSchema, criticReportSchema, coachingPlanSchema } from '../schemas/plan';

const coachInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  plan: planSchema,
  review: criticReportSchema,
});

export const coachStep = createStep({
  id: 'coach-script',
  description: '最初の5分で行動に移すためのコーチングスクリプトとナッジを生成する。',
  inputSchema: coachInputSchema,
  outputSchema: z.object({
    coaching: coachingPlanSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, plan, review } = inputData;
    const urgency = normalized.urgency_final ?? normalized.urgency_suggested;

    const kickoffStep =
      plan.steps.find((step) => step.id === 'first-five-minutes') ?? plan.steps[plan.steps.length - 1];
    const scriptActions: string[] = [
      `5分タイマーをセットし、「${normalized.intent}のゴールは○○」と声に出す。`,
      `キックオフ行動: ${kickoffStep.title} — ${kickoffStep.description}`,
    ];

    if (normalized.constraints.resources.length > 0) {
      scriptActions.push(
        `必要な資料を確認: ${normalized.constraints.resources.join(', ')}（揃っていればチェック）。`,
      );
    }

    scriptActions.push('気づいたブロッカーをメモアプリなどに記録し、次回以降の入力に活用する。');

    const script = scriptActions.map((line, index) => `${index + 1}. ${line}`).join('\n');

    const nudges = [
      'タイマーを視界に入れて5分で区切る意識を保つ。',
      'キックオフが終わったらアプリに進捗を記録し、履歴に残す。',
    ];

    if (urgency === 'high') {
      nudges.push('キックオフ直後に次の作業ブロックをカレンダーへ追加する。');
    }

    if (review.issues.length > 0) {
      nudges.push('レビューで指摘された課題を解消してから次に進む。');
    }

    const checkpoints = [
      { label: 'ゴールを言語化', minutesOffset: 0 },
      { label: 'キックオフ完了', minutesOffset: 5 },
    ];

    if (normalized.deadline) {
      checkpoints.push({ label: '作業時間を確保', minutesOffset: 10 });
    }

    return {
      coaching: {
        script,
        nudges,
        checkpoints,
      },
    };
  },
});
