import type { Metadata } from "next";
import { getCourse, getSession, sessionDateRange } from "@/lib/mockup/logic";
import { initialState } from "@/lib/mockup/state";
import { SessionView } from "./session-view";

const FIXTURES = initialState();

export function generateStaticParams() {
  return FIXTURES.sessions.map((s) => ({ sessionId: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/sessions/[sessionId]">): Promise<Metadata> {
  const { sessionId } = await params;
  // demo 中新建的場次不在 fixture 裡，用通用標題
  const session = getSession(FIXTURES, sessionId);
  const course = session && getCourse(FIXTURES, session.courseId);
  return { title: session && course ? `${course.title} ${sessionDateRange(session)}` : "場次" };
}

export default async function SessionPage({ params }: PageProps<"/sessions/[sessionId]">) {
  const { sessionId } = await params;
  return <SessionView sessionId={sessionId} />;
}
