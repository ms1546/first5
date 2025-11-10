import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { callBedrockStructured } from "../llm";
import {
  conversationMessageSchema,
  intakeNormalizedSchema,
} from "../schemas/intake";
import {
  coachingPlanSchema,
  criticReportSchema,
  interviewSchema,
  planSchema,
  schedulingPlanSchema,
} from "../schemas/plan";
import { logError, normalizeError } from "../telemetry/logger";

const coachInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  interview: interviewSchema,
  plan: planSchema,
  review: criticReportSchema,
  scheduling: schedulingPlanSchema,
  history: z.array(conversationMessageSchema).optional(),
});

export const coachStep = createStep({
  id: "coach-script",
  description:
    "最初の5分で行動に移すためのコーチングスクリプトとナッジを生成する。",
  inputSchema: coachInputSchema,
  outputSchema: z.object({
    coaching: coachingPlanSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, interview, plan, review, scheduling, history } =
      inputData;

    const promptPayload = {
      normalized,
      interview,
      plan,
      review,
      scheduling,
      history: history ?? [],
      instructions: {
        goal: "ユーザーがその場でカレンダー登録と最初の5分の着手まで進められるよう、手順とナッジ、チェックポイントを日本語で出力する。",
        language: "Japanese",
      },
    };

    try {
      const coaching = await callBedrockStructured({
        schema: coachingPlanSchema,
        system:
          "あなたは行動コーチです。与えられた情報をもとに、順序付きの行動スクリプト、ナッジ、チェックポイントを JSON で返してください。",
        prompt: JSON.stringify(promptPayload, null, 2),
        context: { step: "coach-script" },
      });

      return {
        coaching,
      };
    } catch (error) {
      logError("coach-script", {
        error: normalizeError(error),
        intent: normalized.intent,
      });
      return {
        coaching: buildFallbackCoaching({
          normalized,
          interview,
          plan,
          review,
          scheduling,
        }),
      };
    }
  },
});

type CoachingFallbackArgs = {
  normalized: z.infer<typeof intakeNormalizedSchema>;
  interview: z.infer<typeof interviewSchema>;
  plan: z.infer<typeof planSchema>;
  review: z.infer<typeof criticReportSchema>;
  scheduling: z.infer<typeof schedulingPlanSchema>;
};

function buildFallbackCoaching({
  normalized,
  interview,
  plan,
  review,
  scheduling,
}: CoachingFallbackArgs) {
  const urgency = normalized.urgency_final ?? normalized.urgency_suggested;
  const fallbackStep = plan.steps.at(-1);
  const kickoffStep =
    plan.steps.find((step) => step.id === "first-five-minutes") ?? fallbackStep;

  const formatSlot = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const scriptActions: string[] = [
    `推奨時間に合わせてカレンダーを開き、予定「${scheduling.title}」を作成する。`,
    `予定メモに以下を貼り付ける:\n${scheduling.calendarNote}`,
    `5分タイマーをセットし、「${normalized.intent}のゴールは○○」と声に出す。`,
    `キックオフ行動: ${kickoffStep.title} — ${kickoffStep.description}`,
  ];

  if (normalized.constraints.resources.length > 0) {
    scriptActions.push(
      `必要な資料を確認: ${normalized.constraints.resources.join(", ")}（揃っていればチェック）。`
    );
  }

  if (interview.questions.length > 0) {
    scriptActions.push(
      "ヒアリング項目に回答し、未確定事項を埋めてから次のステップへ進む。"
    );
  }

  scriptActions.push(
    "気づいたブロッカーをメモアプリなどに記録し、次回以降の入力に活用する。"
  );

  const script = scriptActions
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n");

  const nudges = [
    `推薦スロット: ${formatSlot(scheduling.primary.start)}〜${formatSlot(scheduling.primary.end)} (${scheduling.timezone})`,
    "タイマーを視界に入れて5分で区切る意識を保つ。",
    "キックオフが終わったらアプリに進捗を記録し、履歴に残す。",
  ];

  if (urgency === "high") {
    nudges.push("キックオフ直後に次の作業ブロックをカレンダーへ追加する。");
  }

  if (review.issues.length > 0) {
    nudges.push("レビューで指摘された課題を解消してから次に進む。");
  }

  const checkpoints = [
    { label: "予定をカレンダー登録", minutesOffset: 0 },
    { label: "ゴールを言語化", minutesOffset: 2 },
    { label: "キックオフ完了", minutesOffset: 7 },
  ];

  if (normalized.deadline) {
    checkpoints.push({ label: "作業時間を確保", minutesOffset: 15 });
  }

  return {
    script,
    nudges,
    checkpoints,
  } satisfies z.infer<typeof coachingPlanSchema>;
}
