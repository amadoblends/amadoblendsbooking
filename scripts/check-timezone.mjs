/**
 * Fails if any code formats a stored timestamp without naming the shop's
 * timezone.
 *
 *   node scripts/check-timezone.mjs
 *
 * This bug has now appeared three times — the client's appointment screens,
 * then the barber's dashboard, then a handful of client components — always
 * the same shape and always invisible in review, because the code looks
 * correct and only misbehaves where the server's timezone differs from the
 * shop's. A grep is a blunt instrument, but it catches the exact mistake in a
 * second instead of after a customer notices their 9am appointment says 1pm.
 *
 * Everything that turns a timestamp into text must go through lib/timezone.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the project folder has spaces in its name,
// which arrive percent-encoded otherwise.
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src");

/** Patterns that read the ambient timezone instead of the shop's. */
const BANNED = [
  {
    re: /\.toLocaleTimeString\s*\(/,
    why: "toLocaleTimeString uses the runtime's timezone — use shopTime()",
  },
  {
    re: /\.toLocaleDateString\s*\(/,
    why: "toLocaleDateString uses the runtime's timezone — use shopFormat()",
  },
  {
    // date-fns format() applied straight to a timestamp column
    re: /\bformat\s*\(\s*new Date\(\s*\w+\.(starts_at|ends_at|created_at|updated_at)/,
    why: "date-fns format() uses the runtime's timezone — use shopFormat() / shopTime()",
  },
  {
    // The hour and minute are often expressions, not plain names — the
    // reschedule modals passed Math.floor(t / 60) and slipped through a
    // pattern that only matched \w+.
    re: /new Date\(\s*[^,()]+\s*,\s*[^,()]*-\s*1\s*,\s*[^,()]+\s*,\s*[^,]+\s*,/,
    why: "new Date(y, m, d, h, mi) builds in the device's timezone — use shopDateAt()",
  },
];

/** Files allowed to contain them: the module that implements the rule. */
const ALLOW = [/lib[\\/]timezone\.ts$/, /scripts[\\/]/];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

let problems = 0;

for (const file of walk(ROOT)) {
  if (ALLOW.some((re) => re.test(file))) continue;
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, i) => {
    // A line that already names the shop is fine, as are comments about it
    if (/shopTime|shopFormat|shopDateAt|shopDateStr|shopLongDate|shopShortDate/.test(line)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;

    for (const { re, why } of BANNED) {
      if (re.test(line)) {
        problems++;
        console.log(`\n  ${relative(ROOT, file)}:${i + 1}`);
        console.log(`    ${line.trim().slice(0, 100)}`);
        console.log(`    → ${why}`);
      }
    }
  });
}

if (problems) {
  console.log(`\n${problems} lugar(es) formatean una hora sin la zona de la barbería.\n`);
  process.exit(1);
}
console.log("Zona horaria: todo pasa por lib/timezone ✓");
