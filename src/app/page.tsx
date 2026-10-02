import { CoursePrototype } from "./_components/course-prototype";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-wide text-body/70">
          RPAI 數位優化器
        </p>
        <h1 className="mt-1 text-2xl font-bold text-navy">
          RPAI Course Platform
        </h1>
        <p className="mt-2 max-w-2xl text-sm">
          先跟 AI 討論出教學藍圖，再從同一份藍圖生成課程大綱、簡報與學員手冊。
        </p>
        <p className="mt-3 inline-block rounded-full bg-warning-tint px-3 py-1 text-xs font-bold text-warning">
          雛形：對話為預寫腳本，未連接 AI
        </p>
      </header>
      <CoursePrototype />
    </main>
  );
}
