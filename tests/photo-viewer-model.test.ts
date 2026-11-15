import test from "node:test";
import assert from "node:assert/strict";
import {
  PhotoViewerModel,
  decodedImageRequest,
  viewerIndex,
  type ViewerState,
} from "../src/photoViewerModel.ts";

function harness(
  urls = Array.from({ length: 20 }, (_, i) => `photo-${i}`),
  initial = 0,
) {
  const requests: {
    url: string;
    cancelled: boolean;
    resolve: () => void;
    reject: () => void;
  }[] = [];
  const states: ViewerState[] = [];
  const model = new PhotoViewerModel(
    urls,
    initial,
    (url) => {
      let resolve!: () => void;
      let reject!: () => void;
      const ready = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = () => no(new Error("failed"));
      });
      const request = { url, cancelled: false, resolve, reject };
      requests.push(request);
      // Leave promises controllable even after cancel to exercise late browser replies.
      return {
        ready,
        cancel: () => {
          request.cancelled = true;
        },
      };
    },
    (state) => states.push(state),
  );
  return { model, requests, states };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("index navigation wraps for empty, one, two and twenty placements", () => {
  assert.equal(viewerIndex(10, 0), 0);
  assert.equal(viewerIndex(-10, 1), 0);
  assert.equal(viewerIndex(-1, 2), 1);
  assert.equal(viewerIndex(30, 20), 10);
});

test("ten rapid inputs accumulate from the target and ignore old decoded replies", async () => {
  const { model, requests } = harness();
  model.select(0);
  for (let i = 0; i < 10; i++) model.move(1);
  assert.equal(model.state.target, 10);
  assert.equal(model.state.visible, null);
  requests[10].resolve();
  await flush();
  assert.equal(model.state.visible, 10);
  for (const request of requests.slice(0, 10)) request.resolve();
  await flush();
  assert.equal(model.state.visible, 10);
  model.dispose();
});

test("direction reversal while decoding retains the last visible placement", async () => {
  const { model, requests } = harness();
  model.select(0);
  requests[0].resolve();
  await flush();
  model.move(1);
  model.move(-1);
  await flush();
  assert.deepEqual(model.state, { target: 0, visible: 0, status: "ready" });
  requests.find((request) => request.url === "photo-1")!.resolve();
  await flush();
  assert.equal(model.state.visible, 0);
  model.dispose();
});

test("failed replacements preserve image identity, retry succeeds, and navigation stays available", async () => {
  const { model, requests } = harness();
  model.select(0);
  requests[0].resolve();
  await flush();
  model.move(1);
  requests.find((request) => request.url === "photo-1")!.reject();
  await flush();
  assert.deepEqual(model.state, { target: 1, visible: 0, status: "error" });
  model.retry();
  assert.deepEqual(model.state, { target: 1, visible: 0, status: "loading" });
  requests.at(-1)!.resolve();
  await flush();
  assert.equal(model.state.visible, 1);
  model.move(1);
  assert.equal(model.state.target, 2);
  assert.equal(model.state.visible, 1);
  model.dispose();
});

test("first-open error has no invented visible position and can be retried", async () => {
  const { model, requests } = harness(["broken"]);
  model.select(0);
  requests[0].reject();
  await flush();
  assert.deepEqual(model.state, { target: 0, visible: null, status: "error" });
  model.retry();
  requests[1].resolve();
  await flush();
  assert.deepEqual(model.state, { target: 0, visible: 0, status: "ready" });
  assert.equal(requests.length, 2);
  model.dispose();
});

test("preload and live references stay bounded to target and its immediate neighbors", async () => {
  const { model, requests } = harness();
  model.select(0);
  assert.deepEqual(
    requests.map((request) => request.url),
    ["photo-0"],
  );
  requests[0].resolve();
  await flush();
  assert.deepEqual(
    new Set(requests.map((request) => request.url)),
    new Set(["photo-0", "photo-19", "photo-1"]),
  );
  for (let i = 1; i <= 60; i++) {
    model.move(1);
    for (const request of requests) if (!request.cancelled) request.resolve();
    await flush();
    const live = requests.filter((request) => !request.cancelled);
    assert.ok(live.length <= 3);
    const allowed = [
      model.state.target,
      viewerIndex(model.state.target - 1, 20),
      viewerIndex(model.state.target + 1, 20),
    ];
    assert.ok(
      live.every((request) =>
        allowed.some((index) => request.url === `photo-${index}`),
      ),
    );
  }
  model.dispose();
  assert.ok(requests.every((request) => request.cancelled));
});

