import type { Horizon, TaskType, Urgency } from "../schemas/intake";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  procedure: "手続き",
  housework: "家事",
  study: "学習",
  work: "仕事",
  health: "健康",
  misc: "その他",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  high: "高",
  mid: "中",
  low: "低",
};

export const HORIZON_LABELS: Record<Horizon, string> = {
  same_day: "当日",
  weekly: "週次",
  monthly: "月次",
  long_term: "長期",
};

export function getTaskTypeLabel(value: TaskType): string {
  return TASK_TYPE_LABELS[value] ?? value;
}

export function getUrgencyLabel(value: Urgency): string {
  return URGENCY_LABELS[value] ?? value;
}

export function getHorizonLabel(value: Horizon): string {
  return HORIZON_LABELS[value] ?? value;
}
