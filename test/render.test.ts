import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { HEADINGS, formatRange, renderResume } from "../src/render";
import { parseResume, type Resume } from "../src/schema";

const sample = parseResume(readFileSync("examples/resume.json", "utf8"));

async function pdfText(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  const ops = await (await doc.getPage(1)).getOperatorList();
  return { pages, numPages: doc.numPages, ops };
}

describe("renderResume", () => {
  it("produces one page of selectable text with standard headings", async () => {
    const { pdf, pages } = await renderResume(sample);
    const out = await pdfText(pdf);
    expect(pages).toBe(1);
    expect(out.numPages).toBe(1);
    const text = out.pages[0];
    expect(text).toContain("Mira Okonkwo-Lind");
    expect(text).toContain("mira@example.com");
    for (const h of [HEADINGS.summary, HEADINGS.skills, HEADINGS.work, HEADINGS.projects, HEADINGS.education]) expect(text).toContain(h);
    expect(text).toContain("Senior Frontend Engineer, Fernhill Analytics");
    expect(text).toContain("Apr 2022 - Present");
  });

  it("keeps headings in reading order", async () => {
    const text = (await pdfText((await renderResume(sample)).pdf)).pages[0];
    const order = [HEADINGS.summary, HEADINGS.skills, HEADINGS.work, HEADINGS.projects, HEADINGS.education].map((h) => text.indexOf(h));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("contains no images", async () => {
    const { ops } = await pdfText((await renderResume(sample)).pdf);
    // OPS.paintImageXObject = 85, paintInlineImageXObject = 86, paintJpegXObject = 82
    expect(ops.fnArray.some((f: number) => f === 82 || f === 85 || f === 86)).toBe(false);
  });

  it("shrinks long resumes to fit, then spills to page 2 only when it must", async () => {
    const bullets = Array.from({ length: 4 }, (_, i) => `Did a meaningful thing number ${i} with measurable results for the team.`);
    const many = (n: number): Resume => ({ ...sample, work: Array.from({ length: n }, () => ({ ...sample.work![0], highlights: bullets })) });
    const mid = await renderResume(many(5));
    expect(mid.pages).toBe(1);
    expect(mid.scale).toBeLessThan(1);
    const huge = await renderResume(many(20));
    expect(huge.pages).toBeGreaterThan(1);
  });

  it("survives characters the standard fonts cannot encode", async () => {
    const r = await renderResume({ basics: { name: "Zoë 李 Test", summary: "Tabs\tand “quotes” — fine" } });
    expect((await pdfText(r.pdf)).pages[0]).toContain("Zoë");
  });

  it("formats date ranges", () => {
    expect(formatRange("2019-06", "2022-03")).toBe("Jun 2019 - Mar 2022");
    expect(formatRange("2015", "2019")).toBe("2015 - 2019");
    expect(formatRange("2022-04")).toBe("Apr 2022 - Present");
    expect(formatRange()).toBe("");
  });
});

describe("parseResume", () => {
  it("rejects bad input with a readable error", () => {
    expect(() => parseResume("{nope")).toThrow(/not valid JSON/);
    expect(() => parseResume("[]")).toThrow(/object/);
    expect(() => parseResume('{"work": {}}')).toThrow(/"work" must be an array/);
  });
});
