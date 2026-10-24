import type { Metadata } from "next";
import { requestOrigin } from "@/lib/auth/origin";
import { requireMember } from "@/lib/auth/session";
import { listApiTokens, type ApiTokenRow } from "@/lib/mcp/api-tokens";
import { Badge, Card, Empty, PageHeader, SectionTitle } from "../../_components/ui";
import { revokeTokenAction } from "./actions";
import { CreateTokenForm } from "./create-token-form";
import { RevokeButton } from "./revoke-button";

export const metadata: Metadata = { title: "設定" };

const DATE_TIME = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" });

function formatTime(iso: string | null): string {
  return iso ? DATE_TIME.format(new Date(iso)) : "還沒用過";
}

/** 設定頁：Claude Code 權杖的產生、列出與撤銷（spec.md U6）。 */
export default async function SettingsPage() {
  const { supabase } = await requireMember();
  const [tokens, origin] = await Promise.all([listApiTokens(supabase), requestOrigin()]);

  return (
    <>
      <PageHeader
        title="設定"
        description={<p>Claude Code 的 rpai-course-platform plugin 用權杖辨認你。每台電腦各產生一組，不用時就撤銷。</p>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="tokens-title" className="min-w-0 space-y-6">
          <div>
            <SectionTitle>
              <span id="tokens-title">Claude Code 權杖</span>
            </SectionTitle>
            <Card>
              <CreateTokenForm />
            </Card>
          </div>

          <div>
            <SectionTitle aside={`${tokens.length} 組`}>我的權杖</SectionTitle>
            <Card>{tokens.length === 0 ? <Empty>還沒有權杖。</Empty> : <TokenList tokens={tokens} />}</Card>
          </div>
        </section>

        <aside aria-labelledby="plugin-title" className="space-y-4">
          <Card emphasis>
            <h2 id="plugin-title" className="text-[0.95rem] font-bold text-ink">
              安裝 plugin 時要填
            </h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-bold text-body-muted">server_url</dt>
                <dd className="break-all">
                  <code>{origin}</code>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-body-muted">api_token</dt>
                <dd>左邊產生的 rcp_ 開頭權杖</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2 className="text-[0.95rem] font-bold text-ink">權杖等於你的身分</h2>
            <p className="mt-2 text-sm">
              拿到權杖的人可以用你的名義接工作區的產檔工作。不要貼進聊天或文件；電腦遺失或不再使用時立刻撤銷。
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function TokenList({ tokens }: { tokens: ApiTokenRow[] }) {
  return (
    <ul className="divide-y-2 divide-layer">
      {tokens.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {t.label}
              {t.revoked_at && <Badge tone="danger">已撤銷</Badge>}
            </p>
            <p className="mt-1 text-xs text-body-muted">
              <code>{t.token_prefix}…</code>・建立於 {formatTime(t.created_at)}・最後使用：{formatTime(t.last_used_at)}
            </p>
          </div>
          {!t.revoked_at && (
            <form action={revokeTokenAction}>
              <input type="hidden" name="id" value={t.id} />
              <RevokeButton label={t.label} />
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
