"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function SignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-zinc-400">로그인 상태 확인 중...</span>;
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Google로 로그인
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {session.error === "RefreshAccessTokenError" ? (
        <span className="text-rose-600 dark:text-rose-400">
          Google 인증이 만료되었습니다 — 다시 로그인해 주세요.
        </span>
      ) : (
        <span className="text-zinc-500 dark:text-zinc-400">{session.user?.email} 로 로그인됨</span>
      )}
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {session.error ? "다시 로그인" : "계정 전환"}
      </button>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        로그아웃
      </button>
    </div>
  );
}
