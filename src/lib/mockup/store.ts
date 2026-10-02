"use client";

import { useEffect, useSyncExternalStore } from "react";
import { demoReducer, type DemoAction } from "./actions";
import { DEMO_STATE_VERSION, initialState, type DemoState } from "./state";

/**
 * 瀏覽器內的 demo store（#48）。
 * - 伺服器與 hydration 時一律用 fixture 初始值，hydration 後才換成 localStorage 的版本，避免 mismatch。
 * - 另一個分頁改了狀態（storage 事件）會同步過來：講師分頁發布，學員分頁立刻看到。
 * - 讀不到、解析失敗或版本不符時回到初始值。
 */

const STORAGE_KEY = "rpai-demo-state";
const SERVER_SNAPSHOT = initialState();

let current: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version: number; state: DemoState };
      if (parsed.version === DEMO_STATE_VERSION) return parsed.state;
    }
  } catch {
    // 私密模式或內容壞掉：回到初始值
  }
  return initialState();
}

function save(state: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DEMO_STATE_VERSION, state }));
  } catch {
    // 存不了就只活在這個分頁
  }
}

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): DemoState {
  if (current === null) current = load();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    current = load();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function dispatch(action: DemoAction) {
  current = demoReducer(getSnapshot(), action);
  save(current);
  emit();
}

export function resetDemo() {
  current = initialState();
  save(current);
  emit();
}

/** 目前的 demo 狀態。hydration 前是 fixture 初始值。 */
export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

const noopSubscribe = () => () => {};
/** hydration 完成、已讀到 localStorage 之後才是 true。找不到資料時，等它為 true 再顯示「找不到」，以免 demo 中新建的頁面閃一下 404。 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const PENDING_MS = 900;
const GENERATING_MS = 2400;

/**
 * 模擬產檔：排隊中 → 產出中 → 可用。掛在根 layout，重新整理後會接著跑。
 * 計時器放在這裡而不是 reducer，reducer 保持純函式。
 */
export function useArtifactSimulator() {
  const state = useDemoState();
  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const c of state.courses) {
      for (const a of c.artifacts) {
        if (a.status !== "pending" && a.status !== "generating") continue;
        const from = a.status;
        const delay = from === "pending" ? PENDING_MS : GENERATING_MS;
        timers.push(setTimeout(() => dispatch({ type: "artifact/advance", courseId: c.id, artifactId: a.id, from }), delay));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [state, hydrated]);
}
