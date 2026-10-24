import { requireMember } from "@/lib/auth/session";
import { ButtonLink, Card, PageHeader } from "../_components/ui";

/** 真實後台首頁。專案、課程與藍圖對話接上資料庫前（#90、#93），先導去權杖與設計稿。 */
export default async function HomePage() {
  const { member } = await requireMember();
  return (
    <>
      <PageHeader
        title={`${member.displayName}，你好`}
        description={<p>你在「{member.workspaceName}」工作區。工作區裡的課程與產檔工作，每位講師都看得到。</p>}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card emphasis>
          <h2 className="text-[0.95rem] font-bold text-ink">連上你的 Claude Code</h2>
          <p className="mt-2 text-sm">
            到設定頁產生權杖，填進 rpai-course-platform plugin 的 <code>api_token</code>，就能在 Claude Code 裡接產檔工作。
          </p>
          <div className="mt-4">
            <ButtonLink href="/settings">產生權杖</ButtonLink>
          </div>
        </Card>
        <Card>
          <h2 className="text-[0.95rem] font-bold text-ink">其他功能陸續上線</h2>
          <p className="mt-2 text-sm">
            專案與課程、跟 AI 談藍圖、產物下載正在接上資料庫。想先看完整流程，可以打開設計稿；設計稿的資料只存在你的瀏覽器。
          </p>
          <div className="mt-4">
            <ButtonLink href="/demo" variant="secondary">
              打開設計稿
            </ButtonLink>
          </div>
        </Card>
      </div>
    </>
  );
}
