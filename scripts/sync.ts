#!/usr/bin/env bun
// Copies the faces from the Multimeter app repo into this repo.
//   bun scripts/sync.ts            (from the multimeter-faces root)
// faces/    <- ~/great-work/multimeter/Meters/<face>/            (the built-in faces)
// examples/ <- ~/great-work/multimeter-site/scripts/example-meters/<example>/
// Code comments that name the app's rendering engine are reworded on the way in.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

const ROOT = process.cwd();
if (!existsSync(join(ROOT, "scripts/sync.ts")) || !existsSync(join(ROOT, "LICENSE"))) {
  console.error(`sync: run this from the multimeter-faces repo root (current directory: ${ROOT})`);
  process.exit(2);
}
const GW = resolve(process.env.GREAT_WORK ?? join(homedir(), "great-work"));
const sources: [string, string][] = [
  [join(GW, "multimeter/Meters"), join(ROOT, "faces")],
  [join(GW, "multimeter-site/scripts/example-meters"), join(ROOT, "examples")],
];
const REWORD: [RegExp, string][] = [
  [/\/\/ WebKit redraw the menu bar at/g, "// the menu bar redraw at"],
  [/\/\/ WebKit redraw at/g, "// it redraw at"],
];

for (const [from, to] of sources) {
  if (!existsSync(from)) { console.error(`sync: missing ${from}`); process.exit(1); }
  rmSync(to, { recursive: true, force: true });
  let n = 0;
  for (const name of readdirSync(from)) {
    const dir = join(from, name);
    if (!statSync(dir).isDirectory() || !existsSync(join(dir, "manifest.json"))) continue;
    cpSync(dir, join(to, name), { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });
    n++;
  }
  for (const face of readdirSync(to)) {
    for (const file of readdirSync(join(to, face))) {
      if (!/\.(js|html|css)$/.test(file)) continue;
      const p = join(to, face, file);
      const before = readFileSync(p, "utf8");
      const after = REWORD.reduce((s, [re, rep]) => s.replace(re, rep), before);
      if (after !== before) writeFileSync(p, after);
    }
  }
  console.log(`${to}: ${n} faces`);
}
const leftover = Bun.spawnSync(["grep", "-rIl", "-i", "webkit [a-z]\\|web view\\|webview", "faces", "examples"]).stdout.toString().trim();
if (leftover) { console.error(`sync: engine names left in:\n${leftover}`); process.exit(1); }
