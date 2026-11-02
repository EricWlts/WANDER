import test from "node:test";
import assert from "node:assert/strict";
import { observePicture } from "../src/pictureLoading.ts";

class ImageStub extends EventTarget {
  src = "a.jpg";
  currentSrc = "a.jpg";
  complete = false;
  naturalWidth = 0;
  pending: { resolve: () => void; reject: () => void }[] = [];
  decode() {
    return new Promise<void>((resolve, reject) =>
      this.pending.push({ resolve, reject: () => reject(new Error("decode")) }),
    );
  }
  load() {
    this.complete = true;
    this.naturalWidth = 1200;
    this.dispatchEvent(new Event("load"));
  }
}
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));
function setup(image = new ImageStub()) {
  const states: string[] = [];
  const dispose = observePicture(
    image as unknown as HTMLImageElement,
    (state) => states.push(state),
  );
  return { image, states, dispose };
}

test("delayed load stays loading until decode completes", async () => {
  const { image, states } = setup();
  assert.deepEqual(states, ["loading"]);
  image.load();
  assert.equal(states.at(-1), "loading");
  image.pending[0].resolve();
  await tick();
  assert.equal(states.at(-1), "ready");
});

test("cached success and cached failure settle without a load event", async () => {
  const image = new ImageStub();
  image.complete = true;
  image.naturalWidth = 500;
  const cached = setup(image);
  image.pending[0].resolve();
  await tick();
  assert.equal(cached.states.at(-1), "ready");
  const broken = new ImageStub();
  broken.complete = true;
  assert.deepEqual(setup(broken).states, ["loading", "error"]);
});

test("error invalidates an older pending decode", async () => {
  const { image, states } = setup();
  image.load();
  image.naturalWidth = 0;
  image.dispatchEvent(new Event("error"));
  image.pending[0].resolve();
  await tick();
  assert.equal(states.at(-1), "error");
  assert.equal(states.includes("ready"), false);
});

test("source replacement and unmount dispose old asynchronous work and listeners", async () => {
  const old = setup();
  old.image.load();
  old.dispose();
  const active = setup();
  active.image.src = active.image.currentSrc = "b.jpg";
  old.image.pending[0].resolve();
  old.image.dispatchEvent(new Event("error"));
  old.image.load();
  await tick();
  assert.deepEqual(old.states, ["loading", "loading"]);
  assert.deepEqual(active.states, ["loading"]);
  active.image.load();
  active.image.pending[0].resolve();
  await tick();
  assert.equal(active.states.at(-1), "ready");
});

test("new responsive candidate invalidates old decode even before its load event", async () => {
  const { image, states } = setup();
  image.load();
  image.currentSrc = "large.jpg";
  image.pending[0].resolve();
  await tick();
  assert.equal(states.at(-1), "loading");
  image.load();
  image.pending[1].resolve();
  await tick();
  assert.equal(states.at(-1), "ready");
});

test("out of order decodes only release the latest load", async () => {
  const { image, states } = setup();
  image.load();
  image.load();
  image.pending[0].resolve();
  await tick();
  assert.equal(states.at(-1), "loading");
  image.pending[1].resolve();
  await tick();
  assert.equal(states.at(-1), "ready");
});

test("decode rejection accepts usable pixels but reports a broken image", async () => {
  const usable = setup();
  usable.image.load();
  usable.image.pending[0].reject();
  await tick();
  assert.equal(usable.states.at(-1), "ready");
  const broken = setup();
  broken.image.load();
  broken.image.naturalWidth = 0;
  broken.image.pending[0].reject();
  await tick();
  assert.equal(broken.states.at(-1), "error");
});

test("effect cleanup and re-subscription supports StrictMode cache completion", async () => {
  const first = setup();
  first.image.load();
  first.dispose();
  const second = setup(first.image);
  first.image.pending[0].resolve();
  first.image.pending[1].resolve();
  await tick();
  assert.equal(first.states.includes("ready"), false);
  assert.equal(second.states.at(-1), "ready");
});
