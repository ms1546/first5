"use client";

import type { WorkflowOutput } from "@/src/mastra/schemas/plan";
import { useAssistantFlow } from "../hooks/use-assistant-flow";

export default function AppPage() {
  const {
    input,
    setInput,
    loading,
    pendingQuestion,
    placeholder,
    handleSubmit,
    handleReset,
    hasHistory,
    latestScheduling,
    notice,
  } = useAssistantFlow();

  let buttonLabel = "送信";
  if (loading) {
    buttonLabel = "送信中...";
  } else if (pendingQuestion) {
    buttonLabel = "回答を送る";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
          考え中です…
        </div>
      ) : null}

      {notice ? (
        <div
          className={`rounded-md px-3 py-2 text-xs ${
            notice.type === "error"
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-zinc-200 bg-white text-zinc-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {pendingQuestion ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 text-sm">
          {pendingQuestion}
        </div>
      ) : null}

      {latestScheduling ? (
        <SchedulingGlance scheduling={latestScheduling} />
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <textarea
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
          disabled={loading}
          id="task"
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          required
          rows={2}
          style={{ color: "#09090b", backgroundColor: "#ffffff" }}
          value={input}
        />
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={loading}
            type="submit"
          >
            {buttonLabel}
          </button>
          {hasHistory ? (
            <button
              className="font-medium text-xs text-zinc-500 underline-offset-4 hover:underline"
              onClick={handleReset}
              type="button"
            >
              リセット
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function SchedulingGlance({
  scheduling,
}: {
  scheduling: WorkflowOutput["scheduling"];
}) {
  const start = new Date(scheduling.primary.start).toLocaleString();
  const end = new Date(scheduling.primary.end).toLocaleString();

  return (
    <section className="rounded-lg border border-purple-200 bg-purple-50 p-5 text-purple-900 text-sm shadow-sm">
      <h2 className="font-semibold text-purple-700">ドラフト予定</h2>
      <p className="mt-2">タイトル: {scheduling.title}</p>
      <p>
        候補: {start} 〜 {end} ({scheduling.timezone})
      </p>
      <div className="mt-3">
        <h3 className="font-semibold text-purple-600 text-xs uppercase tracking-wide">
          カレンダーメモ
        </h3>
        <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-3 text-purple-900 text-xs">
          {scheduling.calendarNote}
        </pre>
      </div>
      {scheduling.followUps && scheduling.followUps.length > 0 ? (
        <div className="mt-3 rounded-md border border-purple-300 bg-white p-3 text-purple-900 text-xs">
          <p className="font-semibold text-purple-600">TODO</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {scheduling.followUps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
