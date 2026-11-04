import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Layout } from "./types";

/** Layout coordinates deliberately exclude iframe scaling and reveal/parallax transforms. */
function layoutLeft(element: HTMLElement): number {
  let left = 0;
  for (
    let current: HTMLElement | null = element;
    current;
    current = current.offsetParent as HTMLElement | null
  )
    left += current.offsetLeft;
  return left;
}

/** A single image-area boundary for walls, single images, covers and rail viewports. */
export function MediaLayout({
  layout,
  enabled,
  children,
}: {
  layout: Layout;
  enabled: boolean;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const active =
    enabled &&
    (layout.media_width !== undefined ||
      layout.media_spacing !== undefined ||
      layout.media_spacing_top !== undefined ||
      layout.media_spacing_bottom !== undefined);
  useLayoutEffect(() => {
    const element = host.current;
    if (!active || !element) return;
    const content = element.firstElementChild as HTMLElement;
    const canvas = element.closest(".journal-canvas");
    const cover = canvas?.querySelector<HTMLElement>(".journal-cover");
    const image = cover?.querySelector<HTMLElement>(":scope > .parallax-frame");
    const view = element.ownerDocument.defaultView;
    const measure = () => {
      const target =
        layout.media_width === "cover-image"
          ? image
          : layout.media_width === "cover-frame"
            ? cover
            : undefined;
      // Day-only views have no journey cover: keep their natural image area usable.
      const width = target?.offsetWidth ?? element.clientWidth;
      const left = target ? layoutLeft(target) - layoutLeft(element) : 0;
      const spacing = Math.min(
        Math.max(0, layout.media_spacing ?? 0),
        width / 2,
      );
      content.style.width = target
        ? `${Math.max(0, width - spacing * 2)}px`
        : `calc(100% - ${spacing * 2}px)`;
      content.style.marginLeft = `${left + spacing}px`;
    };
    measure();
    const observer = view?.ResizeObserver
      ? new view.ResizeObserver(measure)
      : undefined;
    for (const target of [element, cover, image])
      if (target) observer?.observe(target);
    view?.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      view?.removeEventListener("resize", measure);
    };
  });
  return active ? (
    <div
      ref={host}
      className="module-media-layout"
      style={{
        // Reserve both vertical spaces without changing existing child-margin collapse.
        paddingBottom:
          (layout.media_spacing_top ?? 0) + (layout.media_spacing_bottom ?? 0),
      }}
    >
      <div
        className="module-media-content"
        style={{ position: "relative", top: layout.media_spacing_top ?? 0 }}
      >
        {children}
      </div>
    </div>
  ) : (
    children
  );
}
