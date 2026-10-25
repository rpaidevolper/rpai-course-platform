import Link from "next/link";
import { createSupabaseDashboardStore } from "@/lib/dashboard/store";
import { formatDateTime } from "@/lib/dashboard/format";
import { Card, Empty, PageHeader } from "../_components/ui";
import { requireSignedIn } from "./session";

/** 首頁（登入後）：全部課程，最近更新的在前。 */
export default async function CoursesPage() {
  await requireSignedIn("/");

  const courses = await createSupabaseDashboardStore().listCourses();

  return (
    <>
      <PageHeader title="課程" description="團隊的課程。點進去看藍圖與產物，並下載檔案。" />
      {courses.length === 0 ? (
        <Empty>還沒有課程。在 AI 裡說「我要備一門 X 課」，談完存成藍圖，課程就會出現在這裡。</Empty>
      ) : (
        <ul className="space-y-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Card>
                <Link href={`/courses/${course.id}`} className="font-bold text-ink underline-offset-2 hover:text-accent hover:underline">
                  {course.title}
                </Link>
                <p className="mt-1 text-sm text-body-muted">
                  {course.latest_version === null ? "還沒有藍圖" : `第 ${course.latest_version} 版`}・最後更新{" "}
                  {formatDateTime(course.updated_at)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
