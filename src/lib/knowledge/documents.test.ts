import { describe, expect, it } from "vitest";
import { buildKnowledgeDocuments, classify, type BuildResult } from "./documents.ts";
import { FIXTURE_CLIENT_NAMES, loadFixture } from "./fixtures/load.ts";
import { CLIENT_NAME_FLAG, type Frontmatter, type MarkdownFile } from "./types.ts";

async function buildFixture(): Promise<BuildResult> {
  const { files, aliasesText } = await loadFixture();
  return buildKnowledgeDocuments(files, aliasesText);
}

/** 用路徑找（路徑已遮掉客戶名稱，所以只給沒有客戶名稱的檔名用）。 */
function docAt(built: BuildResult, path: string) {
  const doc = built.documents.find((d) => d.path === path);
  if (!doc) throw new Error(`沒有這份文件：${path}`);
  return doc;
}

/** 用標題找配方（配方的檔名含客戶名稱時，路徑會被遮掉，所以用標題找）。 */
function recipeTitled(built: BuildResult, title: string) {
  const doc = built.documents.find((d) => d.kind === "recipe" && d.title === title);
  if (!doc) throw new Error(`沒有這份配方：${title}`);
  return doc;
}

const FRAMEWORK: MarkdownFile = {
  path: "模組框架.md",
  text: "---\nid: framework\ntitle: 框架\nversion: 2026-10-01\nalways_load: true\n---\n# 框架\n\n內文",
};

describe("fixture 資料夾：四種文件都讀到，略過的檔案不進來", () => {
  it("每個種類的數量正確，README 與沒有 frontmatter 的課綱被略過，沒有錯誤", async () => {
    const built = await buildFixture();
    const countOf = (kind: string) => built.documents.filter((d) => d.kind === kind).length;
    expect(built.errors).toEqual([]);
    expect(countOf("framework")).toBe(1);
    expect(countOf("module_card")).toBe(2);
    expect(countOf("unit_card")).toBe(4);
    expect(countOf("recipe")).toBe(4);
    expect(built.skipped).toEqual(["README.md", "原始課綱暫存/某課綱.md"]);
  });

  it("名稱表的統計只有數量：配方來源 3、別名檔 3", async () => {
    const built = await buildFixture();
    expect(built.names).toEqual({ total: 6, fromRecipes: 3, fromAliases: 3 });
  });
});

describe("fixture 資料夾：種類、模組與標題", () => {
  it("模組框架不屬於任何模組，標題取 frontmatter 的 title", async () => {
    const doc = docAt(await buildFixture(), "模組框架.md");
    expect(doc).toMatchObject({ kind: "framework", modules: [], title: "模組框架（虛構測試版）" });
  });

  it("模組卡的標題是模組代號加名稱，modules 只有它自己", async () => {
    const built = await buildFixture();
    expect(docAt(built, "模組卡/A1_通用生成AI.md")).toMatchObject({ kind: "module_card", modules: ["A1"], title: "A1 通用生成 AI" });
    expect(docAt(built, "模組卡/B2_提問與指令.md")).toMatchObject({ kind: "module_card", modules: ["B2"], title: "B2 提問與指令" });
  });

  it("單元卡的標題取 frontmatter 的 title，modules 是它的模組", async () => {
    const built = await buildFixture();
    expect(docAt(built, "單元卡/A2_資料整理實作.md")).toMatchObject({ kind: "unit_card", modules: ["A2"], title: "資料整理實作" });
    expect(docAt(built, "單元卡/A4_雲端表單自動化.md")).toMatchObject({ kind: "unit_card", modules: ["A4"], title: "雲端表單自動化" });
  });

  it("配方的標題是中性名稱「產業・模組・規格」，提案與籌備中加後綴", async () => {
    const built = await buildFixture();
    expect(built.documents.filter((d) => d.kind === "recipe").map((d) => d.title).sort()).toEqual(
      ["製造・A1、A2、B1・一日", "B2B貿易・A1、B2・半日（提案）", "教育・B1・短講座", "製造・A1、A2・時數未定（籌備中）"].sort(),
    );
    expect(recipeTitled(built, "製造・A1、A2、B1・一日").modules).toEqual(["A1", "A2", "B1"]);
    expect(recipeTitled(built, "製造・A1、A2・時數未定（籌備中）").modules).toEqual(["A1", "A2"]);
  });

  it("配方檔名含客戶名稱時，路徑已遮掉；沒有客戶名稱的檔名照常", async () => {
    const built = await buildFixture();
    const paths = built.documents.map((d) => d.path);
    expect(paths).toContain("課程配方/202405_〔已遮蔽〕_AI週報實戰.md");
    expect(paths).toContain("課程配方/提案_〔已遮蔽〕_AI入門.md");
    expect(paths).toContain("課程配方/202406_虛工_AI小講.md");
    expect(paths.some((path) => path.includes("虛構"))).toBe(false);
  });
});

