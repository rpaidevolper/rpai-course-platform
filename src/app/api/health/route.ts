import { checkHealth } from "@/lib/health";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { httpStatus, body } = await checkHealth(async () => {
    const { error } = await createAdminClient().from("courses").select("id").limit(1);
    if (error) throw error;
  }, process.env.APP_COMMIT_SHA || null);

  return Response.json(body, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
