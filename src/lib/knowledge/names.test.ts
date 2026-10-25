import { describe, expect, it } from "vitest";
import { INDUSTRIES } from "@/lib/mockup/types";
import { KNOWN_INDUSTRIES } from "./industries.ts";
import { buildNameTable, clientSegmentOf, parseAliases } from "./names.ts";

describe("clientSegmentOf 從配方 id 取客戶段", () => {
  it.each([
    ["202405_虛構精密_AI週報實戰", "虛構精密"],
    ["提案_虛構物流_AI入門", "虛構物流"],
    ["製造_202403_虛構電子_AI導入", "虛構電子"],
    ["製造_2024-2025_虛構甲_主題", "虛構甲"],
    ["AI入門_虛構丙_主題", null],
    ["202405", null],
    ["202405__課名", null],
  ])("%s → %j", (id, expected) => {
    expect(clientSegmentOf(id)).toBe(expected);
  });
});

describe("parseAliases 別名檔", () => {
  it("略過空行與 # 註解，! 開頭是例外", () => {
    expect(parseAliases("# 註解\n\n虛精\n  FakeLogi  \n!RPAI\n! 測試\n")).toEqual({
      names: ["虛精", "FakeLogi"],
      exceptions: ["RPAI", "測試"],
    });
    expect(parseAliases(null)).toEqual({ names: [], exceptions: [] });
  });
});

describe("buildNameTable 名稱表（只在記憶體裡）", () => {
  const table = buildNameTable({
    recipes: [
      { id: "202405_虛構精密_AI週報實戰", client: "虛構精密工業" },
      { id: "202406_虛工_AI小講", client: "虛工" },
      { id: "製造_202403_虛構電子_AI導入", client: null },
    ],
    aliasesText: "虛精\n!RPAI\n# 註解\nFakeLogi\n製造\n",
  });

  it("配方的 client、配方 id 的客戶段、別名檔都進名稱表", () => {
    expect(table.hits("虛構精密工業的週報")).toBe(true);
    expect(table.hits("虛構精密")).toBe(true);
    expect(table.hits("虛構電子")).toBe(true);
    expect(table.hits("虛精的例會")).toBe(true);
  });

  it("別名檔的名稱不分大小寫", () => {
    expect(table.hits("這堂 fakelogi 的客服課")).toBe(true);
    expect(table.hits("FAKELOGI")).toBe(true);
  });

  it("2 字的配方名稱不用列在別名檔，也會比對", () => {
    expect(table.hits("虛工的流程")).toBe(true);
  });

  it("中文名稱沒有字詞邊界：出現在更長的中文字串裡也算命中", () => {
    expect(table.hits("虛工作坊的報名")).toBe(true);
  });

  it("內建例外（RPAI、產業名稱）與別名檔的 ! 例外不算客戶名稱", () => {
    expect(table.hits("RPAI 的課程")).toBe(false);
    expect(table.hits("rpai 的課程")).toBe(false);
    expect(table.hits("製造業的現場")).toBe(false);
  });

  it("統計只有數量：配方來源 4（只來自配方的）、別名檔 2，2 個字以下的名稱 2 個（虛工、虛精）", () => {
    expect(table.stats).toEqual({ total: 6, fromRecipes: 4, fromAliases: 2, short: 2 });
  });

  it("mask 把命中的名稱換成遮罩字，不分大小寫；長的名稱先比對", () => {
    expect(table.mask("單元卡/虛構精密工業_週報.md")).toBe("單元卡/〔已遮蔽〕_週報.md");
    expect(table.mask("模組卡/B2 fakelogi 客服")).toBe("模組卡/B2 〔已遮蔽〕 客服");
    expect(table.mask("沒有名稱的文字")).toBe("沒有名稱的文字");
  });

  it("沒有任何名稱時 hits 永遠是 false，mask 原樣回傳", () => {
    const empty = buildNameTable({ recipes: [], aliasesText: null });
    expect(empty.hits("虛構精密")).toBe(false);
    expect(empty.mask("虛構精密")).toBe("虛構精密");
    expect(empty.stats).toEqual({ total: 0, fromRecipes: 0, fromAliases: 0, short: 0 });
  });
});

describe("英文名稱（全是 ASCII）只比對完整的詞", () => {
  const table = buildNameTable({ recipes: [], aliasesText: "GE\nC&A\n" });

  it("前後緊接英文字母或數字的不算命中", () => {
    expect(table.hits("AGENT 的課")).toBe(false);
    expect(table.hits("manaGEment")).toBe(false);
    expect(table.hits("GE2 的課")).toBe(false);
  });

  it("前後是空白、中文或標點的算命中，不分大小寫", () => {
    expect(table.hits("GE 的講師")).toBe(true);
    expect(table.hits("與GE合作")).toBe(true);
    expect(table.hits("(GE)")).toBe(true);
    expect(table.hits("ge 的講師")).toBe(true);
    expect(table.hits("C&A的案例")).toBe(true);
  });

  it("mask 和 hits 用同一套規則：只遮完整的詞", () => {
    expect(table.mask("AGENT GE 的講師")).toBe("AGENT 〔已遮蔽〕 的講師");
    expect(table.mask("與GE合作")).toBe("與〔已遮蔽〕合作");
    expect(table.mask("manaGEment")).toBe("manaGEment");
  });
});

describe("! 例外與 stats.short", () => {
  it("! 例外仍然把名稱排除，即使配方也用了這個名稱", () => {
    const table = buildNameTable({
      recipes: [{ id: "202406_虛工_AI小講", client: "虛工" }],
      aliasesText: "!虛工\n",
    });
    expect(table.hits("虛工的流程")).toBe(false);
    expect(table.stats).toEqual({ total: 0, fromRecipes: 0, fromAliases: 0, short: 0 });
  });

  it("short 只算 2 個字（[...name].length）以下的名稱", () => {
    const table = buildNameTable({
      recipes: [{ id: "202405_虛構科技_課", client: "虛構科技" }],
      aliasesText: "A1B\nGE\n甲\n",
    });
    expect(table.stats).toEqual({ total: 4, fromRecipes: 1, fromAliases: 3, short: 2 });
  });
});

describe("內建產業清單", () => {
  it("和 src/lib/mockup/types.ts 的 INDUSTRIES 相同（腳本不能 import 那個檔，所以抄一份）", () => {
    expect([...KNOWN_INDUSTRIES]).toEqual([...INDUSTRIES]);
  });
});
