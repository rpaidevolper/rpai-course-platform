"use client";

import { downloadPlaceholder } from "@/lib/mockup/download";
import { dayTimeText, formatDate, formatDateTime, portalView, VENUE_UNSET } from "@/lib/mockup/logic";
import { useDemoState, useHydrated } from "@/lib/mockup/store";
import { Badge, Button, CARD } from "../../../_components/ui";

const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

/**
 * 學員入口。只用 portalView 取資料（型別上不含專案與價格），不要在這裡讀其他 demo 資料。
 * 從 store 渲染，講師在另一個分頁發布或關閉，這裡會跟著更新。
 */
export function StudentPortal({ code }: { code: string }) {
  const st = useDemoState();
  const hydrated = useHydrated();
  const view = portalView(st, code, st.now);

  if (!view) {
    if (!hydrated) return <p className="text-sm text-body-muted">載入中…</p>;
    return (
      <div className={`${CARD} p-6`}>
        <h1 className="text-lg font-bold text-navy">找不到這個頁面</h1>
        <p className="mt-2 text-sm">連結可能打錯了，或這一場已經不存在，請跟講師確認。</p>
      </div>
    );
  }

  const multiDay = view.days.length > 1;
  const closedMessage = {
    unpublished: "講師還在準備，發布後這裡就會出現上課需要的東西。",
    expired: `這一場課的資料已經在 ${formatDate(view.expiresAt)} 下架，需要的話請聯絡講師。`,
    closed: "講師已關閉這個頁面。",
    open: "",
  }[view.state];

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-bold text-body-muted">RPAI 數位優化器</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">{view.courseTitle}</h1>
        <ol className="mt-3 space-y-1.5 text-sm">
          {view.days.map((d) => {
            const current = multiDay && d.day === view.day;
            return (
              <li
                key={d.day}
                aria-current={current ? "date" : undefined}
                className={`flex flex-wrap gap-x-3 gap-y-0.5 ${current ? "border-l-[3px] border-navy pl-2" : ""}`}
              >
                {multiDay && <span className="shrink-0 font-bold text-navy">第 {d.day} 天</span>}
                <span className="text-navy">{dayTimeText(d)}</span>
                <span className={d.venue === null ? "font-bold text-warning" : "text-navy"}>{d.venue ?? VENUE_UNSET}</span>
              </li>
            );
          })}
        </ol>
      </header>

      {view.state !== "open" ? (
        <section aria-labelledby="notice" className={`${CARD} border-l-[3px] border-navy p-5`}>
          <h2 id="notice" className="sr-only">
            頁面狀態
          </h2>
          <p className="text-base text-navy">{closedMessage}</p>
        </section>
      ) : (
        <div className="space-y-8">
          {view.links.length > 0 && (
            <section aria-labelledby="links">
              <h2 id="links" className="mb-3 text-lg font-bold text-navy">
                課堂連結
              </h2>
              <ul className="space-y-3">
                {view.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`${CARD} block border-l-[3px] border-navy px-5 py-4 hover:bg-navy-tint`}
                    >
                      <span className="block text-lg font-bold text-navy">{l.label}</span>
                      <span className="mt-0.5 block break-all text-xs text-body-muted">{l.url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="artifacts">
            <h2 id="artifacts" className="mb-3 text-lg font-bold text-navy">
              {multiDay ? `第 ${view.day} 天的上課教材` : "上課教材"}
            </h2>
            {multiDay && <p className="mb-3 text-sm">每一天的簡報會在那一天出現；學員手冊整門課共用一份。</p>}
            {view.artifacts.length === 0 ? (
              <p className="text-sm">講師還沒有放上教材。</p>
            ) : (
              <ul className="space-y-2">
                {view.artifacts.map((a) => (
                  <li key={a.id} className={`${CARD} flex items-center justify-between gap-3 px-5 py-4`}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-bold text-navy">{a.label}</span>
                      <Badge>v{a.version}</Badge>
                    </div>
                    <Button
                      onClick={() =>
                        downloadPlaceholder(`${view.courseTitle}－${a.label} v${a.version}`, [
                          `課程：${view.courseTitle}`,
                          `教材：${a.label}`,
                          `版本：v${a.version}`,
                        ])
                      }
                    >
                      下載
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="materials">
            <h2 id="materials" className="mb-3 text-lg font-bold text-navy">
              課程素材
            </h2>
            {view.materials.length === 0 ? (
              <p className="text-sm">這一場沒有額外素材。</p>
            ) : (
              <ul className="space-y-2">
                {view.materials.map((m) => (
                  <li key={m.id} className={`${CARD} flex items-center justify-between gap-3 px-5 py-4`}>
                    <div className="min-w-0">
                      <span className="block break-words text-sm font-bold text-navy">{m.name}</span>
                      <span className="text-xs text-body-muted">{formatSize(m.sizeKb)}</span>
                    </div>
                    <Button
                      onClick={() =>
                        downloadPlaceholder(m.name, [`課程：${view.courseTitle}`, `素材：${m.name}`, `大小：${formatSize(m.sizeKb)}`])
                      }
                    >
                      下載
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {view.state === "open" && <p className="mt-10 text-xs text-body-muted">此頁可用到 {formatDateTime(view.expiresAt)}</p>}
    </>
  );
}
