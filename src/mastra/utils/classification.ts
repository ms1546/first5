import { DateTime } from 'luxon';
import { Horizon, TaskType, Urgency } from '../schemas/intake';

const TASK_KEYWORDS: Record<TaskType, RegExp[]> = {
  procedure: [
    /(申請|update|renew|submit|tax|税|支払|支払い|契約|手続)/i,
    /(確定申告|tax\s*return|年末調整|マイナンバー|納税)/i,
  ],
  housework: [/(clean|掃除|片付|laundry|洗濯|買い物|shopping|organize)/i],
  study: [/(study|勉強|learn|資格|research|調査|course)/i],
  work: [/(project|client|draft|report|work|資料|会議|meeting)/i],
  health: [/(health|exercise|運動|gym|睡眠|doctor|通院|med|散歩)/i],
  misc: [],
};

const URGENCY_KEYWORDS: RegExp[] = [/(urgent|至急|asap|すぐ|today|今すぐ|今日)/i];

export type ClassificationResult = {
  type: TaskType;
  detectedKeywords: string[];
};

export function classifyTask(task: string): ClassificationResult {
  for (const [type, patterns] of Object.entries(TASK_KEYWORDS) as [TaskType, RegExp[]][]) {
    const match = patterns.find((pattern) => pattern.test(task));
    if (match) {
      return {
        type,
        detectedKeywords: [match.source],
      };
    }
  }

  return {
    type: 'misc',
    detectedKeywords: [],
  };
}

export function inferHorizon({
  deadline,
  minutesAvailable,
  type,
}: {
  deadline: string | null | undefined;
  minutesAvailable?: number;
  type: TaskType;
}): Horizon {
  if (deadline) {
    const diff = DateTime.fromISO(deadline).diffNow('days').days;
    if (Number.isFinite(diff)) {
      if (diff <= 1) return 'same_day';
      if (diff <= 7) return 'weekly';
      if (diff <= 30) return 'monthly';
      return 'long_term';
    }
  }

  if (minutesAvailable && minutesAvailable <= 30) {
    return 'same_day';
  }

  if (type === 'study' || type === 'work') {
    return 'weekly';
  }

  if (type === 'health') {
    return 'monthly';
  }

  return 'long_term';
}

export function inferUrgency({
  task,
  deadline,
  userUrgency,
}: {
  task: string;
  deadline: string | null | undefined;
  userUrgency?: Urgency;
}): Urgency {
  if (userUrgency) return userUrgency;

  if (deadline) {
    const diff = DateTime.fromISO(deadline).diffNow('hours').hours;
    if (Number.isFinite(diff)) {
      if (diff <= 24) return 'high';
      if (diff <= 168) return 'mid';
      return 'low';
    }
  }

  if (URGENCY_KEYWORDS.some((pattern) => pattern.test(task))) {
    return 'high';
  }

  return 'mid';
}

export function normalizeDeadline(deadline?: string | null, timezone?: string): string | null {
  if (!deadline) return null;

  const parsed = DateTime.fromISO(deadline, { zone: timezone });
  if (parsed.isValid) {
    return parsed.toUTC().toISO();
  }

  return null;
}
