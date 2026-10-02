import { notFound } from "next/navigation";
import { CURRENT_INSTRUCTOR_ID, getInstructor } from "@/lib/mockup/instructor";
import { PreferencesEditor } from "../../_components/preferences-editor";
import { Card, PageHeader, SectionTitle } from "../../_components/ui";

/** 講師偏好設定頁（#29）。 */
export default function SettingsPage() {
  const instructor = getInstructor(CURRENT_INSTRUCTOR_ID);
  if (!instructor) notFound();

  return (
    <>
      <PageHeader
        title="講師偏好"
        description={
          <p>
            {instructor.name}，這裡寫下你自己的排課與製作習慣。寫一次就好，不用每門課重講。
          </p>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="prefs-title">
          <SectionTitle aside="設計稿：只存在這個頁面，重新整理就還原">
            <span id="prefs-title">我的講師偏好</span>
          </SectionTitle>
          <Card>
            <PreferencesEditor initial={instructor.preferences} />
          </Card>
        </section>

        <aside aria-labelledby="scope-title" className="space-y-4">
          <Card emphasis>
            <h2 id="scope-title" className="text-[0.95rem] font-bold text-navy">
              會帶到哪裡
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>每一次藍圖對話</li>
              <li>每一個產檔工作</li>
            </ul>
            <p className="mt-2 text-sm">改了之後，下一次對話與下一個產檔工作就會用新的版本。</p>
          </Card>
          <Card>
            <h2 className="text-[0.95rem] font-bold text-navy">和 RPAI 品牌規範分開</h2>
            <p className="mt-2 text-sm">
              品牌規範是 RPAI 全公司共用的色彩、字體與語氣，講師不能在這裡修改。講師偏好只屬於你一個人，
              不會寫進品牌規範，也不會影響其他講師。
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
