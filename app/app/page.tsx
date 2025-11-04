'use client';

import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import type { WorkflowOutput } from '@/src/mastra/schemas/plan';
import { HORIZON_LABELS, TASK_TYPE_LABELS, URGENCY_LABELS } from '@/src/mastra/utils/labels';

const URGENCY_OPTIONS = [
  { value: '', label: '自動判定' },
  { value: 'high', label: '高 (High)' },
  { value: 'mid', label: '中 (Mid)' },
  { value: 'low', label: '低 (Low)' },
];
const STATUS_LABELS: Record<string, string> = {
  success: '成功',
  pending: '待機中',
  running: '実行中',
  error: 'エラー',
};

const STEP_LABELS: Record<string, string> = {
  'intake-normalization': 'Intake整形',
  'planner-breakdown': 'プラン作成',
  'critic-review': 'レビュー',
  'coach-script': 'コーチング',
};

const RISK_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

const SEVERITY_LABELS: Record<string, string> = {
  info: '情報',
  warning: '注意',
  error: '重大',
};

type WorkflowStepExecution = {
  id: string;
  status: string;
  output?: unknown;
  startedAt?: number;
  endedAt?: number;
};

type WorkflowRunResponse = {
  status: string;
  result: WorkflowOutput;
  steps: Record<string, WorkflowStepExecution>;
};

type FormState = {
  task: string;
  userDeadline: string;
  userUrgency: string;
  minutesAvailable: string;
  preferredPlace: string;
  requiredResources: string;
  notes: string;
};

const initialFormState: FormState = {
  task: '',
  userDeadline: '',
  userUrgency: '',
  minutesAvailable: '',
  preferredPlace: '',
  requiredResources: '',
  notes: '',
};

function getStepTitle(stepId: string, fallback?: string): string {
  if (STEP_LABELS[stepId]) {
    return STEP_LABELS[stepId];
  }
  if (stepId.startsWith('mapping')) {
    return 'データ整形';
  }
  if (stepId.startsWith('intake')) {
    return STEP_LABELS['intake-normalization'];
  }
  if (stepId.startsWith('planner')) {
    return STEP_LABELS['planner-breakdown'];
  }
  if (stepId.startsWith('critic')) {
    return STEP_LABELS['critic-review'];
  }
  if (stepId.startsWith('coach')) {
    return STEP_LABELS['coach-script'];
  }
  return fallback ?? stepId;
}

