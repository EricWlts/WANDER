export type ViewerState = {
  target: number;
  visible: number | null;
  image?: HTMLImageElement;
  status: "loading" | "ready" | "error";
};
export type ImageRequest = {
  ready: Promise<void>;
  cancel: () => void;
  image?: HTMLImageElement;
};
type Entry = {
  request: ImageRequest;
  ready: Promise<boolean>;
  status: ViewerState["status"];
};

export function viewerIndex(index: number, length: number) {
  return length ? ((index % length) + length) % length : 0;
}

/** One session owns only its target and direct neighbors, deduplicated by source. */
export class PhotoViewerModel {
  state: ViewerState;
  private cache = new Map<string, Entry>();
  private generation = 0;
  private disposed = false;

  private urls: string[];
  private load: (url: string) => ImageRequest;
  private changed: (state: ViewerState) => void;

  constructor(
    urls: string[],
    initial: number,
    load: (url: string) => ImageRequest,
    changed: (state: ViewerState) => void,
  ) {
    this.urls = urls;
    this.load = load;
    this.changed = changed;
    this.state = {
      target: viewerIndex(initial, urls.length),
      visible: null,
      status: "loading",
    };
  }

  private neighborhood() {
    return [
      ...new Set(
        [-1, 0, 1].map(
          (offset) =>
            this.urls[
              viewerIndex(this.state.target + offset, this.urls.length)
            ],
        ),
      ),
    ];
  }

  private entry(url: string) {
    const existing = this.cache.get(url);
    if (existing) return existing;
    const request = this.load(url);
    const entry: Entry = {
      request,
      status: "loading",
      ready: Promise.resolve(false),
    };
    entry.ready = request.ready.then(
      () => {
        entry.status = "ready";
        return true;
      },
      () => {
        entry.status = "error";
        return false;
      },
    );
    this.cache.set(url, entry);
    return entry;
  }

  select(index: number, retry = false) {
    if (this.disposed || !this.urls.length) return;
    const generation = ++this.generation;
    const target = viewerIndex(index, this.urls.length);
    this.state = { ...this.state, target, status: "loading" };
    const allowed = this.neighborhood();
    for (const [url, entry] of this.cache) {
      if (!allowed.includes(url) || (retry && url === this.urls[target])) {
        entry.request.cancel();
        this.cache.delete(url);
      }
    }
    this.changed(this.state);
    const entry = this.entry(this.urls[target]);
    void entry.ready.then((success) => {
      if (this.disposed || generation !== this.generation) return;
      this.state = {
        target,
        visible: success ? target : this.state.visible,
        status: success ? "ready" : "error",
        ...(success
          ? entry.request.image && { image: entry.request.image }
          : this.state.image && { image: this.state.image }),
      };
      this.changed(this.state);
      // Start neighbors only after the requested photograph is decoded.
      if (success) for (const url of this.neighborhood()) this.entry(url);
    });
  }

  move(direction: number) {
    this.select(this.state.target + direction);
  }

  retry() {
    this.select(this.state.target, true);
  }

  dispose() {
    this.disposed = true;
    ++this.generation;
    for (const entry of this.cache.values()) entry.request.cancel();
    this.cache.clear();
    this.state = { ...this.state, image: undefined };
  }
}

/** Resolve only after decode; cancellation also releases pending event handlers. */
export function decodedImageRequest(url: string): ImageRequest {
  const image = new Image();
  let active = true;
  let decoded = false;
  let rejectReady: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    image.onload = async () => {
      image.onload = image.onerror = null;
      try {
        if (typeof image.decode === "function") await image.decode();
        if (active) {
          decoded = true;
          resolve();
        }
      } catch {
        if (active) reject(new Error("Image decode failed"));
      }
    };
    image.onerror = () => {
      image.onload = image.onerror = null;
      if (active) reject(new Error("Image load failed"));
    };
    image.src = url;
  });
  return {
    ready,
    image,
    cancel: () => {
      active = false;
      image.onload = image.onerror = null;
      // Completed nodes may still be displayed after eviction from the cache.
      if (!decoded) image.removeAttribute("src");
      rejectReady(new Error("Image request cancelled"));
    },
  };
}
