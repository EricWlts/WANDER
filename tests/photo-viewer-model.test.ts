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
