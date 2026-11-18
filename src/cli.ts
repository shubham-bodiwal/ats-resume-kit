#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseResume } from "./schema.js";
import { renderResume } from "./render.js";
import { matchResume } from "./keywords.js";

const USAGE = `ats-resume <command>

  render <resume.json> [-o resume.pdf] [--a4] [--no-fit]
      Render a JSON Resume to an ATS-safe PDF.

  match <resume.json> <job.txt> [--json] [--min <pct>]
      Show keyword coverage against a job description.
      --min exits with code 1 when coverage is below <pct>.
`;

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      a4: { type: "boolean" },
      "no-fit": { type: "boolean" },
      json: { type: "boolean" },
      min: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, resumePath, jdPath] = positionals;
  if (values.help || !cmd || !resumePath) return void process.stdout.write(USAGE);
  const resume = parseResume(readFileSync(resumePath, "utf8"));

  if (cmd === "render") {
    const out = values.out ?? resumePath.replace(/\.json$/i, "") + ".pdf";
    const r = await renderResume(resume, { pageSize: values.a4 ? "a4" : "letter", fitOnePage: !values["no-fit"] });
    writeFileSync(out, r.pdf);
    console.log(`Wrote ${out} (${r.pages} page${r.pages > 1 ? "s" : ""}, scale ${r.scale})`);
    if (r.pages > 1) console.warn("Warning: content does not fit on one page. Trim older roles or bullets.");
    return;
  }

  if (cmd === "match") {
    if (!jdPath) throw new Error("match needs a job description file.");
    const report = matchResume(resume, readFileSync(jdPath, "utf8"));
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Coverage: ${report.coverage}%  (required terms: ${report.requiredCoverage}%)\n`);
      console.log(`Matched (${report.matched.length}): ${report.matched.map((m) => m.name).join(", ") || "none"}`);
      console.log(`Missing (${report.missing.length}): ${report.missing.map((m) => `${m.name}${m.priority === "preferred" ? " (nice to have)" : ""}`).join(", ") || "none"}\n`);
      for (const s of report.suggestions) console.log(`- ${s}`);
    }
    if (values.min && report.coverage < Number(values.min)) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command "${cmd}".\n\n${USAGE}`);
}

main(process.argv.slice(2)).catch((e: Error) => {
  console.error(e.message);
  process.exit(2);
});
