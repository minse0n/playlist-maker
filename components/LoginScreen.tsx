"use client";

import { signIn } from "next-auth/react";

export default function LoginScreen({ expired }: { expired: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">플레이리스트 메이커</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          노래 목록을 붙여넣으면 유튜브에서 가장 정확한 영상을 찾아 재생목록을 만들어 드려요.
        </p>
      </div>

      {expired && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          Google 인증이 만료되었습니다. 다시 로그인해 주세요.
        </p>
      )}

      <button
        type="button"
        onClick={() => signIn("google")}
        className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Google로 로그인
      </button>

      <p className="text-xs text-zinc-400">
        재생목록을 만들려면 YouTube 계정 접근 권한이 필요합니다. 토큰은 서버의 암호화된 세션에만 저장되며 브라우저에는 전달되지 않습니다.
      </p>
    </main>
  );
}
