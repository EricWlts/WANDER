import { t } from "./I18n";
const uploadKeys = new WeakMap<File, string>();
let csrfToken = "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    /** invalid_layout: the module (client ID from the request) and the rejected setting. */
    readonly moduleId?: number | null,
    readonly key?: string | null,
  ) {
    super(message);
  }
}
// Warmed GET responses (link hover/focus). Each is handed out once and expires quickly,
// so a page never paints data older than a few seconds.
const PREFETCH_TTL_MS = 15000;
const prefetched = new Map<string, { at: number; data: Promise<unknown> }>();
function takePrefetched(path: string): Promise<unknown> | null {
  const hit = prefetched.get(path);
  if (!hit) return null;
  prefetched.delete(path);
  return Date.now() - hit.at < PREFETCH_TTL_MS ? hit.data : null;
}
/** Starts a public GET request now; the next api(path) call receives its result. */
export function prefetch(path: string): void {
  const hit = prefetched.get(path);
  if (hit && Date.now() - hit.at < PREFETCH_TTL_MS) return;
  const data = request<unknown>(path, {});
  data.catch(() => {
    if (prefetched.get(path)?.data === data) prefetched.delete(path);
  });
  prefetched.set(path, { at: Date.now(), data });
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if ((!options.method || options.method === "GET") && !options.body) {
    const warm = takePrefetched(path);
    if (warm) return warm as Promise<T>;
  }
  return request<T>(path, options);
}
async function request<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET")
    headers.set("X-CSRF-Token", csrfToken);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      t("WANDER is not reachable right now. Please try again in a moment.", "WANDER ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal."),
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(t(data.error || "Something went wrong. Please try again."), data.code, data.module_id, data.key);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (data.csrf_token) csrfToken = data.csrf_token;
  return data;
}
export const json = (method: string, value: unknown): RequestInit => ({
  method,
  body: JSON.stringify(value),
});

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
/** Lenient client-side check; browsers often report "" for HEIC. The backend is the real validator. */
export function isPhotoFile(file: File): boolean {
  if (PHOTO_TYPES.includes(file.type.toLowerCase())) return true;
  return (!file.type || file.type === "application/octet-stream") && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function uploadPhoto<T>(
  path: string,
  file: File,
  chapterId: number | null,
  progress: (percent: number, loaded?: number, total?: number) => void,
  basis?: { slug: string; version: number },
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    if (basis) {
      xhr.setRequestHeader("X-Composition-Version", String(basis.version));
      xhr.setRequestHeader("X-Composition-Journey", basis.slug);
    }
    xhr.responseType = "json";
    if (signal) {
      if (signal.aborted) return reject(new DOMException("Upload cancelled", "AbortError"));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    }
    let sent: { loaded: number; total: number } | undefined;
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      sent = { loaded: event.loaded, total: event.total };
      // 100 is reserved for "fully transferred" so the processing phase starts on time.
      progress(
        Math.min(99, Math.floor((event.loaded / event.total) * 100)),
        event.loaded,
        event.total,
      );
    };
    xhr.upload.onload = () => progress(100, sent?.total, sent?.total);
    xhr.onerror = () =>
      reject(
        new Error(
          t(
            "The connection was interrupted. Uploaded photographs are safe; please retry the remaining files.",
          ),
        ),
      );
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else
        reject(
          new ApiError(
            t(
              xhr.response?.error ||
                "This photograph could not be uploaded. Please try again.",
            ),
            xhr.response?.code,
          ),
        );
    };
    const data = new FormData();
    data.append("file", file);
    if (!uploadKeys.has(file)) uploadKeys.set(file, crypto.randomUUID());
    data.append("upload_key", uploadKeys.get(file)!);
    if (chapterId !== null) data.append("chapter_id", String(chapterId));
    xhr.send(data);
  });
}
