import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { intakeNormalizedSchema } from '../schemas/intake';
import { planSchema, PlanStep } from '../schemas/plan';
import { getTaskTypeLabel, getUrgencyLabel } from '../utils/labels';

const plannerInputSchema = z.object({
  normalized: intakeNormalizedSchema,
});

export const plannerStep = createStep({
  id: 'planner-breakdown',
  description: '明確な完了条件をもつステップに分解したアクションプランを生成する。',
  inputSchema: plannerInputSchema,
  outputSchema: z.object({
    plan: planSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized } = inputData;
    const steps: PlanStep[] = [];

    steps.push({
      id: 'clarify-outcome',
      title: 'ゴールを明確化する',
      description: `「${normalized.intent}」の完了状態を1文で説明し、どこまで進めば完了かを確認する。`,
      definitionOfDone: '目的と完了イメージが3文以内で記録されている。',
      estimatedMinutes: 5,
      dependsOn: [],
    });

    steps.push({
      id: 'collect-context',
      title: '制約とブロッカーを洗い出す',
      description: '必要な資料、関係者、想定される懸念点を箇条書きで整理する。',
      definitionOfDone: '制約とブロッカーが記録され、担当者または対応方針が明記されている。',
      estimatedMinutes: 5,
      dependsOn: ['clarify-outcome'],
    });

    if (normalized.constraints.resources.length > 0) {
      steps.push({
        id: 'gather-resources',
        title: '必要な資料を準備する',
        description: `以下の資料を揃える: ${normalized.constraints.resources.join(', ')}。不足分は代替案やフォローアップタスクを設定する。`,
        definitionOfDone: '挙げられた資料が手元にある、または取得タスクが登録済み。',
        estimatedMinutes: 10,
        dependsOn: ['collect-context'],
      });
    }

    if (normalized.deadline) {
      steps.push({
        id: 'schedule-window',
        title: '実行時間を確保する',
        description:
          '期限より余裕をもって集中できる時間をカレンダーに確保し、必要があれば関係者へ招待を送る。',
        definitionOfDone: 'カレンダーにブロックを登録し、通知やリマインダーを設定済み。',
        estimatedMinutes: 5,
        dependsOn: steps.map((step) => step.id),
      });
    }

    const kickoffDependency = steps.length > 0 ? [steps[steps.length - 1].id] : [];

    steps.push({
      id: 'first-five-minutes',
      title: '最初の5分を行動に移す',
      description:
        'もっとも小さな前進（例: フォームを開いて必要項目を確認する、資料名をメモする など）を完了する。',
      definitionOfDone: '具体的な成果物（メモ、下書き、予約記録など）が残っている。',
      estimatedMinutes: 5,
      dependsOn: kickoffDependency,
    });

    const typeLabel = getTaskTypeLabel(normalized.type);
    const urgencyLabel = getUrgencyLabel(normalized.urgency_final ?? normalized.urgency_suggested);

    const summary = `${typeLabel}タスク向けのプラン。緊急度は${urgencyLabel}レベルです。`;

    const focus = [
      '着手前に制約とブロッカーを解決する',
      '最初の5分で勢いと達成感を作る',
    ];

    focus.push(
      normalized.deadline ? '期限より前に作業時間を押さえて遅延を防ぐ' : '期限がなくても定期的に振り返り、前進を確認する',
    );

    return {
      plan: {
        steps,
        summary,
        focus,
      },
    };
  },
});
