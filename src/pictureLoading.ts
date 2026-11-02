export type PictureStatus = "loading" | "ready" | "error";

// Each observer belongs to one mounted image/source. A newer load (including a
// responsive candidate change) invalidates any decode still in flight.
export function observePicture(
  image: HTMLImageElement,
  update: (status: PictureStatus) => void,
): () => void {
  let alive = true;
  let revision = 0;
  const loaded = async () => {
    const request = ++revision;
    const source = image.currentSrc || image.src;
    update("loading");
    try {
      await image.decode();
    } catch {
      // Some browsers reject decode for an otherwise usable, loaded image.
    }
    if (
      !alive ||
      request !== revision ||
      source !== (image.currentSrc || image.src)
    )
      return;
    update(image.complete && image.naturalWidth > 0 ? "ready" : "error");
  };
  const failed = () => {
    ++revision;
    if (alive) update("error");
  };
  image.addEventListener("load", loaded);
  image.addEventListener("error", failed);
  update("loading");
  // A cached image can finish before the effect subscribes to its events.
  if (image.complete) {
    if (image.naturalWidth > 0) void loaded();
    else failed();
  }
  return () => {
    alive = false;
    ++revision;
    image.removeEventListener("load", loaded);
    image.removeEventListener("error", failed);
  };
}
