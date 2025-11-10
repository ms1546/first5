import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { callBedrockStructured } from "../llm";
import {
  conversationMessageSchema,
  intakeNormalizedSchema,
} from "../schemas/intake";
import { type interviewQuestionSchema, interviewSchema } from "../schemas/plan";
import { logError, normalizeError } from "../telemetry/logger";
import {
  getHorizonLabel,
  getTaskTypeLabel,
  getUrgencyLabel,
} from "../utils/labels";

const interviewInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  history: z.array(conversationMessageSchema).optional(),
});

const ESSENTIAL_GAPS: z.infer<typeof interviewSchema>["gaps"][number][] = [
  "deadline",
];
const READY_CONFIDENCE = 0.85;
const NEEDS_INPUT_CONFIDENCE = 0.55;

export const interviewStep = createStep({
  id: "interview-elicitation",
  description: "不足している情報をヒアリングし、前提をまとめる。",
  inputSchema: interviewInputSchema,
  outputSchema: z.object({
    interview: interviewSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, history } = inputData;

    const promptPayload = {
      normalized,
      history: history ?? [],
      guidance: {
        objective:
          "ユーザーの短い入力から、行動開始に不足している前提や質問を構造化し、実行準備の信頼度を評価する。",
        language: "Japanese",
      },
    };

    try {
      const interview = await callBedrockStructured({
        schema: interviewSchema,
        system:
          "あなたは行動支援エージェントの Intake 担当です。受け取った JSON を分析し、スキーマ通りに日本語で出力してください。質問は端的に、目的と不足情報も列挙してください。",
        prompt: JSON.stringify(promptPayload, null, 2),
        context: { step: "interview-elicitation" },
      });

      return {
        interview: normalizeInterview(interview, history ?? []),
      };
    } catch (error) {
      logError("interview-elicitation", {
        error: normalizeError(error),
        intent: normalized.intent,
      });
      return {
        interview: normalizeInterview(
          buildFallbackInterview(normalized),
          history ?? []
        ),
      };
    }
  },
});

function normalizeInterview(
  interview: z.infer<typeof interviewSchema>,
  history: z.infer<typeof conversationMessageSchema>[]
): z.infer<typeof interviewSchema> {
  const safeInterview = {
    ...interview,
    followUps: interview.followUps ?? [],
  };

  const essentialGaps = safeInterview.gaps.filter((gap) =>
    ESSENTIAL_GAPS.includes(gap)
  );
  const optionalGaps = safeInterview.gaps.filter(
    (gap) => !ESSENTIAL_GAPS.includes(gap)
  );
  const followUps = optionalGaps.map((gap) => gap);

  let nextQuestion: string | null = null;
  let status = safeInterview.status;
  let gaps = safeInterview.gaps;

  const askedQuestions = history.filter(
    (message) => message.role === "assistant"
  ).length;

  if (askedQuestions >= 1) {
    status = "ready";
    gaps = [];
  } else if (essentialGaps.length > 0) {
    status = "needs_input";
    gaps = essentialGaps;
    nextQuestion = findQuestionPrompt(
      safeInterview.questions,
      essentialGaps[0]
    );
  } else {
    status = "ready";
    gaps = [];
  }

  return {
    ...safeInterview,
    status,
    gaps,
    followUps,
    nextQuestion,
  };
}

function findQuestionPrompt(
  questions: z.infer<typeof interviewSchema>["questions"],
  gap?: string
): string | null {
  if (!gap) {
    return null;
  }
  const match = questions.find((question) => question.field === gap);
  return match?.prompt ?? null;
}

function buildFallbackInterview(
  normalized: z.infer<typeof intakeNormalizedSchema>
) {
  type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
  const questions: InterviewQuestion[] = [];
  const assumptions: string[] = [];
  const gaps: string[] = [];

  const typeLabel = getTaskTypeLabel(normalized.type);
  const urgencyLabel = getUrgencyLabel(
    normalized.urgency_final ?? normalized.urgency_suggested
  );
  const horizonLabel = getHorizonLabel(normalized.horizon);

  assumptions.push(
    `${typeLabel}タスク。緊急度は${urgencyLabel}、想定スパンは${horizonLabel}。`
  );

  if (normalized.deadline) {
    assumptions.push(`期限は${normalized.deadline}。`);
  } else {
    questions.push({
      id: "confirm-deadline",
      prompt: "このタスクを現実的に完了したい期限はいつですか？",
      purpose: "期限を確定して優先度とスケジュール調整を行うため",
      field: "deadline",
      suggestedAnswer: null,
    });
    assumptions.push("期限は未確定。UIで設定が必要。");
    gaps.push("deadline");
  }

  if (normalized.constraints.time_limit) {
    assumptions.push(`想定作業時間: ${normalized.constraints.time_limit}`);
  } else {
    questions.push({
      id: "estimate-effort",
      prompt:
        "まとまった作業時間はどれくらい確保できますか？（例：30分/60分など）",
      purpose: "カレンダーで確保する時間枠を推奨するため",
      field: "time_allocation",
      suggestedAnswer: "30分〜60分",
    });
    assumptions.push("想定作業時間は不明。");
    gaps.push("time_allocation");
  }

  if (normalized.constraints.place) {
    assumptions.push(`想定作業場所: ${normalized.constraints.place}`);
  } else {
    questions.push({
      id: "confirm-place",
      prompt:
        "作業する場所や環境に制約はありますか？（自宅/オフィス/オンラインなど）",
      purpose: "リソース準備とカレンダーの場所設定に反映するため",
      field: "place",
      suggestedAnswer: null,
    });
    assumptions.push("場所は未指定。");
    gaps.push("place");
  }

  if (normalized.constraints.resources.length === 0) {
    questions.push({
      id: "discover-resources",
      prompt: "事前に用意すべき資料やアカウントはありますか？",
      purpose: "リソース準備ステップを正確にするため",
      field: "resources",
      suggestedAnswer: null,
    });
    assumptions.push("特別な資料は未登録。");
    gaps.push("resources");
  } else {
    assumptions.push(
      `必要な資料: ${normalized.constraints.resources.join(", ")}`
    );
  }

  questions.push({
    id: "calendar-window",
    prompt: "カレンダーに入れやすい時間帯（午前/午後/夜など）はありますか？",
    purpose: "候補スロットの提案精度を高めるため",
    field: "calendar",
    suggestedAnswer: "平日午前",
  });

  const summary = [
    `目的: 「${normalized.intent}」を実行可能なステップに分解し、カレンダーへ即登録できる状態にする。`,
    assumptions.join(" "),
  ].join("\n");

  const status: "needs_input" | "ready" =
    gaps.length > 0 ? "needs_input" : "ready";
  const confidence =
    status === "ready" ? READY_CONFIDENCE : NEEDS_INPUT_CONFIDENCE;
  const goal = `「${normalized.intent}」を${normalized.deadline ? `期限(${normalized.deadline})` : "現実的な期限"}までに完了する`;

  return {
    summary,
    goal,
    assumptions,
    questions,
    status,
    confidence,
    gaps,
    followUps: [],
    nextQuestion: null,
  } satisfies z.infer<typeof interviewSchema>;
}
