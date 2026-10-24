import { COURSE_RECIPES, COURSES, INDUSTRY_PACKS, KNOWLEDGE_DRAFTS, MODULE_CARDS, MOCK_NOW, PROJECTS, REQUIREMENT_REVIEWS, SESSIONS, UNIT_CARDS } from "./data";
import type { Course, CourseRecipe, IndustryPack, IsoTime, KnowledgeDraft, ModuleCard, Project, RequirementReview, Session, UnitCard } from "./types";

/**
 * 可互動 demo（#48）的整份狀態。fixture 是初始值，之後所有改動都經過 reducer（actions.ts）。
 * 狀態只存在瀏覽器（localStorage），不接資料庫。
 */
export interface DemoState {
  /** demo 時鐘：所有「現在」都讀它，每個改動會往前推一分鐘，讓時間戳有先後 */
  now: IsoTime;
  projects: Project[];
  courses: Course[];
  sessions: Session[];
  moduleCards: ModuleCard[];
  unitCards: UnitCard[];
  recipes: CourseRecipe[];
  industryPacks: IndustryPack[];
  drafts: KnowledgeDraft[];
  requirementReviews: RequirementReview[];
}

/** 改了 DemoState 的形狀就加一，舊的 localStorage 會被丟掉、回到初始值 */
export const DEMO_STATE_VERSION = 3;

export function initialState(): DemoState {
  return structuredClone({
    now: MOCK_NOW,
    projects: PROJECTS,
    courses: COURSES,
    sessions: SESSIONS,
    moduleCards: MODULE_CARDS,
    unitCards: UNIT_CARDS,
    recipes: COURSE_RECIPES,
    industryPacks: INDUSTRY_PACKS,
    drafts: KNOWLEDGE_DRAFTS,
    requirementReviews: REQUIREMENT_REVIEWS,
  });
}
