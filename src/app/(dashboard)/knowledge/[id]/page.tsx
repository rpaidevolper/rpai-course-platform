import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readKnowledgeDocument } from "@/lib/dashboard/knowledge";
import { createSupabaseKnowledgeStore } from "@/lib/knowledge/store";
import { KNOWLEDGE_KIND_LABELS, type FrontmatterValue } from "@/lib/knowledge/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Breadcrumb, Card, Facts, PageHeader } from "../../../_components/ui";
import { requireSignedIn } from "../../session";

/** frontmatter 欄位的中文；沒列到的照原樣顯示。 */
const FIELD_LABELS: Record<string, string> = {
  id: "代號",
  module: "模組",
  modules: "模組",
  minutes: "分鐘",
  hours: "時數",
  industry: "產業",
  industries: "產業",
  status: "狀態",
  audience: "對象",
  tools: "工具",
  units: "單元卡",
  extract: "抽取方式",
};

/** 知識庫單篇頁（唯讀）：標題、種類、模組、frontmatter 與本文。暫停使用或退役的文件回 404。 */
export default async function KnowledgeDocumentPage({ params }: PageProps<"/knowledge/[id]">) {
  const { id } = await params;
  await requireSignedIn(`/knowledge/${id}`);

  const doc = await readKnowledgeDocument(createSupabaseKnowledgeStore(createAdminClient()), id);
  if (doc === null) notFound();

  const facts = Object.entries(doc.frontmatter)
    .filter(([key]) => key !== "title")
    .map(([key, value]): [string, string] => [FIELD_LABELS[key] ?? key, formatValue(value)]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "知識庫", href: "/knowledge" }, { label: doc.title }]} />
      <PageHeader
        title={doc.title}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="outline">{KNOWLEDGE_KIND_LABELS[doc.kind]}</Badge>
            {doc.modules.map((m) => (
              <Badge key={m}>{m}</Badge>
            ))}
          </span>
        }
      />
      {facts.length > 0 && (
        <Card>
          <Facts items={facts} />
        </Card>
      )}
      <Card>
        <div className="space-y-3 break-words text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
            {doc.body}
          </ReactMarkdown>
        </div>
      </Card>
    </div>
  );
}

function formatValue(value: FrontmatterValue): string {
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((v) => formatValue(v)).join("、");
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

/** 本文的 Markdown 樣式。react-markdown 預設不渲染原始 HTML。 */
const MARKDOWN_COMPONENTS: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <h2 className="pt-2 text-lg font-bold text-ink">{children}</h2>,
  h2: ({ children }) => <h3 className="pt-2 text-base font-bold text-ink">{children}</h3>,
  h3: ({ children }) => <h4 className="pt-1 font-bold text-ink">{children}</h4>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  a: ({ children, href }) => (
    <a href={href} className="text-accent underline underline-offset-2" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-layer px-1 py-0.5 text-xs">{children}</code>,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b-2 border-layer px-2 py-1.5 font-bold text-ink">{children}</th>,
  td: ({ children }) => <td className="border-b border-layer px-2 py-1.5 align-top">{children}</td>,
};