test("repeated sources share decoded work but preserve individual placement indices", async () => {
  const { model, requests } = harness(["same", "same", "other"]);
  model.select(0);
  requests[0].resolve();
  await flush();
  model.move(1);
  await flush();
  assert.deepEqual(model.state, { target: 1, visible: 1, status: "ready" });
  assert.equal(requests.filter((request) => request.url === "same").length, 1);
  assert.equal(requests.length, 2);
  model.dispose();
});

test("close rejects late success and failure and releases every retained request", async () => {
  const { model, requests, states } = harness(["a", "b"]);
  model.select(0);
  model.move(1);
  const count = states.length;
  model.dispose();
  requests[0].resolve();
  requests[1].reject();
  await flush();
  model.move(1);
  model.retry();
  assert.equal(states.length, count);
  assert.ok(requests.every((request) => request.cancelled));
});

class ControlledImage {
  static instances: ControlledImage[] = [];
  onload: (() => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  removedSource = false;
  finishDecode!: () => void;
  failDecode!: () => void;
  decode = () =>
    new Promise<void>((resolve, reject) => {
      this.finishDecode = resolve;
      this.failDecode = () => reject(new Error("decode"));
    });
  constructor() {
    ControlledImage.instances.push(this);
  }
  removeAttribute(name: string) {
    if (name === "src") {
      this.removedSource = true;
      this.src = "";
    }
  }
}

function withControlledImages(run: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
  Object.defineProperty(globalThis, "Image", {
    value: ControlledImage,
    configurable: true,
  });
  ControlledImage.instances = [];
  return run().finally(() => {
    if (original) Object.defineProperty(globalThis, "Image", original);
    else Reflect.deleteProperty(globalThis, "Image");
  });
}

test("loader exposes the exact loaded node only after decode and completed eviction preserves its source", () =>
  withControlledImages(async () => {
    const request = decodedImageRequest("no-store-photo");
    const image = ControlledImage.instances[0];
    assert.equal(request.image, image);
    let ready = false;
    void request.ready.then(() => {
      ready = true;
    });
    const loaded = image.onload!();
    await flush();
    assert.equal(ready, false);
    image.finishDecode();
    await loaded;
    await request.ready;
    assert.equal(ready, true);
    request.cancel();
    assert.equal(image.src, "no-store-photo");
    assert.equal(image.removedSource, false);
    assert.equal(image.onload, null);
    assert.equal(image.onerror, null);
  }));

test("cancellation during decode rejects readiness and discards late decode completion", () =>
  withControlledImages(async () => {
    const request = decodedImageRequest("pending-photo");
    const image = ControlledImage.instances[0];
    const rejected = assert.rejects(request.ready, /cancelled/);
    const loaded = image.onload!();
    request.cancel();
    image.finishDecode();
    await loaded;
    await rejected;
    assert.equal(image.removedSource, true);
    assert.equal(image.onload, null);
    assert.equal(image.onerror, null);
  }));

test("load and decode failures both reject image readiness", () =>
  withControlledImages(async () => {
    const loading = decodedImageRequest("load-error");
    const loadRejected = assert.rejects(loading.ready, /load failed/);
    ControlledImage.instances[0].onerror!();
    await loadRejected;
    const decoding = decodedImageRequest("decode-error");
    const decodeRejected = assert.rejects(decoding.ready, /decode failed/);
    const image = ControlledImage.instances[1];
    const loaded = image.onload!();
    image.failDecode();
    await loaded;
    await decodeRejected;
  }));

test("evicting a visible decoded source keeps the same node through a distant target failure", () =>
  withControlledImages(async () => {
    const states: ViewerState[] = [];
    const model = new PhotoViewerModel(
      Array.from({ length: 20 }, (_, index) => `photo-${index}`),
      0,
      decodedImageRequest,
      (state) => states.push(state),
    );
    model.select(0);
    const visible = ControlledImage.instances[0];
    const loaded = visible.onload!();
    visible.finishDecode();
    await loaded;
    await flush();
    assert.equal(model.state.image, visible);
    model.select(10);
    assert.equal(model.state.image, visible);
    assert.equal(visible.removedSource, false);
    ControlledImage.instances.at(-1)!.onerror!();
    await flush();
    assert.equal(model.state.status, "error");
    assert.equal(model.state.visible, 0);
    assert.equal(model.state.image, visible);
    assert.equal(visible.src, "photo-0");
    const count = states.length;
    model.dispose();
    assert.equal(model.state.image, undefined);
    assert.equal(states.length, count);
  }));

import {
  colorIsDark,
  focusFlip,
  focusOffsets,
  viewerTouch,
  viewerDrag,
  viewerWheel,
} from "../src/photoViewerModel.ts";

test("vertical wheel travel closes past 60px; horizontal travel never counts", () => {
  let state = { time: -Infinity, total: 0 };
  for (let i = 0; i < 6; i++) {
    const r = viewerWheel(state, i * 16, 40, 5);
    state = r.state;
    assert.equal(r.close, false);
  }
  let closed = false;
  for (let i = 0; i < 4; i++) {
    const r = viewerWheel(state, 200 + i * 16, 0, 20);
    state = r.state;
    closed = r.close;
  }
  assert.equal(closed, true);
  // A pause starts a new tally.
  const again = viewerWheel(state, 2000, 0, 30);
  assert.equal(again.close, false);
  assert.equal(again.state.total, 30);
});

test("touch: clear vertical drag closes, clear horizontal drag steps", () => {
  assert.deepEqual(viewerTouch(5, 80), { close: true, step: 0 });
  assert.deepEqual(viewerTouch(-70, 10), { close: false, step: 1 });
  assert.deepEqual(viewerTouch(70, 10), { close: false, step: -1 });
  assert.deepEqual(viewerTouch(60, 55), { close: false, step: 0 });
});

test("focusFlip maps the resting rectangle onto the origin and crops the excess", () => {
  const to = { left: 100, top: 50, width: 800, height: 400 };
  const from = { left: 0, top: 0, width: 200, height: 50 };
  const f = focusFlip(from, to);
  assert.equal(f.scale, 0.25);
  assert.equal(f.x, 100 - 500);
  assert.equal(f.y, 25 - 250);
  assert.equal(f.clip, 100);
  assert.equal(focusFlip(to, to).clip, 0);
});

test("focus offsets keep the same glide and fade positions for pairs and longer sequences", () => {
  assert.deepEqual(focusOffsets(1), [0]);
  assert.deepEqual(focusOffsets(2), [-2, -1, 0, 1, 2]);
  assert.deepEqual(focusOffsets(9), [-2, -1, 0, 1, 2]);
});

test("edition surfaces are classified by luminance", () => {
  assert.equal(colorIsDark("rgb(26, 29, 24)"), true);
  assert.equal(colorIsDark("#eeece6"), false);
  assert.equal(colorIsDark("rgba(0, 0, 0, 0)"), null);
});

test("viewerDrag follows the finger and resists at the limits", () => {
  assert.equal(viewerDrag(40, 100, true), 40);
  assert.equal(viewerDrag(-40, 100, true), -40);
  const past = viewerDrag(300, 100, true);
  assert.ok(past > 100 && past < 125);
  const pull = viewerDrag(-500, 100, false);
  assert.ok(pull < 0 && pull > -35);
});

import { viewerStepWheel, viewerStepIdle } from "../src/photoViewerModel.ts";
test("one wheel gesture steps exactly one photograph, momentum included", () => {
  let state = viewerStepIdle;
  let steps = 0;
  // 60 events, 16 ms apart, decaying: a trackpad swipe with momentum (~1 s).
  for (let i = 0; i < 60; i++) {
    const r = viewerStepWheel(state, 1000 + i * 16, 60 * Math.pow(0.95, i), 2);
    state = r.state;
    steps += Math.abs(r.direction);
  }
  assert.equal(steps, 1);
  // After the wheel rested, a new swipe steps again.
  const again = viewerStepWheel(state, 3000, 80, 0);
  const next = viewerStepWheel(again.state, 3016, 80, 0);
  assert.equal(Math.abs(again.direction) + Math.abs(next.direction), 1);
});

import {
  viewerClampZoom,
  viewerDoubleTapInterval,
  viewerDoubleTapScale,
  viewerIsDoubleTap,
  viewerIsTap,
  viewerIsZoomed,
  viewerPan,
  viewerPinch,
  viewerToggleZoom,
  viewerWheelZoom,
  viewerZoomAt,
  viewerZoomBounds,
  viewerZoomIdle,
  viewerZoomMax,
} from "../src/photoViewerModel.ts";

// A landscape photograph (335 × 223) on a phone stage (390 × 634).
const media = { width: 335, height: 223 };
const stage = { width: 390, height: 634 };

/** Where a point of the photograph (relative to its centre) ends up on screen. */
const screen = (zoom: { scale: number; x: number; y: number }, point: { x: number; y: number }) => ({
  x: zoom.x + zoom.scale * point.x,
  y: zoom.y + zoom.scale * point.y,
});

test("pan bounds let the enlarged photograph reach the stage edge and no further", () => {
  assert.deepEqual(viewerZoomBounds(1, media, stage), { x: 0, y: 0 });
  // 3× width = 1005 > 390: ±307.5; 3× height = 669 > 634: ±17.5.
  assert.deepEqual(viewerZoomBounds(3, media, stage), { x: 307.5, y: 17.5 });
  // Still smaller than the stage on an axis: stays centred there.
  assert.equal(viewerZoomBounds(1.5, media, stage).y, 0);
});

test("zoom is clamped to 1×–3× and to the pan bounds, and 1× always recentres", () => {
  assert.deepEqual(viewerClampZoom({ scale: 9, x: 9999, y: -9999 }, media, stage), {
    scale: viewerZoomMax,
    x: 307.5,
    y: -17.5,
  });
  assert.deepEqual(viewerClampZoom({ scale: 0.4, x: 50, y: 50 }, media, stage), viewerZoomIdle);
  assert.deepEqual(viewerClampZoom({ scale: 1.0004, x: 50, y: 50 }, media, stage), viewerZoomIdle);
  assert.deepEqual(viewerClampZoom({ scale: Number.NaN, x: 1, y: 1 }, media, stage), viewerZoomIdle);
  assert.equal(viewerIsZoomed(viewerZoomIdle), false);
  assert.equal(viewerIsZoomed({ scale: 1.2, x: 0, y: 0 }), true);
});

test("zooming at a point keeps the content under that point in place", () => {
  const focal = { x: 60, y: 10 };
  const zoomed = viewerZoomAt(viewerZoomIdle, focal, 2, media, stage);
  assert.equal(zoomed.scale, 2);
  const at = screen(zoomed, { x: focal.x, y: focal.y });
  // Unclamped case: the focal content sits exactly where the finger is.
  assert.ok(Math.abs(at.x - focal.x) < 1e-9);
  assert.ok(Math.abs(at.y - focal.y) < 1e-9 || zoomed.y === 0);
  // Zooming further from an offset state keeps the same property.
  const further = viewerZoomAt(zoomed, focal, 2.8, media, stage);
  assert.ok(further.scale > 2.7);
  assert.ok(Math.abs(screen(further, { x: (focal.x - zoomed.x) / 2, y: 0 }).x - focal.x) < 1e-6);
  // Never beyond the maximum.
  assert.equal(viewerZoomAt(viewerZoomIdle, focal, 12, media, stage).scale, viewerZoomMax);
});

test("pinch scales with the finger distance and follows the midpoint", () => {
  const start = { zoom: viewerZoomIdle, distance: 100, mid: { x: 0, y: 0 } };
  assert.equal(viewerPinch(start, { x: 0, y: 0 }, 200, media, stage).scale, 2);
  assert.equal(viewerPinch(start, { x: 0, y: 0 }, 50, media, stage).scale, 1);
  assert.equal(viewerPinch(start, { x: 0, y: 0 }, 900, media, stage).scale, viewerZoomMax);
  const dragged = viewerPinch(start, { x: -40, y: 0 }, 200, media, stage);
  assert.equal(dragged.scale, 2);
  assert.equal(dragged.x, -40);
  // A degenerate start distance does not blow up.
  assert.equal(viewerPinch({ ...start, distance: 0 }, { x: 0, y: 0 }, 200, media, stage).scale, 1);
  // Pinching further on an already enlarged photograph multiplies.
  const again = viewerPinch({ zoom: dragged, distance: 100, mid: { x: -40, y: 0 } }, { x: -40, y: 0 }, 150, media, stage);
  assert.equal(again.scale, 3);
});

test("panning moves an enlarged photograph and stops at its edges", () => {
  const zoom = { scale: 2, x: 0, y: 0 };
  assert.deepEqual(viewerPan(zoom, -100, 5, media, stage), { scale: 2, x: -100, y: 0 });
  assert.equal(viewerPan(zoom, -5000, 0, media, stage).x, -(335 * 2 - 390) / 2);
  assert.equal(viewerPan(zoom, 5000, 0, media, stage).x, (335 * 2 - 390) / 2);
  // At 1× there is nothing to pan.
  assert.deepEqual(viewerPan(viewerZoomIdle, 80, 80, media, stage), viewerZoomIdle);
});

test("double tap toggles between 1× and the double-tap scale", () => {
  const focal = { x: -30, y: 12 };
  const zoomed = viewerToggleZoom(viewerZoomIdle, focal, media, stage);
  assert.equal(zoomed.scale, viewerDoubleTapScale);
  assert.ok(viewerDoubleTapScale <= viewerZoomMax);
  assert.deepEqual(viewerToggleZoom(zoomed, focal, media, stage), viewerZoomIdle);
  // Any enlarged state goes back to 1×.
  assert.deepEqual(viewerToggleZoom({ scale: 1.3, x: 4, y: 0 }, focal, media, stage), viewerZoomIdle);
});

test("trackpad pinch zooms smoothly in both directions and is bounded", () => {
  const focal = { x: 0, y: 0 };
  const inward = viewerWheelZoom(viewerZoomIdle, -20, focal, media, stage);
  assert.ok(inward.scale > 1 && inward.scale < viewerZoomMax);
  const back = viewerWheelZoom(inward, 20, focal, media, stage);
  assert.ok(Math.abs(back.scale - 1) < 1e-9 || back.scale === 1);
  assert.equal(viewerWheelZoom(viewerZoomIdle, 400, focal, media, stage).scale, 1);
  assert.equal(viewerWheelZoom({ scale: 2.9, x: 0, y: 0 }, -400, focal, media, stage).scale, viewerZoomMax);
});

test("taps and double taps are short, still and close together", () => {
  assert.equal(viewerIsTap(2, 3, 120), true);
  assert.equal(viewerIsTap(12, 0, 120), false);
  assert.equal(viewerIsTap(0, 0, 600), false);
  const first = { time: 1000, x: 100, y: 100 };
  assert.equal(viewerIsDoubleTap(null, first), false);
  assert.equal(viewerIsDoubleTap(first, { time: 1000 + viewerDoubleTapInterval, x: 110, y: 95 }), true);
  assert.equal(viewerIsDoubleTap(first, { time: 1000 + viewerDoubleTapInterval + 1, x: 100, y: 100 }), false);
  assert.equal(viewerIsDoubleTap(first, { time: 1100, x: 200, y: 100 }), false);
  assert.equal(viewerIsDoubleTap(first, { time: 900, x: 100, y: 100 }), false);
});
