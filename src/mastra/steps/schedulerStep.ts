import { createStep } from "@mastra/core/workflows";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  HALF_HOUR_MINUTES,
  HIGH_URGENCY_BLOCK_MINUTES,
  LOW_URGENCY_BLOCK_MINUTES,
  MAX_CONSTRAINED_BLOCK_MINUTES,
  MID_URGENCY_BLOCK_MINUTES,
  MIN_CONSTRAINED_BLOCK_MINUTES,
} from "../constants/time";
import { FOLLOW_UP_STEP_THRESHOLD } from "../constants/workflow";
import { callBedrockStructured } from "../llm";
import {
  conversationMessageSchema,
  intakeNormalizedSchema,
} from "../schemas/intake";
import {
  interviewSchema,
  planSchema,
  schedulingPlanSchema,
  schedulingSlotSchema,
} from "../schemas/plan";
import { logError, normalizeError } from "../telemetry/logger";
import { getTaskTypeLabel } from "../utils/labels";

const TIME_LIMIT_PATTERN = /(?<value>\d+)(?<unit>h|m)/i;

const schedulerInputSchema = z.object({
  normalized: intakeNormalizedSchema,
  interview: interviewSchema,
  plan: planSchema,
  history: z.array(conversationMessageSchema).optional(),
});

function parseTimeLimitMinutes(timeLimit?: string | null): number | null {
  if (!timeLimit) {
    return null;
  }

  const match = timeLimit.match(TIME_LIMIT_PATTERN);
  const groups = match?.groups as { value: string; unit: string } | undefined;
  if (!groups) {
    return null;
  }

  const value = Number.parseInt(groups.value, 10);
  if (Number.isNaN(value)) {
    return null;
  }

  const unit = groups.unit.toLowerCase();
  return unit === "h" ? value * 60 : value;
}

function pickDuration(
  normalized: z.infer<typeof intakeNormalizedSchema>
): number {
  const fromConstraint = parseTimeLimitMinutes(
    normalized.constraints.time_limit ?? null
  );
  if (fromConstraint) {
    return Math.min(
      Math.max(fromConstraint, MIN_CONSTRAINED_BLOCK_MINUTES),
      MAX_CONSTRAINED_BLOCK_MINUTES
    );
  }
  const urgency = normalized.urgency_final ?? normalized.urgency_suggested;
  switch (urgency) {
    case "high":
      return HIGH_URGENCY_BLOCK_MINUTES;
    case "mid":
      return MID_URGENCY_BLOCK_MINUTES;
    default:
      return LOW_URGENCY_BLOCK_MINUTES;
  }
}

function createSlot(
  start: DateTime,
  durationMinutes: number,
  label: string,
  reason: string
) {
  const end = start.plus({ minutes: durationMinutes });
  return schedulingSlotSchema.parse({
    start: start.toISO(),
    end: end.toISO(),
    label,
    reason,
  });
}

export const schedulerStep = createStep({
  id: "scheduler-recommendation",
  description: "カレンダーに登録する時間帯と準備事項を提案する。",
  inputSchema: schedulerInputSchema,
  outputSchema: z.object({
    scheduling: schedulingPlanSchema,
  }),
  execute: async ({ inputData }) => {
    const { normalized, interview, plan, history } = inputData;
    const promptPayload = {
      normalized,
      interview,
      plan,
      history: history ?? [],
      instructions: {
        goal: "タスクをカレンダーに落とし込むための最適な時間帯と準備事項を提案する。日本語で出力し、ISO8601 形式の日付を返す。",
        language: "Japanese",
      },
    };

    try {
      const scheduling = await callBedrockStructured({
        schema: schedulingPlanSchema,
        system:
          "あなたはスケジューラーです。入力された正規化タスクをカレンダーに入れる候補時間を JSON で返してください。start/end は ISO8601, timezone も明示してください。",
        prompt: JSON.stringify(promptPayload, null, 2),
        context: { step: "scheduler-recommendation" },
      });

      return {
        scheduling: {
          ...scheduling,
          followUps: buildSchedulingFollowUps({ normalized, interview, plan }),
        },
      };
    } catch (error) {
      logError("scheduler-recommendation", {
        error: normalizeError(error),
        intent: normalized.intent,
      });
      return {
        scheduling: buildFallbackSchedule(normalized, plan),
      };
    }
  },
});

