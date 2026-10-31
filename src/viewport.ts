/** Coordinates in the outer viewport, including a scaled editor frame. */
export function viewportRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const frame = element.ownerDocument.defaultView
    ?.frameElement as HTMLIFrameElement | null;
  if (!frame) return { top: rect.top, height: rect.height, scale: 1 };
  const outer = frame.getBoundingClientRect();
  const scale = outer.width / frame.clientWidth || 1;
  return {
    top: outer.top + rect.top * scale,
    height: rect.height * scale,
    scale,
  };
}
