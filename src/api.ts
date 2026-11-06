import { t } from "./I18n";
const uploadKeys = new WeakMap<File, string>();
let csrfToken = "";

export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
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
      t("WANDER could not connect. Make sure the local backend is running."),
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(t(data.error || "Something went wrong. Please try again."), data.code);
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

export function uploadPhoto<T>(
  path: string,
  file: File,
  chapterId: number | null,
  progress: (percent: number) => void,
  basis?: { slug: string; version: number },
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
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.upload.onload = () => progress(100);
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
