/**
 * 產業名稱，和 src/lib/mockup/types.ts 的 INDUSTRIES 相同。這裡抄一份，因為 types.ts 有執行期的 @/ import，
 * node --experimental-strip-types 載不進來；names.test.ts 會比對兩份是否一致。
 */
export const KNOWN_INDUSTRIES = ["金融", "製造", "服務零售", "電商客服", "B2B貿易", "HR", "教育", "公益", "通用"] as const;
