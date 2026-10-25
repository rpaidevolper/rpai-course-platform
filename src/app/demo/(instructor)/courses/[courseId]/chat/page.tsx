import type { Metadata } from "next";
import { getCourse } from "@/lib/mockup/logic";
import { initialState } from "@/lib/mockup/state";
import { BlueprintChat } from "./blueprint-chat";

type Props = { params: Promise<{ courseId: string }> };

export function generateStaticParams() {
  return initialState().courses.map((c) => ({ courseId: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  const course = getCourse(initialState(), courseId);
  return { title: course ? `談藍圖：${course.title}` : "談藍圖" };
}

export default async function BlueprintChatPage({ params }: Props) {
  const { courseId } = await params;
  return <BlueprintChat courseId={courseId} />;
}
