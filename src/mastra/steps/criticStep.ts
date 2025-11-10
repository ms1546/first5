import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { callBedrockStructured } from "../llm";
import {
  conversationMessageSchema,
  intakeNormalizedSchema,
  type Urgency,
} from "../schemas/intake";
import {
  criticReportSchema,
  interviewSchema,
  planSchema,
} from "../schemas/plan";
import { logError, normalizeError } from "../telemetry/logger";
import { getUrgencyLabel } from "../utils/labels";

const criticInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  interview: interviewSchema,
  plan: planSchema,
  history: z.array(conversationMessageSchema).optional(),
});

function escalateRisk(
  current: "low" | "medium" | "high",
  target: "low" | "medium" | "high"
) {
  const ordering: Record<"low" | "medium" | "high", number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  return ordering[target] > ordering[current] ? target : current;
}

function urgencyToRisk(urgency: Urgency): "low" | "medium" | "high" {
  switch (urgency) {
    case "high":
      return "high";
    case "mid":
      return "medium";
    default:
      return "low";
  }
}

export const criticStep = createStep({
  id: "critic-review",
  description: "プランの整合性とリスクを確認し、改善点を提示する。",
  inputSchema: criticInputSchema,
  outputSchema: z.object({
    review: criticReportSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, interview, plan, history } = inputData;
    const promptPayload = {
      normalized,
      interview,
      plan,
      instructions: {
        goal: "プランの妥当性・欠落・リスクを評価し、問題があれば severity と提案を出す。日本語で端的に。",
        language: "Japanese",
      },
    };

    try {
      const review = await callBedrockStructured({
        schema: criticReportSchema,
        system:
          "あなたはプランニングの批評家です。ステップの整合性、依存関係、不足情報を評価し、日本語で JSON を返してください。",
        prompt: JSON.stringify(
          { ...promptPayload, history: history ?? [] },
          null,
          2
        ),
        context: { step: "critic-review" },
      });

      return {
        review,
      };
    } catch (error) {
      logError("critic-review", {
        error: normalizeError(error),
        intent: normalized.intent,
      });
      return {
        review: buildFallbackReview(normalized, interview, plan),
      };
    }
  },
});

function buildFallbackReview(
  normalized: z.infer<typeof intakeNormalizedSchema>,
  interview: z.infer<typeof interviewSchema>,
  plan: z.infer<typeof planSchema>
) {
  const issues: {
    id: string;
    message: string;
    severity: "info" | "warning" | "error";
    suggestion: string | null;
  }[] = [];

  let riskLevel: "low" | "medium" | "high" = "low";

  const urgency = normalized.urgency_final ?? normalized.urgency_suggested;
  const urgencyLabel = getUrgencyLabel(urgency);
  riskLevel = escalateRisk(riskLevel, urgencyToRisk(urgency));

  if (!normalized.deadline && urgency !== "low") {
    issues.push({
      id: "missing-deadline",
      message: `緊急度が${urgencyLabel}のタスクですが期限が設定されていません。`,
      severity: "warning",
      suggestion: "確認画面で現実的な期限を入力してください。",
    });
    riskLevel = escalateRisk(riskLevel, "medium");
  }

  if (normalized.constraints.resources.length > 0) {
    const gatherStep = plan.steps.find(
      (step) => step.id === "gather-resources"
    );
    if (!gatherStep) {
      issues.push({
        id: "resources-not-addressed",
        message: "必要なリソースがプラン内で準備されていません。",
        severity: "error",
        suggestion: "リソース準備のステップを追加してください。",
      });
      riskLevel = escalateRisk(riskLevel, "high");
    }
  }

  if (plan.steps.at(-1)?.id !== "first-five-minutes") {
    issues.push({
      id: "missing-kickoff",
      message: "プランの末尾に即時着手（最初の5分）のステップがありません。",
      severity: "warning",
      suggestion: "最後に「最初の5分」ステップを追加して勢いを作りましょう。",
    });
    riskLevel = escalateRisk(riskLevel, "medium");
  }

  if (interview.status === "needs_input") {
    issues.push({
      id: "outstanding-questions",
      message: `${interview.gaps.join("・")}など不足情報があります。`,
      severity: "warning",
      suggestion: "確認欄で回答を入力し、不足情報を埋めてください。",
    });
    riskLevel = escalateRisk(riskLevel, "medium");
  }

  const approvals = [
    `緊急度: ${urgencyLabel}`,
    "ブロッカー確認済み",
    normalized.deadline ? "期限確認済み" : "期限設定のリマインド",
  ];

  return {
    riskLevel,
    issues,
    approvals,
  } satisfies z.infer<typeof criticReportSchema>;
}
