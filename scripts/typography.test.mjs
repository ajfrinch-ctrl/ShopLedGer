import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const css = readFileSync(new URL("src/styles.css", root), "utf8");

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx$/.test(path) ? [path] : [];
  });
}

test("every page uses the shared typography roles, not ad-hoc sizes or fonts", () => {
  for (const file of sourceFiles(new URL("src", root).pathname)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /text-\[\d+(?:\.\d+)?(?:px|rem|em)\]/, file);
    assert.doesNotMatch(source, /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/, file);
    assert.doesNotMatch(source, /\bfont-(?:mono|serif|medium|semibold)\b/, file);
  }
});

test("one local Bengali font and four readable text roles", () => {
  assert.match(css, /--font-sans: "Noto Sans Bengali", sans-serif/);
  for (const [role, rem] of Object.entries({
    caption: "0.75",
    body: "0.875",
    heading: "1.125",
    input: "1",
  })) {
    assert.ok(css.includes(`--text-${role}: ${rem}rem;`), role);
    assert.ok(css.includes(`--text-${role}--line-height: 1.5;`), role);
  }
  for (const weight of ["Regular", "Bold"]) {
    assert.ok(
      readFileSync(new URL(`src/assets/fonts/NotoSansBengali-${weight}.ttf`, root)).length > 1000,
    );
  }
});

test("PDF uses the same role sizes after converting pixels to points", () => {
  const pdf = readFileSync(new URL("src/lib/reports/pdf-layout.ts", root), "utf8");
  const roles = /const PDF_TYPE = \{ heading: ([\d.]+), body: ([\d.]+), caption: ([\d.]+) \}/.exec(
    pdf,
  );
  assert.ok(roles);
  for (const [index, role] of ["heading", "body", "caption"].entries()) {
    const rem = Number(new RegExp(`--text-${role}: ([\\d.]+)rem`).exec(css)[1]);
    assert.equal(Number(roles[index + 1]), (rem * 16 * 72) / 96, role);
  }
});
