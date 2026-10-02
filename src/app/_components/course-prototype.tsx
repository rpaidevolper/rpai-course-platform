"use client";

import { useState } from "react";
import type { Blueprint } from "@/lib/blueprint/schema";
import { TOPICS, type TopicId } from "@/lib/prototype/catalog";
import {
  openingMessage,
  prototypeBlueprint,
  scriptedReply,
  type ChatMessage,
} from "@/lib/prototype/script";
import { BlueprintPanel } from "./blueprint-panel";

const ARTIFACTS = ["課程大綱", "簡報", "學員手冊"] as const;

const PRIMARY =
  "rounded-md bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-press disabled:cursor-not-allowed disabled:bg-navy-tint disabled:text-navy/50";

/** UI 雛形（#17）：腳本式對話，不呼叫任何 API。 */
export function CoursePrototype() {
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;

  function selectTopic(next: TopicId) {
    setTopic(next);
    setMessages([openingMessage(next)]);
    setBlueprint(null);
    setDraft("");
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!topic || !text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      scriptedReply(topic, userTurns),
    ]);
    setDraft("");
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="topic-heading">
        <h2 id="topic-heading" className="text-sm font-bold text-navy">
          1. 這次課程的主題
        </h2>
        <p className="mt-1 text-sm">
          選了主題，後續對話才能推薦過去上過的相近課程模組。
        </p>
        <div role="radiogroup" aria-labelledby="topic-heading" className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={topic === t.id}
              onClick={() => selectTopic(t.id)}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                topic === t.id
                  ? "bg-navy text-white"
                  : "bg-navy-tint text-navy hover:bg-iced"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="chat-heading"
          className="flex min-h-[28rem] flex-col rounded-lg bg-white p-5 shadow-[0_3px_16px_rgba(1,20,85,0.06)]"
        >
          <h2 id="chat-heading" className="text-sm font-bold text-navy">
            2. 跟 AI 談出教學藍圖
          </h2>

          <div
            className="mt-3 flex-1 space-y-3 overflow-y-auto"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <p className="rounded-md bg-iced p-3 text-sm">
                請先在上方選擇主題，對話才會開始。
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-md p-3 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-navy-tint text-navy"
                    : "bg-iced"
                }`}
              >
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
              disabled={!topic}
              placeholder={topic ? "輸入你的想法…" : "請先選擇主題"}
              className="min-w-0 flex-1 rounded-md bg-iced px-3 py-2 text-sm text-navy placeholder:text-body/60 disabled:cursor-not-allowed"
            />
            <button type="submit" disabled={!topic || !draft.trim()} className={PRIMARY}>
              送出
            </button>
          </form>
        </section>

        <section
          aria-labelledby="blueprint-heading"
          className="flex flex-col rounded-lg bg-white p-5 shadow-[0_3px_16px_rgba(1,20,85,0.06)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="blueprint-heading" className="text-sm font-bold text-navy">
              3. 教學藍圖
            </h2>
            <button
              type="button"
              disabled={!topic || userTurns === 0}
              onClick={() => topic && setBlueprint(prototypeBlueprint(topic))}
              className={PRIMARY}
            >
              更新藍圖
            </button>
          </div>

          <div className="mt-4 flex-1">
            {blueprint ? (
              <BlueprintPanel blueprint={blueprint} />
            ) : (
              <p className="rounded-md bg-iced p-3 text-sm">
                對話一陣子後按「更新藍圖」，這裡會整理出受眾、學習成果、五元素與單元。
              </p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-bold tracking-wide text-body/70">
              從這份藍圖產出
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {ARTIFACTS.map((name) => (
                <button key={name} type="button" disabled className={PRIMARY}>
                  生成{name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs">
              尚未接上產檔佇列。實際產檔會在講師自己的 Claude Code 裡，用 RPAI 課程 skill 完成。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
