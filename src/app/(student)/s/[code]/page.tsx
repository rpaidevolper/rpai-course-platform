import type { Metadata } from "next";
import { portalView } from "@/lib/mockup/logic";
import { initialState } from "@/lib/mockup/state";
import { StudentPortal } from "./student-portal";

const FIXTURES = initialState();

export function generateStaticParams() {
  return FIXTURES.sessions.map((s) => ({ code: s.portal.code }));
}

export async function generateMetadata({ params }: PageProps<"/s/[code]">): Promise<Metadata> {
  const { code } = await params;
  // demo 中新建的場次不在 fixture 裡，用通用標題
  const view = portalView(FIXTURES, code, FIXTURES.now);
  // 學員入口是不需登入的公開頁，不讓搜尋引擎收錄
  return { title: view?.courseTitle ?? "上課資料", robots: { index: false, follow: false } };
}

export default async function PortalPage({ params }: PageProps<"/s/[code]">) {
  const { code } = await params;
  return <StudentPortal code={code} />;
}
