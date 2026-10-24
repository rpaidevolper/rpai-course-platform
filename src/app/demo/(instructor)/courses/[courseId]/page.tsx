import type { Metadata } from "next";
import { getCourse } from "@/lib/mockup/logic";
import { initialState } from "@/lib/mockup/state";
import { CourseView } from "./course-view";

export function generateStaticParams() {
  return initialState().courses.map((c) => ({ courseId: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/demo/courses/[courseId]">): Promise<Metadata> {
  const { courseId } = await params;
  const course = getCourse(initialState(), courseId);
  return { title: course ? course.title : "課程" };
}

export default async function CoursePage({ params }: PageProps<"/demo/courses/[courseId]">) {
  const { courseId } = await params;
  return <CourseView courseId={courseId} />;
}
