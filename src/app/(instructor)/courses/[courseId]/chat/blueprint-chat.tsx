"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { openingMessage, reviseBlueprint, revisionNote, scriptedReply, type ChatMessage } from "@/lib/mockup/chat-script";
import { getCourse, getProject, latestBlueprintVersion, unitSourceText } from "@/lib/mockup/logic";
import { dispatch, useDemoState, useHydrated } from "@/lib/mockup/store";
import type { Course } from "@/lib/mockup/types";
import { BlueprintPanel } from "../../../../_components/blueprint-panel";
import { toast } from "../../../../_components/demo-runtime";
import { Breadcrumb, Button, ButtonLink, CARD, DemoMissing, PageHeader } from "../../../../_components/ui";

/** 跟 AI 談藍圖（#48 demo）：腳本式對話，不呼叫任何 AI。 */
export function BlueprintChat({ courseId }: { courseId: string }) {
  const st = useDemoState();
  const hydrated = useHydrated();
  const course = getCourse(st, courseId);
  // hydration 前是 fixture 的藍圖，可能和 localStorage 裡的不同；等讀到真正的狀態再開場
  if (!course || !hydrated) return <DemoMissing what="課程" loading={!hydrated} />;

  const project = getProject(st, course.projectId);
  const version = latestBlueprintVersion(course);

  return (
    <>
      <Breadcrumb
        items={[
          ...(project ? [{ label: project.title, href: `/projects/${project.id}` }] : []),
          { label: course.title, href: `/courses/${course.id}` },
          { label: "談藍圖" },
        ]}
      />
      <PageHeader
        title="跟 AI 談藍圖"
        description={
          <p>
            談完按「更新藍圖」，藍圖會升到 v{version + 1}。課程大綱、逐頁腳本、簡報、學員手冊都讀藍圖，不讀這段對話。
          </p>
        }
      >
        <ButtonLink href={`/courses/${course.id}#blueprint`} variant="secondary">
          回課程
        </ButtonLink>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Conversation key={course.id} course={course} />
        <section aria-labelledby="blueprint-heading" className={`${CARD} min-w-0 p-5`}>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 id="blueprint-heading" className="text-sm font-bold text-navy">
              目前的藍圖
            </h2>
            <span className="text-xs text-body-muted">v{version}</span>
          </div>
          <BlueprintPanel blueprint={course.blueprint} sourceLabel={(s) => unitSourceText(st, s)} />
        </section>
      </div>
    </>
  );
}

function Conversation({ course }: { course: Course }) {
  // 開場只在掛上時算一次：之後藍圖升版，舊的對話仍保留原本的脈絡
  const [messages, setMessages] = useState<ChatMessage[]>(() => [openingMessage(course.blueprint)]);
  /** 上次更新藍圖之後，講師說了哪些話 */
  const [pending, setPending] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [updatedTo, setUpdatedTo] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "instructor", text }, scriptedReply(course.blueprint, pending.length, text)]);
    setPending((prev) => [...prev, text]);
    setDraft("");
  };

  const update = () => {
    if (pending.length === 0) return;
    const before = course.blueprint;
    const blueprint = reviseBlueprint(before, pending);
    const note = revisionNote(before, blueprint);
    // dispatch 之後這個 render 的 course 不會變，先算好新版號與要不要提過期
    const next = latestBlueprintVersion(course) + 1;
    const hasArtifacts = course.artifacts.length > 0;
    dispatch({ type: "blueprint/revise", courseId: course.id, blueprint, note });
    toast(
      hasArtifacts
        ? `藍圖已升到 v${next}，原本的產物已標為過期，記得定稿後再產逐頁腳本`
        : `藍圖已升到 v${next}，記得定稿後再產逐頁腳本`,
    );
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `已整理成藍圖 v${next}：${note}。\n${
          hasArtifacts
            ? "原本的產物都出自舊版，已標為過期。回課程頁把新藍圖定稿，再重新產逐頁腳本。"
            : "回課程頁把藍圖定稿，就能產逐頁腳本。"
        }`,
      },
    ]);
    setPending([]);
    setUpdatedTo(next);
  };

  return (
    <section aria-labelledby="chat-heading" className={`${CARD} flex min-w-0 flex-col p-5`}>
      <h2 id="chat-heading" className="text-sm font-bold text-navy">
        對話
      </h2>
      <p className="mt-1 text-xs text-body-muted">demo：AI 的回覆是預先寫好的腳本，不會真的呼叫 AI。</p>

      <div ref={listRef} aria-live="polite" className="mt-3 max-h-[32rem] min-h-[16rem] space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap break-words rounded-md p-3 text-sm ${
              m.role === "instructor" ? "ml-auto bg-navy-tint text-navy" : "bg-iced"
            }`}
          >
            <span className="sr-only">{m.role === "instructor" ? "你：" : "AI："}</span>
            {m.text}
          </div>
        ))}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          對話內容
        </label>
        <input
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="輸入你的想法…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md bg-iced px-3 py-2 text-sm text-navy placeholder:text-body-muted"
        />
        <Button type="submit" disabled={!draft.trim()}>
          送出
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-iced pt-4">
        <Button onClick={update} disabled={pending.length === 0} title={pending.length === 0 ? "先跟 AI 說點什麼" : undefined}>
          更新藍圖
        </Button>
        {updatedTo !== null && pending.length === 0 ? (
          <p className="text-sm">
            已升到 v{updatedTo}。
            <Link href={`/courses/${course.id}#blueprint`} className="font-bold text-navy underline underline-offset-2">
              回課程頁看藍圖
            </Link>
          </p>
        ) : (
          <p className="text-xs text-body-muted">
            {pending.length === 0 ? "先回答 AI 的問題，再整理成新版藍圖。" : `會把這 ${pending.length} 句話整理進新版藍圖。`}
          </p>
        )}
      </div>
    </section>
  );
}