describe("fixture 資料夾：去識別化", () => {
  it("frontmatter 拿掉 client、source、used_in、times_used；配方也拿掉 id 與 title", async () => {
    const built = await buildFixture();
    for (const doc of built.documents) {
      for (const key of ["client", "source", "used_in", "times_used"]) {
        expect(doc.frontmatter).not.toHaveProperty(key);
      }
      if (doc.kind === "recipe") {
        expect(doc.frontmatter).not.toHaveProperty("id");
        expect(doc.frontmatter).not.toHaveProperty("title");
      }
    }
  });

  it("配方保留其他 frontmatter（產業、狀態、時數、對象、工具、模組、單元）", async () => {
    const doc = recipeTitled(await buildFixture(), "製造・A1、A2、B1・一日");
    expect(doc.frontmatter).toMatchObject({
      industry: "製造",
      status: "已交付",
      hours: 6,
      audience: "特定職能",
      tools: ["Claude", "Excel"],
      modules: ["A1", "A2", "B1"],
      units: ["A1_會議紀錄整理", "A2_資料整理實作", "B1_流程診斷練習"],
    });
  });

  it("本文拿掉大標題、出處、原始檔、主簡報、產業皮現況、現況與缺口、代表課程配方、講師備註", async () => {
    const built = await buildFixture();
    const removed = ["出處", "原始檔", "主簡報", "產業皮現況", "現況與缺口", "代表課程配方", "講師備註"];
    for (const doc of built.documents) {
      for (const word of removed) expect(doc.body).not.toContain(word);
      expect(doc.body).not.toMatch(/^# /m);
    }
    expect(recipeTitled(built, "製造・A1、A2、B1・一日").body).toContain("## 課程重點");
    expect(docAt(built, "模組卡/B2_提問與指令.md").body).toContain("## 常見搭配");
  });

  it("沒有旗標的文件，標題、本文與 frontmatter 裡都不出現任何 fixture 的客戶名稱", async () => {
    const built = await buildFixture();
    const clean = built.documents.filter((d) => d.flags.length === 0);
    expect(clean.length).toBe(built.documents.length - 3);
    for (const doc of clean) {
      const text = JSON.stringify({ title: doc.title, body: doc.body, frontmatter: doc.frontmatter }).toLowerCase();
      for (const name of FIXTURE_CLIENT_NAMES) {
        expect(text, `${doc.path} 不應含有 ${name}`).not.toContain(name.toLowerCase());
      }
    }
  });
});

describe("fixture 資料夾：客戶名稱旗標", () => {
  it("只有該帶旗標的三份帶旗標：學習目標含客戶、學員成果含別名、常見搭配含別名（小寫）", async () => {
    const built = await buildFixture();
    const flagged = built.documents.filter((d) => d.flags.length > 0).map((d) => d.path).sort();
    expect(flagged).toEqual(["單元卡/A1_會議紀錄整理.md", "單元卡/A2_資料整理實作.md", "模組卡/B2_提問與指令.md"]);
    for (const doc of built.documents.filter((d) => d.flags.length > 0)) {
      expect(doc.flags).toEqual([CLIENT_NAME_FLAG]);
    }
  });

  it("2 字的配方客戶（虛工）沒列在別名檔，所以教學方式提到它也不帶旗標", async () => {
    const doc = docAt(await buildFixture(), "單元卡/B1_流程診斷練習.md");
    expect(doc.body).toContain("虛工");
    expect(doc.flags).toEqual([]);
  });

  it("講師備註與出處被刪掉，所以它們含的客戶名稱不會帶旗標", async () => {
    const doc = docAt(await buildFixture(), "單元卡/A4_雲端表單自動化.md");
    expect(doc.flags).toEqual([]);
    expect(doc.frontmatter).toMatchObject({ extract: "deck" });
  });
});

describe("classify 判斷種類", () => {
  it.each<[Frontmatter, string | null]>([
    [{ client: "x" }, "recipe"],
    [{ units: [] }, "recipe"],
    [{ extract: "stub" }, "recipe"],
    [{ extract: "deck" }, null],
    [{ used_in: [] }, "unit_card"],
    [{ times_used: 1 }, "unit_card"],
    [{ module: "A1", minutes: 60 }, "unit_card"],
    [{ module: "A1", env: "x" }, "module_card"],
    [{ version: "2026", always_load: true }, "framework"],
    [{ version: "2026", always_load: true, module: "A1" }, null],
    [{ title: "只有標題" }, null],
  ])("%j → %s", (fm, expected) => {
    expect(classify(fm)).toBe(expected);
  });
});

describe("硬錯誤：有一個就整批不寫入", () => {
  const unit = (path: string, fm: string): MarkdownFile => ({ path, text: `---\n${fm}\n---\n內文` });

  it("單元卡的 module 不是合法的模組代號", () => {
    const built = buildKnowledgeDocuments(
      [FRAMEWORK, unit("單元卡/A9_測試.md", "id: A9_測試\nmodule: A9\nminutes: 60")],
      null,
    );
    expect(built.errors).toEqual(["單元卡/A9_測試.md：module 不是合法的模組代號（A1–B4）"]);
  });

  it("模組卡的 id 和 module 不同", () => {
    const built = buildKnowledgeDocuments(
      [FRAMEWORK, { path: "模組卡/A1.md", text: "---\nid: A2\nmodule: A1\nenv: 瀏覽器\n---\n" }],
      null,
    );
    expect(built.errors).toEqual(["模組卡/A1.md：模組卡的 id 必須和 module 相同"]);
  });

  it("兩份文件的來源 id 相同", () => {
    const same = "id: A1_重複\nmodule: A1\nminutes: 60";
    const built = buildKnowledgeDocuments([FRAMEWORK, unit("單元卡/甲.md", same), unit("單元卡/乙.md", same)], null);
    expect(built.errors).toEqual([
      "單元卡/甲.md：和另一份文件的來源 id 相同，請改成不同的 id 或檔名",
      "單元卡/乙.md：和另一份文件的來源 id 相同，請改成不同的 id 或檔名",
    ]);
  });

  it("找不到模組框架", () => {
    const built = buildKnowledgeDocuments([unit("單元卡/A1_沒有框架.md", "id: A1_沒有框架\nmodule: A1\nminutes: 60")], null);
    expect(built.errors).toEqual(["找不到模組框架：資料夾裡要有一份 frontmatter 含 version 與 always_load 的文件"]);
  });

  it("frontmatter 無法解析：錯誤列出檔案路徑與行號", () => {
    const built = buildKnowledgeDocuments([FRAMEWORK, { path: "單元卡/壞掉.md", text: "---\ntext: |\n  多行\n---\n" }], null);
    expect(built.errors).toEqual([
      "單元卡/壞掉.md：第 3 行：認不得的寫法（縮排的多行文字與巢狀結構目前不支援）",
    ]);
  });
});

describe("路徑與報告：檔名裡的客戶名稱也要遮掉", () => {
  it("配方檔名含客戶名稱時，文件的路徑是遮掉之後的", () => {
    const built = buildKnowledgeDocuments(
      [
        FRAMEWORK,
        { path: "課程配方/提案_虛構物流_X.md", text: "---\nid: 提案_虛構物流_X\nstatus: 提案\nhours: 3\nmodules: [A1]\nunits: []\n---\n內文" },
        {
          path: "課程配方/202405_虛構精密工業_測試課.md",
          text: "---\nid: 202405_虛構精密工業_測試課\nclient: 虛構精密工業\nstatus: 已交付\nhours: 6\nmodules: [A1]\n---\n## 課程重點\n\n提到虛構物流的案例。",
        },
      ],
      null,
    );
    expect(built.errors).toEqual([]);
    const flagged = built.documents.find((d) => d.flags.length > 0);
    expect(flagged?.path).toBe("課程配方/202405_〔已遮蔽〕_測試課.md");
    expect(built.documents.map((d) => d.path)).toContain("課程配方/提案_〔已遮蔽〕_X.md");
    expect(built.documents.find((d) => d.path.includes("提案"))?.title).toBe("未分產業・A1・半日（提案）");
  });

  it("沒有產業與模組的配方用「未分產業」「未分模組」", () => {
    const built = buildKnowledgeDocuments(
      [FRAMEWORK, { path: "課程配方/202405_虛構測試_課程.md", text: "---\nid: 202405_虛構測試_課程\nstatus: 已交付\nhours: 6\nunits: []\n---\n內文" }],
      null,
    );
    expect(built.documents.find((d) => d.kind === "recipe")?.title).toBe("未分產業・未分模組・一日");
  });
});

describe("content_hash：內容與旗標都沒變時要一樣", () => {
  const unit = (text: string): MarkdownFile => ({ path: "單元卡/A1_雜湊.md", text });
  const hashOf = (file: MarkdownFile) => {
    const built = buildKnowledgeDocuments([FRAMEWORK, file], null);
    return built.documents.find((d) => d.kind === "unit_card")?.content_hash;
  };

  it("欄位順序不同、被刪掉的欄位不同，雜湊仍然相同", () => {
    const a = unit("---\nid: A1_雜湊\nmodule: A1\ntitle: 甲\nminutes: 60\nused_in: [某配方]\ntimes_used: 1\n---\n內文");
    const b = unit("---\ntimes_used: 2\ntitle: 甲\nminutes: 60\nused_in: [別的配方]\nmodule: A1\nid: A1_雜湊\n---\n內文");
    expect(hashOf(a)).toBeDefined();
    expect(hashOf(a)).toBe(hashOf(b));
  });

  it("本文或標題改了，雜湊就變", () => {
    const base = hashOf(unit("---\nid: A1_雜湊\nmodule: A1\ntitle: 甲\nminutes: 60\n---\n內文"));
    expect(hashOf(unit("---\nid: A1_雜湊\nmodule: A1\ntitle: 甲\nminutes: 60\n---\n內文不同"))).not.toBe(base);
    expect(hashOf(unit("---\nid: A1_雜湊\nmodule: A1\ntitle: 乙\nminutes: 60\n---\n內文"))).not.toBe(base);
  });
});
