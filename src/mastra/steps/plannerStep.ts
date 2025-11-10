import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { callBedrockStructured } from "../llm";
import {
  conversationMessageSchema,
  intakeNormalizedSchema,
} from "../schemas/intake";
import { interviewSchema, type PlanStep, planSchema } from "../schemas/plan";
import { logError, normalizeError } from "../telemetry/logger";
import { getTaskTypeLabel, getUrgencyLabel } from "../utils/labels";

const plannerInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  interview: interviewSchema,
  history: z.array(conversationMessageSchema).optional(),
});

export const plannerStep = createStep({
  id: "planner-breakdown",
  description:
    "明確な完了条件をもつステップに分解したアクションプランを生成する。",
  inputSchema: plannerInputSchema,
  outputSchema: z.object({
    plan: planSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, interview, history } = inputData;
    const promptPayload = {
      normalized,
      interview,
      history: history ?? [],
      instructions: {
        goal: "不足情報がある場合は最初のステップでその解消を促し、5分以内で着手できるプランを構築する。",
        language: "Japanese",
      },
    };

    try {
      const plan = await callBedrockStructured({
        schema: planSchema,
        system:
          "あなたは行動プランナーです。入力された JSON を参考に、日本語で実行プランを返してください。ステップは最大5件、すべてに Definition of Done と推定時間（分）を必ず設定し、dependencies を ID で管理します。",
        prompt: JSON.stringify(promptPayload, null, 2),
        context: { step: "planner-breakdown" },
      });

      return {
        plan,
      };
    } catch (error) {
      logError("planner-breakdown", {
        error: normalizeError(error),
        intent: normalized.intent,
      });
      return {
        plan: buildFallbackPlan(normalized, interview),
      };
    }
  },
});

function buildFallbackPlan(
  normalized: z.infer<typeof intakeNormalizedSchema>,
  interview: z.infer<typeof interviewSchema>
) {
  const steps: PlanStep[] = [];

  if (interview.questions.length > 0) {
    steps.push({
      id: "capture-answers",
      title: "ヒアリング回答を記録する",
      description: `以下の問いに答えて不足情報を埋める: ${interview.questions
        .map((question) => `「${question.prompt}」`)
        .join(" / ")}。回答はアプリの確認欄またはメモに残す。`,
      definitionOfDone:
        "すべてのヒアリング項目に回答が記録され、意思決定が伴っている。",
      estimatedMinutes: 5,
      dependsOn: [],
    });
  }

  const prepareStepId = steps.at(-1)?.id;
  steps.push({
    id: "clarify-outcome",
    title: "ゴールを明確化する",
    description: `「${normalized.intent}」の完了状態を1文で説明し、どこまで進めば完了かを確認する。`,
    definitionOfDone: "目的と完了イメージが3文以内で記録されている。",
    estimatedMinutes: 5,
    dependsOn: prepareStepId ? [prepareStepId] : [],
  });

  steps.push({
    id: "collect-context",
    title: "制約とブロッカーを洗い出す",
    description: "必要な資料、関係者、想定される懸念点を箇条書きで整理する。",
    definitionOfDone:
      "制約とブロッカーが記録され、担当者または対応方針が明記されている。",
    estimatedMinutes: 5,
    dependsOn: ["clarify-outcome"],
  });

  if (normalized.constraints.resources.length > 0) {
    steps.push({
      id: "gather-resources",
      title: "必要な資料を準備する",
      description: `以下の資料を揃える: ${normalized.constraints.resources.join(", ")}。不足分は代替案やフォローアップタスクを設定する。`,
      definitionOfDone:
        "挙げられた資料が手元にある、または取得タスクが登録済み。",
      estimatedMinutes: 10,
      dependsOn: ["collect-context"],
    });
  }

  if (normalized.deadline) {
    steps.push({
      id: "schedule-window",
      title: "実行時間を確保する",
      description:
        "期限より余裕をもって集中できる時間をカレンダーに確保し、必要があれば関係者へ招待を送る。",
      definitionOfDone:
        "カレンダーにブロックを登録し、通知やリマインダーを設定済み。",
      estimatedMinutes: 5,
      dependsOn: steps.map((step) => step.id),
    });
  }

  const kickoffTailId = steps.at(-1)?.id;
  const kickoffDependency = kickoffTailId ? [kickoffTailId] : [];

  steps.push({
    id: "first-five-minutes",
    title: "最初の5分を行動に移す",
    description:
      "もっとも小さな前進（例: フォームを開いて必要項目を確認する、資料名をメモする など）を完了する。",
    definitionOfDone:
      "具体的な成果物（メモ、下書き、予約記録など）が残っている。",
    estimatedMinutes: 5,
    dependsOn: kickoffDependency,
  });

  const typeLabel = getTaskTypeLabel(normalized.type);
  const urgencyLabel = getUrgencyLabel(
    normalized.urgency_final ?? normalized.urgency_suggested
  );

  const summary = [
    `${typeLabel}タスク向けのプラン。緊急度は${urgencyLabel}レベルです。`,
    `目標: ${interview.goal}`,
    interview.summary,
  ].join("\n");

  const focus = [
    "着手前に制約とブロッカーを解決する",
    "最初の5分で勢いと達成感を作る",
  ];

  focus.push(
    normalized.deadline
      ? "期限より前に作業時間を押さえて遅延を防ぐ"
      : "期限がなくても定期的に振り返り、前進を確認する"
  );

  if (interview.status === "needs_input") {
    focus.push("不足情報を補完してから予定を固める");
  }

  return {
    steps,
    summary,
    focus,
  } satisfies z.infer<typeof planSchema>;
}
