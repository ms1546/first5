"use client";

import { useState } from "react";
import type { WorkflowOutput } from "@/src/mastra/schemas/plan";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
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

type Notice = { type: "info" | "error"; message: string } | null;

const PLACEHOLDER = "例: 免許更新の予約、確定申告の準備、健康診断の予約";

export function useAssistantFlow() {
  const [input, setInput] = useState("");
  const [baseIntent, setBaseIntent] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [latestScheduling, setLatestScheduling] = useState<
    WorkflowOutput["scheduling"] | null
  >(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);

  const placeholder = pendingQuestion ?? `${PLACEHOLDER}（例: 免許更新の予約）`;
  const hasHistory = conversation.length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setNotice({ type: "error", message: "まず1行で入力してください。" });
      return;
    }

    setNotice(null);

    const userMessage: ConversationMessage = { role: "user", content: trimmed };
    const historyBeforeAssistant = [...conversation, userMessage];

    setLoading(true);
    try {
      const payload = {
        task: baseIntent ?? trimmed,
        history: historyBeforeAssistant,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const res = await fetch("/api/workflows/first5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as WorkflowRunResponse;
      if (!res.ok) {
        const message =
          (data as unknown as { error?: string })?.error ??
          "ワークフローの実行に失敗しました。";
        setNotice({ type: "error", message });
        return;
      }

      const interview = data.result.interview;
      let updatedConversation = historyBeforeAssistant;
      let nextQuestion: string | null = null;

      if (interview.status === "needs_input") {
        const targetField = interview.gaps[0];
        const targetQuestion = interview.questions.find(
          (question) => question.field === targetField
        );
        if (targetQuestion) {
          nextQuestion = targetQuestion.prompt;
          updatedConversation = [
            ...updatedConversation,
            { role: "assistant", content: targetQuestion.prompt },
          ];
          setNotice({
            type: "info",
            message: "もう少しだけヒントを教えてください。",
          });
        }
        setLatestScheduling(null);
      } else {
        setLatestScheduling(data.result.scheduling);
        setNotice({ type: "info", message: "仮の予定を作成しました。" });
      }

      setBaseIntent((prev) => prev ?? trimmed);
      setConversation(updatedConversation);
      setPendingQuestion(nextQuestion ?? interview.nextQuestion ?? null);
      setInput("");
    } catch (_runError) {
      setNotice({
        type: "error",
        message:
          "予期せぬエラーが発生しました。時間をおいて再試行してください。",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setBaseIntent(null);
    setConversation([]);
    setPendingQuestion(null);
    setInput("");
    setLatestScheduling(null);
    setNotice(null);
  };

  return {
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
  };
}
