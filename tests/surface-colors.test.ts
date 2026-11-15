import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, editionColors, surfaceColors } from "../src/journalModel.ts";

function expectedContrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color
      .slice(1)
      .match(color.length === 4 ? /./g : /../g)!
      .map((channel) =>
        parseInt(channel.length === 1 ? channel + channel : channel, 16) / 255,
      )
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("edition surfaces keep their established brand ink with accessible contrast", () => {
  const before = structuredClone(editionColors);
  assert.deepEqual(surfaceColors(editionColors["quiet-atlas"]), {
    background: "#EEECE6",
    ink: "#26302B",
  });
  assert.deepEqual(surfaceColors(editionColors["after-hours"]), {
    background: "#1A1D18",
    ink: "#F2F3EF",
  });
  for (const background of Object.values(editionColors)) {
    const { ink } = surfaceColors(background);
    assert.ok(expectedContrast(ink, background) >= 4.5);
  }
  assert.deepEqual(editionColors, before);
});

test("#949494 uses a neutral fallback that reaches 4.5:1 without rounding", () => {
  const result = surfaceColors("#949494");
  assert.equal(result.ink, "#000000");
  assert.ok(expectedContrast(result.ink, result.background) >= 4.5);
  assert.equal(expectedContrast("#26302B", "#949494") < 4.5, true);
  assert.equal(expectedContrast("#F2F3EF", "#949494") < 4.5, true);
});

test("automatic ink handles black, white, and colored midtone backgrounds", () => {
  for (const background of ["#000000", "#FFFFFF", "#704214", "#3498DB"]) {
    const { ink } = surfaceColors(background);
    assert.ok(
      expectedContrast(ink, background) >= 4.5,
      `${ink} on ${background} must reach 4.5:1`,
    );
  }
  assert.equal(surfaceColors("#000000").ink, "#F2F3EF");
  assert.equal(surfaceColors("#FFFFFF").ink, "#26302B");
});

test("three- and six-digit HEX inputs are equivalent and remain unchanged", () => {
  for (const [shortHex, longHex] of [
    ["#abc", "#aabbcc"],
    ["#949", "#994499"],
    ["#369", "#336699"],
  ]) {
    const before = [shortHex, longHex];
    const shortResult = surfaceColors(shortHex);
    const longResult = surfaceColors(longHex);
    assert.equal(shortResult.ink, longResult.ink);
    assert.equal(shortResult.background, shortHex);
    assert.equal(longResult.background, longHex);
    assert.deepEqual([shortHex, longHex], before);
  }
});

test("contrastRatio reports the linear sRGB ratio without rounded thresholds", () => {
  const precise = contrastRatio("#26302B", "#949494");
  assert.ok(precise > 4.494 && precise < 4.496);
  assert.ok(precise < 4.5);
  assert.ok(contrastRatio("#000000", "#949494") > 4.5);
});
