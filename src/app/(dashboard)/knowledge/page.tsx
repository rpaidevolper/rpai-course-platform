import Link from "next/link";
import { MODULES } from "@/lib/blueprint/modules";
import { formatDateTime } from "@/lib/dashboard/format";
import { parseBrowseFilter } from "@/lib/dashboard/knowledge";
import { browseKnowledge } from "@/lib/knowledge/browse";
import { MAX_QUERY_CHARS } from "@/lib/knowledge/search";
import { createSupabaseKnowledgeStore } from "@/lib/knowledge/store";
import { KNOWLEDGE_KIND_LABELS, KNOWLEDGE_KINDS } from "@/lib/knowledge/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Button, Card, Empty, Field, PageHeader, SectionTitle, Select, TextInput } from "../../_components/ui";
import { requireSignedIn } from "../session";

/**
 * 知識庫（唯讀）：AI 查得到的模組框架、模組卡、單元卡與課程配方，依種類分組，可用種類、模組、關鍵字篩選。
 * 暫停使用（含客戶名稱）的文件只顯示份數。真相來源是維護者本機的資料夾，這裡不能編輯。
 */
export default async function KnowledgePage({ searchParams }: PageProps<"/knowledge">) {
  await requireSignedIn("/knowledge");

  const filter = parseBrowseFilter(await searchParams);
  const docs = await createSupabaseKnowledgeStore(createAdminClient()).list({});
  const { groups, counts, lastChangedAt } = browseKnowledge(docs, filter);

  const available = KNOWLEDGE_KINDS.map((kind) => `${KNOWLEDGE_KIND_LABELS[kind]} ${counts[kind].available}`).join("・");
  const paused = KNOWLEDGE_KINDS.reduce((sum, kind) => sum + counts[kind].paused, 0);
  const filtered = filter.kind !== undefined || filter.module !== undefined || filter.query !== undefined;

  return (
    <>
      <PageHeader
        title="知識庫"
        description={
          <>
            <p>團隊共用的知識庫，講師的 AI 查得到的就是這些。內容來自維護者本機的資料夾，用 pnpm kb:sync 同步，這裡不能編輯。</p>
            <p className="mt-1 text-body-muted">
              {available}
              {lastChangedAt && `・內容最後更新 ${formatDateTime(lastChangedAt)}`}
            </p>
            {paused > 0 && (
              <p className="mt-1 text-body-muted">另有 {paused} 份含客戶名稱，暫停使用，不顯示。</p>
            )}
          </>
        }
      />

      <form action="/knowledge" className="mb-8 grid gap-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <Field label="種類">
          <Select name="kind" defaultValue={filter.kind ?? ""}>
            <option value="">全部</option>
            {KNOWLEDGE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KNOWLEDGE_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="模組">
          <Select name="module" defaultValue={filter.module ?? ""}>
            <option value="">全部</option>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="關鍵字">
          <TextInput type="search" name="q" defaultValue={filter.query ?? ""} maxLength={MAX_QUERY_CHARS} placeholder="例如 GAS 觸發器" />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit">篩選</Button>
          {filtered && (
            <Link href="/knowledge" className="text-sm font-bold text-accent underline underline-offset-2 hover:text-accent-press">
              清除
            </Link>
          )}
        </div>
      </form>

      {groups.length === 0 ? (
        <Empty>{docs.length === 0 ? "知識庫還是空的。維護者跑過 pnpm kb:sync 之後就會出現。" : "沒有符合篩選的文件。"}</Empty>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.kind}>
              <SectionTitle aside={`${group.items.length} 份`}>{group.label}</SectionTitle>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <Link
                          href={`/knowledge/${item.id}`}
                          className="min-w-0 break-words font-bold text-ink underline-offset-2 hover:text-accent hover:underline"
                        >
                          {item.title}
                        </Link>
                        {item.modules.length > 0 && (
                          <span className="flex flex-wrap gap-1.5">
                            {item.modules.map((m) => (
                              <Badge key={m}>{m}</Badge>
                            ))}
                          </span>
                        )}
                      </div>
                      {item.snippet && <p className="mt-2 break-words text-sm text-body-muted">{item.snippet}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
