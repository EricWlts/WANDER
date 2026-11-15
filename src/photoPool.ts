import { useEffect, useSyncExternalStore } from "react";
import type { Journey, Photo } from "./types";

/** Shared pool of every uploaded photograph, grouped like folders by journey. */
export const HERO_HOLDER_SLUG = "__site-hero__";
export const POOL_CONCURRENCY = 4;

export type PoolGroup = { key: string; title: string; own: boolean; photos: Photo[] };
export type PoolState = { status: "idle" | "loading" | "ready" | "error"; groups: PoolGroup[]; total: number; error: string };
export type PoolFetcher = <T>(path: string) => Promise<T>;

/** Smallest candidate of a srcset string (falls back to the given url). */
export function smallestSource(srcset: string | undefined, fallback: string): string {
  let best = "";
  let bestWidth = Infinity;
  for (const part of (srcset ?? "").split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const width = size?.endsWith("w") ? Number.parseInt(size, 10) : Infinity;
    if (!best || width < bestWidth) {
      best = url;
      bestWidth = width;
    }
  }
  return best || fallback;
}

/** Runs the worker over all items with at most `limit` in flight; keeps order of results. */
export async function mapLimited<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, lane));
  return results;
}

export function toGroup(journey: Pick<Journey, "slug" | "title">, photos: Photo[]): PoolGroup {
  return { key: journey.slug, title: journey.title, own: journey.slug === HERO_HOLDER_SLUG, photos: photos.filter((p) => typeof p.id === "number" && p.url) };
}

export async function loadPoolGroups(fetcher: PoolFetcher, onGroups?: (groups: PoolGroup[]) => void): Promise<PoolGroup[]> {
  const list = await fetcher<Journey[]>("/journeys");
  const done = new Map<number, PoolGroup>();
  const emit = () => onGroups?.([...done.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g).filter((g) => g.photos.length));
  await mapLimited(list, POOL_CONCURRENCY, async (journey, index) => {
    try {
      const detail = await fetcher<Journey>(`/journeys/${encodeURIComponent(journey.slug)}`);
      done.set(index, toGroup(journey, detail.photos ?? []));
      emit();
    } catch {
      /* one broken journey must not hide the others */
    }
  });
  const groups = [...done.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g).filter((g) => g.photos.length);
  // The own-uploads folder comes first, then journeys in list order.
  return [...groups.filter((g) => g.own), ...groups.filter((g) => !g.own)];
}

const idle: PoolState = { status: "idle", groups: [], total: 0, error: "" };
let state: PoolState = idle;
let running: Promise<void> | null = null;
const listeners = new Set<() => void>();
const set = (next: PoolState) => {
  state = next;
  listeners.forEach((l) => l());
};
const count = (groups: PoolGroup[]) => groups.reduce((n, g) => n + g.photos.length, 0);

async function defaultFetcher<T>(path: string): Promise<T> {
  const { api } = await import("./api");
  return api<T>(path);
}

export function ensurePool(fetcher: PoolFetcher = defaultFetcher): Promise<void> {
  if (state.status === "ready") return Promise.resolve();
  if (running) return running;
  set({ ...idle, status: "loading" });
  running = loadPoolGroups(fetcher, (groups) => set({ status: "loading", groups, total: count(groups), error: "" }))
    .then((groups) => set({ status: "ready", groups, total: count(groups), error: "" }))
    .catch((e) => set({ ...idle, status: "error", error: (e as Error).message }))
    .finally(() => {
      running = null;
    });
  return running;
}

export function resetPool() {
  if (!running) set(idle);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function usePhotoPool(enabled: boolean): PoolState {
  useEffect(() => {
    if (enabled && (state.status === "idle" || state.status === "error")) void ensurePool();
  }, [enabled]);
  return useSyncExternalStore(subscribe, () => state, () => idle);
}
