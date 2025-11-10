export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-20">
      <div className="flex max-w-2xl flex-col gap-8 text-center sm:text-left">
        <h1 className="font-semibold text-4xl text-zinc-900">
          最初の5分で動き出せるタスクランチャー
        </h1>
        <p className="text-zinc-600">
          1行入力を正規化し、プランニング・レビュー・コーチングまで自動化。ログイン後は{" "}
          <code className="rounded bg-zinc-200 px-2 py-1 text-sm text-zinc-800">
            /app
          </code>{" "}
          から利用できます。
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <a
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 font-medium text-sm text-white transition hover:bg-zinc-700"
            href="/app"
          >
            アプリを開く
          </a>
          <span className="text-xs text-zinc-500 uppercase tracking-wide">
            Cognito Hosted UI 連携予定
          </span>
        </div>
      </div>
    </div>
  );
}
