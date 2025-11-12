import { getSession } from "@/lib/auth/session";

export default async function AppPage() {
  const session = await getSession();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm uppercase tracking-wide text-zinc-500">workspace</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-900">
          1行メモをタスクに変換する
        </h1>
        <p className="mt-2 text-zinc-600">
          {session.user?.email ?? "匿名ユーザー"} としてログイン中です。
          下の入力欄に今日のタスクを一言で書き込み、送信してみてください。
        </p>
      </div>
      <form className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label className="text-sm font-medium text-zinc-700" htmlFor="task">
          いま取り組むこと
        </label>
        <textarea
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none"
          id="task"
          name="task"
          placeholder="例: 免許更新の予約、確定申告の準備、健康診断の予約"
          rows={3}
        />
        <button
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          type="submit"
        >
          ワークフローを開始
        </button>
      </form>
    </div>
  );
}
