import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard header does not show a real-time status badge", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /class=["'][^"']*realtime-pill[^"']*["']/i);
  assert.doesNotMatch(html, />\s*Real-time\s*</i);
});
