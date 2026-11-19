import { sortByTravelDate, type Dated } from "./issueLabel.ts";

export type StudioOrder = "created" | "travel";
export const STUDIO_ORDER_KEY = "wander.studio.order";

export function parseStudioOrder(value: unknown): StudioOrder {
  return value === "travel" ? "travel" : "created";
}

/**
 * "created": most recently created first (id descending). "travel": newest trip first by start date.
 * Published stories always come before drafts (stable within each group).
 */
export function sortStudioJourneys<T extends Dated & { published?: boolean }>(journeys: readonly T[], order: StudioOrder): T[] {
  const ordered = order === "travel" ? sortByTravelDate(journeys, "newest") : [...journeys].sort((a, b) => b.id - a.id);
  return [...ordered.filter((j) => j.published), ...ordered.filter((j) => !j.published)];
}

/** Archive order: "created" (default) = most recently created first, then newest / oldest trip first. */
export type ArchiveOrder = "created" | "newest" | "oldest";
export const ARCHIVE_ORDERS: readonly ArchiveOrder[] = ["created", "newest", "oldest"];
export function nextArchiveOrder(order: ArchiveOrder): ArchiveOrder {
  return ARCHIVE_ORDERS[(ARCHIVE_ORDERS.indexOf(order) + 1) % ARCHIVE_ORDERS.length];
}
export function sortArchiveJourneys<T extends Dated>(journeys: readonly T[], order: ArchiveOrder): T[] {
  if (order === "created") return [...journeys].sort((a, b) => b.id - a.id);
  return sortByTravelDate(journeys, order);
}
