import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const publicDir = new URL("../public/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.webmanifest", publicDir), "utf8"));

test("install icons have standard sizes and a separate maskable asset", () => {
  for (const sizes of ["192x192", "512x512"]) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === sizes && icon.purpose === "any"));
  }
  const maskable = manifest.icons.find((icon) => icon.purpose === "maskable");
  assert.ok(maskable);
  assert.equal(maskable.sizes, "512x512");
  assert.ok(!manifest.icons.some((icon) => icon.purpose === "any" && icon.src === maskable.src));
});

test("manifest stays within both root and GitHub Pages deployments", () => {
  for (const base of ["/", "/ShopLedGer/"]) {
    const url = new URL(`${base}manifest.webmanifest?v=2`, "https://example.com");
    for (const key of ["id", "start_url", "scope"]) {
      assert.equal(new URL(manifest[key], url).pathname, base);
    }
    for (const icon of manifest.icons) {
      assert.ok(new URL(icon.src, url).pathname.startsWith(base));
      assert.equal(new URL(icon.src, url).origin, url.origin);
      assert.equal(new URL(icon.src, url).searchParams.get("v"), "2");
    }
  }
});

test("all install and touch assets are correctly sized opaque color PNGs", async () => {
  const icons = [
    ...manifest.icons,
    { src: "./icon-180.png?v=2", sizes: "180x180", type: "image/png" },
  ];
  for (const icon of icons) {
    const file = new URL(icon.src, publicDir);
    file.search = "";
    const bytes = await readFile(file);
    assert.equal(icon.type, "image/png");
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", icon.src);
    assert.equal(bytes.subarray(12, 16).toString(), "IHDR", icon.src);
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes, icon.src);
    assert.equal(bytes[24], 8, "8-bit color");
    // The old 192/512 assets were grayscale template placeholders.
    assert.equal(bytes[25], 2, `Expected opaque RGB shop logo: ${icon.src}`);
  }
});
