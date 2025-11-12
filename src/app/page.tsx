export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-20">
      <div className="flex max-w-2xl flex-col gap-8 text-center sm:text-left">
        <h1 className="text-4xl font-semibold text-zinc-900">
          最初の1行から予定まで一気に進める、日常タスクランチャー
        </h1>
        <p className="text-zinc-600">
          いま抱えていることを一言で入力するだけで、Intake → Planner → Critic → Coach の
          マルチエージェントが予定案と「最初の5分」を自動生成します。ログイン後は
          <code className="mx-1 rounded bg-zinc-200 px-2 py-1 text-sm text-zinc-800">/app</code>
          から利用可能です。
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <a
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
            href="/auth/login"
          >
            サインインして使う
          </a>
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Cognito Hosted UI で安全にリダイレクトされます
          </span>
        </div>
      </div>
    </div>
  );
}
