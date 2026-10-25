import { requireSignedIn } from "./session";

/** 首頁（登入後）：課程清單的骨架。清單本身下一步才接資料。 */
export default async function CoursesPage() {
  await requireSignedIn("/");

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">課程</h1>
      <p className="mt-2 text-body-muted">課程清單會列出講師的 AI 存進平台的課程。</p>
    </div>
  );
}