function buildSchedulingFollowUps({
  normalized,
  interview,
  plan,
}: {
  normalized: z.infer<typeof intakeNormalizedSchema>;
  interview?: z.infer<typeof interviewSchema>;
  plan: z.infer<typeof planSchema>;
}): string[] {
  const followUps: string[] = [];

  if (interview?.followUps?.length) {
    followUps.push(...interview.followUps);
  }

  if (!normalized.constraints.time_limit) {
    followUps.push("実際に確保できる時間を決める");
  }

  if (plan.steps.length > FOLLOW_UP_STEP_THRESHOLD) {
    followUps.push("ブロッカーを1つ解消するための15分タスクを追記");
  }

  return Array.from(new Set(followUps));
}

function buildFallbackSchedule(
  normalized: z.infer<typeof intakeNormalizedSchema>,
  plan: z.infer<typeof planSchema>
) {
  const durationMinutes = pickDuration(normalized);
  const timezone = normalized.timezone ?? "UTC";
  const now = DateTime.now().setZone(timezone);

  let anchor = normalized.deadline
    ? DateTime.fromISO(normalized.deadline).setZone(timezone)
    : now.plus({ days: 2 });
  if (!anchor.isValid) {
    anchor = now.plus({ days: 2 });
  }

  let primaryStart = anchor.minus({ hours: 24 }).startOf("hour");
  if (primaryStart < now.plus({ hours: 2 })) {
    primaryStart = now.plus({ hours: 2 }).startOf("hour");
  }

  const preferredWindow = primaryStart.set({
    minute: primaryStart.minute < HALF_HOUR_MINUTES ? 0 : HALF_HOUR_MINUTES,
  });
  primaryStart = preferredWindow;

  const primary = createSlot(
    primaryStart,
    durationMinutes,
    "メインブロック",
    normalized.deadline
      ? "期限の24時間前に着手してリスクを減らす"
      : "最初のまとまった時間として早期に着手"
  );

  const fallbackMorning = createSlot(
    primaryStart.plus({ days: 1 }).set({ hour: 9, minute: 0 }),
    durationMinutes,
    "第2候補",
    "翌日の午前帯で静かな時間を確保"
  );

  const fallbackEvening = createSlot(
    primaryStart.plus({ days: 1 }).set({ hour: 19, minute: 0 }),
    durationMinutes,
    "第3候補",
    "就業後や家事後に集中できる時間帯"
  );

  const preparation: string[] = [];
  if (normalized.constraints.resources.length > 0) {
    preparation.push(
      `事前に準備する: ${normalized.constraints.resources.join(", ")}`
    );
  }
  if (!normalized.constraints.time_limit) {
    preparation.push("所要時間をカレンダー概要にメモし、終了後に実績を記録");
  }
  preparation.push("ブロック説明に完了条件と次アクションへのリンクを記載");

  const calendarNote = [
    `目的: ${normalized.intent}`,
    `種類: ${getTaskTypeLabel(normalized.type)}`,
    `完了条件: ${plan.steps.at(-1)?.definitionOfDone ?? "最初の5分完了"}`,
    `参考ステップ: ${plan.steps.map((step) => step.title).join(" → ")}`,
  ].join("\n");

  const base = schedulingPlanSchema.parse({
    title: normalized.intent,
    timezone,
    durationMinutes,
    primary,
    fallbacks: [fallbackMorning, fallbackEvening],
    preparation,
    calendarNote,
  });

  return {
    ...base,
    followUps: buildSchedulingFollowUps({ normalized, plan }),
  };
}