function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildPayload(form: FormState) {
  const payload: Record<string, unknown> = {
    task: form.task.trim(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  if (form.userDeadline) {
    const iso = new Date(`${form.userDeadline}T00:00:00`).toISOString();
    payload.userDeadline = iso;
  }

  if (form.userUrgency) {
    payload.userUrgency = form.userUrgency;
  }

  if (form.minutesAvailable) {
    const minutes = Number.parseInt(form.minutesAvailable, 10);
    if (!Number.isNaN(minutes)) {
      payload.minutesAvailable = minutes;
    }
  }

  if (form.preferredPlace) {
    payload.preferredPlace = form.preferredPlace.trim();
  }

  if (form.requiredResources) {
    const resources = form.requiredResources
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (resources.length > 0) {
      payload.requiredResources = resources;
    }
  }

  if (form.notes) {
    payload.notes = form.notes.trim();
  }

  return payload;
}

function StepList({ steps }: { steps: Array<[string, WorkflowStepExecution]> }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {steps.map(([stepId, step]) => (
        <details
          key={stepId}
          className="rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm"
          open={step.status !== 'success'}
        >
          <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
            {getStepTitle(step.id ?? stepId, stepId)}
            <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {translateStatus(step.status)}
            </span>
          </summary>
          <pre className="mt-3 overflow-x-auto rounded bg-zinc-50 p-3 text-xs text-zinc-700">
            {JSON.stringify(step.output ?? {}, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}

function ResultPanel({ data }: { data: WorkflowRunResponse }) {
  const stepEntries = useMemo(() => Object.entries(data.steps ?? {}), [data.steps]);
  const { normalized, plan, review, coaching } = data.result;
  const typeLabel = TASK_TYPE_LABELS[normalized.type] ?? normalized.type;
  const urgencyValue = normalized.urgency_final ?? normalized.urgency_suggested;
  const urgencyLabel = URGENCY_LABELS[urgencyValue] ?? urgencyValue;
  const horizonLabel = HORIZON_LABELS[normalized.horizon] ?? normalized.horizon;
  const deadlineText = formatDateTime(normalized.deadline) ?? '未設定';
  const riskLabel = RISK_LABELS[review.riskLevel] ?? review.riskLevel;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">正規化結果</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm text-zinc-700 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">意図</dt>
            <dd>{normalized.intent}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">分類</dt>
            <dd>
              {typeLabel} <span className="text-xs text-zinc-400">({normalized.type})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">緊急度</dt>
            <dd>
              {urgencyLabel} <span className="text-xs text-zinc-400">({urgencyValue})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">タイムスパン</dt>
            <dd>
              {horizonLabel} <span className="text-xs text-zinc-400">({normalized.horizon})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">期限</dt>
            <dd>{deadlineText}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">プラン</h2>
        <p className="mt-2 text-sm text-zinc-700">{plan.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
          {plan.focus.map((item, index) => (
            <span key={index} className="rounded-full bg-zinc-100 px-3 py-1">
              {item}
            </span>
          ))}
        </div>
        <ul className="mt-4 space-y-3 text-sm text-zinc-700">
          {plan.steps.map((step) => (
            <li key={step.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-800">{step.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{step.description}</p>
              <p className="mt-2 text-xs text-zinc-500">
                完了条件: {step.definitionOfDone} / 目安 {step.estimatedMinutes} 分
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">レビュー</h2>
        <p className="text-sm text-zinc-700">リスクレベル: {riskLabel}</p>
        {review.issues.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {review.issues.map((issue) => {
              const severityLabel = SEVERITY_LABELS[issue.severity] ?? issue.severity;
              return (
                <li key={issue.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="font-medium text-amber-800">
                    <span className="mr-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {severityLabel}
                    </span>
                    {issue.message}
                  </p>
                  {issue.suggestion ? (
                    <p className="mt-1 text-xs text-amber-700">推奨対応: {issue.suggestion}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">指摘事項はありません。</p>
        )}
        <div className="mt-3 text-xs text-zinc-500">
          {review.approvals.map((item) => (
            <span key={item} className="mr-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">コーチング</h2>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
          {coaching.script}
        </pre>
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">ナッジ</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {coaching.nudges.map((nudge, index) => (
              <li key={index}>{nudge}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">チェックポイント</h3>
          <ul className="mt-1 space-y-1 text-sm text-zinc-700">
            {coaching.checkpoints.map((checkpoint, index) => (
              <li key={index}>
                {checkpoint.label}（{checkpoint.minutesOffset}分後）
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">実行トレース</h2>
        <StepList steps={stepEntries} />
      </section>
    </div>
  );
}

export default function AppPage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<WorkflowRunResponse | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.task.trim()) {
      setError('まず1行でタスク内容を入力してください。');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const payload = buildPayload(form);
      const res = await fetch('/api/workflows/first5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data?.error ?? 'ワークフローの実行に失敗しました。';
        setError(typeof message === 'string' ? message : 'ワークフローの実行に失敗しました。');
        return;
      }

      setResponse(data as WorkflowRunResponse);
    } catch (submissionError) {
      console.error(submissionError);
      setError('予期せぬエラーが発生しました。時間をおいて再実行してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(initialFormState);
    setResponse(null);
    setError(null);
    setShowOptions(false);
  };

  const toggleOptions = () => {
    setShowOptions((prev) => !prev);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div>
          <label htmlFor="task" className="text-sm font-medium text-zinc-800">
            まずは1行入力
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            先延ばしにしていることを短く入力してください。キーワードでも構いません。
          </p>
          <textarea
            id="task"
            name="task"
            required
            value={form.task}
            onChange={handleChange}
            rows={3}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
            placeholder="例: 確定申告の準備"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={loading}
          >
            {loading ? '生成中...' : 'プランを生成'}
          </button>
          <button
            type="button"
            onClick={toggleOptions}
            className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
            aria-expanded={showOptions}
            aria-controls="advanced-options"
          >
            {showOptions ? '詳細設定を隠す' : '詳細設定を追加する'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center rounded-md border border-transparent px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            クリア
          </button>
        </div>

        <div
          id="advanced-options"
          className={`${showOptions ? 'grid' : 'hidden'} grid-cols-1 gap-4 border-t border-dashed border-zinc-200 pt-4 text-sm md:grid-cols-2`}
        >
          <div className="space-y-2">
            <label htmlFor="userDeadline" className="text-sm font-medium text-zinc-800">
              希望期限（任意）
            </label>
            <input
              id="userDeadline"
              name="userDeadline"
              type="date"
              value={form.userDeadline}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="userUrgency" className="text-sm font-medium text-zinc-800">
              緊急度（任意）
            </label>
            <select
              id="userUrgency"
              name="userUrgency"
              value={form.userUrgency}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
            >
              {URGENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="minutesAvailable" className="text-sm font-medium text-zinc-800">
              取れる時間（任意・分）
            </label>
            <input
              id="minutesAvailable"
              name="minutesAvailable"
              type="number"
              min={5}
              max={480}
              step={5}
              value={form.minutesAvailable}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="preferredPlace" className="text-sm font-medium text-zinc-800">
              実施場所（任意）
            </label>
            <input
              id="preferredPlace"
              name="preferredPlace"
              type="text"
              value={form.preferredPlace}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
              placeholder="自宅、役所など"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="requiredResources" className="text-sm font-medium text-zinc-800">
              必要リソース（任意・カンマ区切り）
            </label>
            <input
              id="requiredResources"
              name="requiredResources"
              type="text"
              value={form.requiredResources}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
              placeholder="例: 通知書, マイナンバーカード"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium text-zinc-800">
              メモ（任意）
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              value={form.notes}
              onChange={handleChange}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </form>

      <section className="flex-1 overflow-y-auto">
        {response ? (
          <ResultPanel data={response} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500">
            ここにプラン結果が表示されます。
          </div>
        )}
      </section>
    </div>
  );
}
