import type { Metadata } from "next";
import { getProject } from "@/lib/mockup/logic";
import { initialState } from "@/lib/mockup/state";
import { ProjectView } from "./project-view";

export function generateStaticParams() {
  return initialState().projects.map((p) => ({ projectId: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]">): Promise<Metadata> {
  const { projectId } = await params;
  // demo 中新建的專案只存在瀏覽器裡，伺服器端找不到時用通用標題
  return { title: getProject(initialState(), projectId)?.title ?? "專案" };
}

/** 專案頁：上方是客戶背景（會帶進每門新課程的藍圖），下方是客戶文件、需求條目與課程列表。 */
export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  return <ProjectView projectId={projectId} />;
}
