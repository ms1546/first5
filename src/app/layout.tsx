import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getSession } from "@/lib/auth/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "first5 - 最初の5分で動き出す",
  description:
    "1行入力を正規化し、プラン・レビュー・コーチングを自動生成するタスクランチャー。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const userLabel = session.user?.name ?? session.user?.email ?? "サインイン済み";

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
              <Link className="font-semibold text-sm uppercase tracking-widest text-zinc-900" href="/">
                first5
              </Link>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>
                  {session.user ? `ようこそ、${userLabel}` : "サインインして開始"}
                </span>
                {session.user ? (
                  <a
                    className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
                    href="/auth/logout"
                  >
                    サインアウト
                  </a>
                ) : (
                  <a
                    className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-zinc-700"
                    href="/auth/login"
                  >
                    サインイン
                  </a>
                )}
              </div>
            </div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
