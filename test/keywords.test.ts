import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractRequirements, matchResume } from "../src/keywords";
import { parseResume, type Resume } from "../src/schema";

const sample = parseResume(readFileSync("examples/resume.json", "utf8"));
const jd = readFileSync("examples/job.txt", "utf8");

describe("extractRequirements", () => {
  it("finds terms and handles punctuation in names", () => {
    const names = extractRequirements("We use Node.js, C++, C# and CI/CD. JavaScript only, no Java.").map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["Node.js", "C++", "C#", "CI/CD", "JavaScript"]));
    expect(names).toContain("Java"); // "no Java" still mentions Java
    expect(extractRequirements("JavaScript developer").map((r) => r.name)).not.toContain("Java");
  });

  it("treats aliases as the same term", () => {
    const reqs = extractRequirements("k8s and Kubernetes, ReactJS");
    expect(reqs.find((r) => r.name === "Kubernetes")?.count).toBe(2);
    expect(reqs.map((r) => r.name)).toContain("React");
  });

  it("marks nice-to-have sections and inline 'preferred' as preferred", () => {
    const reqs = extractRequirements(jd);
    const p = (n: string) => reqs.find((r) => r.name === n)?.priority;
    expect(p("React")).toBe("required");
    expect(p("AWS")).toBe("preferred");
    expect(p("D3")).toBe("preferred");
    expect(extractRequirements("- Docker experience is a plus")[0].priority).toBe("preferred");
  });

  it("does not flip sections on a short bullet", () => {
    const reqs = extractRequirements("Requirements\n- Vue is a plus\n- Angular");
    expect(reqs.find((r) => r.name === "Angular")?.priority).toBe("required");
  });

  it("supports extra domain terms", () => {
    expect(extractRequirements("Must know Remix", [{ name: "Remix" }])[0].name).toBe("Remix");
  });
});

describe("matchResume", () => {
  it("reports coverage, matched and missing", () => {
    const r = matchResume(sample, jd);
    const matched = r.matched.map((m) => m.name);
    expect(matched).toEqual(expect.arrayContaining(["React", "TypeScript", "Next.js", "Playwright", "GraphQL"]));
    expect(r.missing.map((m) => m.name)).toEqual(expect.arrayContaining(["AWS", "Kubernetes", "Vitest"]));
    expect(r.coverage).toBeGreaterThan(50);
    expect(r.coverage).toBeLessThan(100);
  });

  it("weights required terms double", () => {
    const resume: Resume = { skills: [{ keywords: ["React"] }] };
    const r = matchResume(resume, "Requirements\nReact\nNice to have\nVue");
    expect(r.coverage).toBe(67); // 2 of 3 weighted points
    expect(r.requiredCoverage).toBe(100);
  });

  it("is 100% for a JD with no known terms", () => {
    expect(matchResume(sample, "We value kindness.").coverage).toBe(100);
  });

  it("suggests exact wording when the resume uses an alias", () => {
    const r = matchResume({ skills: [{ keywords: ["k8s"] }] }, "Kubernetes required");
    expect(r.suggestions[0]).toMatch(/"Kubernetes"/);
  });

  it("never tells you to claim missing experience", () => {
    for (const s of matchResume(sample, jd).suggestions) {
      if (/not found/.test(s)) expect(s).toMatch(/If you have real experience|only if you have actually used it/);
      expect(s).not.toMatch(/\badd (it|this) to your experience\b/i);
    }
  });
});
