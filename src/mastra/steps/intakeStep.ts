import { createStep } from '@mastra/core/workflows';
import {
  intakeStepOutputSchema,
  workflowInputSchema,
} from '../schemas/intake';
import {
  classifyTask,
  inferHorizon,
  inferUrgency,
  normalizeDeadline,
} from '../utils/classification';
import { getHorizonLabel, getTaskTypeLabel, getUrgencyLabel } from '../utils/labels';

export const intakeStep = createStep({
  id: 'intake-normalization',
  description: '自由入力をIntakeNormalized形式へ整形する。',
  inputSchema: workflowInputSchema,
  outputSchema: intakeStepOutputSchema,
  execute: async ({ inputData }) => {
    const {
      task,
      userDeadline,
      userUrgency,
      timezone,
      minutesAvailable,
      preferredPlace,
      requiredResources,
      notes,
    } = inputData;

    const classification = classifyTask(task);
    const normalizedDeadline = normalizeDeadline(userDeadline ?? null, timezone);
    const urgencySuggested = inferUrgency({
      task,
      deadline: normalizedDeadline,
      userUrgency,
    });
    const horizon = inferHorizon({
      deadline: normalizedDeadline,
      minutesAvailable,
      type: classification.type,
    });

    const resources = Array.from(new Set(requiredResources ?? [])).filter(Boolean);

    const normalized = {
      intent: task.trim(),
      type: classification.type,
      deadline: normalizedDeadline,
      urgency_suggested: urgencySuggested,
      urgency_final: userUrgency,
      horizon,
      constraints: {
        time_limit: minutesAvailable ? `${minutesAvailable}m` : null,
        place: preferredPlace ?? null,
        resources,
      },
      notes: notes ?? null,
    } as const;

    const confidence = classification.detectedKeywords.length > 0 ? 0.7 : 0.4;
    const typeLabel = getTaskTypeLabel(classification.type);
    const urgencyLabel = getUrgencyLabel(urgencySuggested);
    const horizonLabel = getHorizonLabel(horizon);
    const formattedDeadline = normalizedDeadline ? formatDeadline(normalizedDeadline) : null;

    return {
      normalized,
      heuristics: {
        detectedKeywords: classification.detectedKeywords,
        confidence,
        rationale: [
          `分類: ${typeLabel}`,
          formattedDeadline ? `期限: ${formattedDeadline}` : '期限: 未設定',
          `推奨緊急度: ${urgencyLabel}`,
          `想定タイムスパン: ${horizonLabel}`,
        ],
      },
    };
  },
});

function formatDeadline(isoString: string): string | null {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
