import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMembership, getSignedInUser } from "@/lib/auth/session";
import { AuthShell } from "../_components/auth-shell";
import { Button } from "../_components/ui";
import { signOut } from "../auth/actions";

export const metadata: Metadata = { title: "尚未加入工作區" };

/** 已登入、但還不是工作區成員：看不到任何資料（RLS 也查不到），只說明怎麼加入。 */
export default async function NoWorkspacePage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  if (await getMembership()) redirect("/");

  return (
    <AuthShell title="尚未加入工作區">
      <p>
        你已經用 <strong className="text-navy">{user.email ?? "這個帳號"}</strong>{" "}
        登入，但還沒被加進講師工作區，所以看不到任何專案、課程或知識庫。
      </p>
      <p>請把這個 email 給管理者。加入之後重新整理這一頁就能進去。</p>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          登出，換一個帳號
        </Button>
      </form>
    </AuthShell>
  );
}
