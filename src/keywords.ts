import type { Resume } from "./schema.js";

/** A skill term: canonical name plus the spellings that count as the same thing. */
export interface Term { name: string; aliases?: string[]; caseSensitive?: boolean }

// ponytail: curated dictionary, not NLP. Covers common software / web / data / soft-skill terms;
// pass `extraTerms` for domain-specific words. Swap for a model-based extractor if recall matters more.
export const TERMS: Term[] = [
  // Languages
  { name: "JavaScript", aliases: ["js", "es6", "ecmascript"] },
  { name: "TypeScript", aliases: ["ts"] },
  { name: "Python" }, { name: "Java" }, { name: "Kotlin" }, { name: "Swift", caseSensitive: true }, { name: "Ruby" }, { name: "PHP" },
  { name: "Go", aliases: ["golang"], caseSensitive: true },
  { name: "Rust" }, { name: "C#", aliases: ["csharp"] }, { name: "C++", aliases: ["cpp"] }, { name: "Scala" },
  { name: "SQL" }, { name: "HTML", aliases: ["html5"] }, { name: "CSS", aliases: ["css3"] }, { name: "Sass", aliases: ["scss"] },
  { name: "Bash", aliases: ["shell scripting"] }, { name: "Dart" }, { name: "Elixir" },
  // Frontend
  { name: "React", aliases: ["react.js", "reactjs"] }, { name: "Next.js", aliases: ["nextjs"] },
  { name: "Vue", aliases: ["vue.js", "vuejs"] }, { name: "Nuxt" }, { name: "Angular" }, { name: "Svelte", aliases: ["sveltekit"] },
  { name: "Redux", aliases: ["redux toolkit"] }, { name: "Zustand" }, { name: "React Query", aliases: ["tanstack query"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"] }, { name: "CSS-in-JS", aliases: ["styled-components", "emotion"] },
  { name: "Webpack" }, { name: "Vite" }, { name: "Storybook" }, { name: "Design systems", aliases: ["design system"] },
  { name: "Accessibility", aliases: ["a11y", "wcag"] }, { name: "Responsive design", aliases: ["responsive"] },
  { name: "Web performance", aliases: ["core web vitals", "performance optimization", "lighthouse"] },
  { name: "SSR", aliases: ["server-side rendering", "server side rendering"] },
  { name: "React Native" }, { name: "Flutter" }, { name: "Electron" }, { name: "PWA", aliases: ["progressive web app"] },
  { name: "Three.js", aliases: ["threejs", "webgl"] }, { name: "D3", aliases: ["d3.js"] },
  // Backend / APIs
  { name: "Node.js", aliases: ["node", "nodejs"] }, { name: "Express", aliases: ["express.js", "expressjs"], caseSensitive: true }, { name: "NestJS" },
  { name: "Django" }, { name: "Flask" }, { name: "FastAPI" }, { name: "Spring", aliases: ["spring boot"] }, { name: "Rails", aliases: ["ruby on rails"] },
  { name: "GraphQL", aliases: ["apollo"] }, { name: "REST", aliases: ["rest api", "restful", "rest apis"] }, { name: "gRPC" },
  { name: "WebSockets", aliases: ["websocket"] }, { name: "Microservices", aliases: ["microservice"] },
  // Data
  { name: "PostgreSQL", aliases: ["postgres"] }, { name: "MySQL" }, { name: "MongoDB", aliases: ["mongo"] }, { name: "Redis" },
  { name: "SQLite" }, { name: "Elasticsearch" }, { name: "Kafka" }, { name: "Spark" }, { name: "Pandas" },
  { name: "Machine learning", aliases: ["ml"] }, { name: "LLM", aliases: ["llms", "large language models", "generative ai", "genai"] },
  { name: "Data visualization", aliases: ["data viz"] },
  // Cloud / DevOps
  { name: "AWS", aliases: ["amazon web services"] }, { name: "GCP", aliases: ["google cloud"] }, { name: "Azure" },
  { name: "Docker" }, { name: "Kubernetes", aliases: ["k8s"] }, { name: "Terraform" }, { name: "CI/CD", aliases: ["ci", "continuous integration"] },
  { name: "GitHub Actions" }, { name: "Vercel" }, { name: "Cloudflare" }, { name: "Linux" }, { name: "Git" },
  { name: "Observability", aliases: ["monitoring", "sentry", "datadog"] },
  // Testing
  { name: "Unit testing", aliases: ["unit tests"] }, { name: "Jest" }, { name: "Vitest" },
  { name: "Testing Library", aliases: ["react testing library", "rtl"] }, { name: "Playwright" }, { name: "Cypress" },
  { name: "End-to-end testing", aliases: ["e2e", "end to end testing", "e2e testing"] }, { name: "TDD", aliases: ["test-driven development"] },
  // Practices / soft skills
  { name: "Agile", aliases: ["scrum", "kanban"] }, { name: "Code review", aliases: ["code reviews"] },
  { name: "Mentoring", aliases: ["mentor", "mentorship"] }, { name: "Leadership", aliases: ["technical leadership"] },
  { name: "Communication", aliases: ["communicator"] }, { name: "Collaboration", aliases: ["cross-functional"] },
  { name: "System design", aliases: ["architecture"] }, { name: "Security", aliases: ["owasp"] },
  { name: "Figma" }, { name: "A/B testing", aliases: ["experimentation"] }, { name: "Analytics" },
  { name: "Internationalization", aliases: ["i18n", "localization"] },
];

export type Priority = "required" | "preferred";

export interface Requirement { name: string; priority: Priority; count: number }
export interface TermMatch extends Requirement {
  /** Resume sections where the term was found, e.g. ["skills", "work"]. */
  foundIn: string[];
  /** Spelling used in the job description, if the resume uses a different one. */
  exactMissing?: string;
}
export interface MatchReport {
  /** Weighted coverage 0-100 (required terms count double). */
  coverage: number;
  requiredCoverage: number;
  matched: TermMatch[];
  missing: Requirement[];
  suggestions: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function patterns(t: Term): { re: RegExp; spelling: string }[] {
  return [t.name, ...(t.aliases ?? [])].map((spelling) => ({
    spelling,
    // Custom boundaries so "C++", "Node.js" and "CI/CD" match but "Java" does not match "JavaScript".
    re: new RegExp(`(?<![\\w+#.])${escape(spelling)}(?![\\w+#]|\\.\\w)`, t.caseSensitive ? "g" : "gi"),
  }));
}

function find(t: Term, text: string): { count: number; spellings: Set<string> } {
  let count = 0;
  const spellings = new Set<string>();
  for (const p of patterns(t)) {
    const hits = text.match(p.re);
    if (hits) { count += hits.length; spellings.add(p.spelling.toLowerCase()); }
  }
  return { count, spellings };
}

const PREFERRED = /\b(nice to have|nice-to-have|preferred|bonus|a plus|plus if|ideally|desirable|good to have)\b/i;
const REQUIRED_HEAD = /\b(requirements|required|must|qualifications|what you('| wi)ll need|you have|what we('re)? look)/i;

/**
 * Pull skills and requirements out of a job description.
 * A term is "preferred" when every line mentioning it sits under a nice-to-have heading or says "preferred"/"bonus".
 */
export function extractRequirements(jd: string, extraTerms: Term[] = []): Requirement[] {
  const terms = [...TERMS, ...extraTerms];
  const byName = new Map<string, Requirement>();
  let section: Priority = "required";
  for (const line of jd.split(/\r?\n/)) {
    const trimmed = line.trim();
    // A heading: short, not a bullet, not a sentence. e.g. "Nice to have:" or "Requirements"
    const isHeading = !/^[-*\u2022\d]/.test(trimmed) && trimmed.split(/\s+/).length <= 6 && !/\.$/.test(trimmed);
    if (isHeading && PREFERRED.test(line)) section = "preferred";
    else if (isHeading && REQUIRED_HEAD.test(line)) section = "required";
    const priority: Priority = section === "preferred" || PREFERRED.test(line) ? "preferred" : "required";
    for (const t of terms) {
      const { count } = find(t, line);
      if (!count) continue;
      const prev = byName.get(t.name);
      if (!prev) byName.set(t.name, { name: t.name, priority, count });
      else { prev.count += count; if (priority === "required") prev.priority = "required"; }
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.priority === b.priority ? b.count - a.count || a.name.localeCompare(b.name) : a.priority === "required" ? -1 : 1,
  );
}

/** Flatten a resume into searchable text per section. */
export function resumeSections(r: Resume): Record<string, string> {
  const b = r.basics ?? {};
  const s = (xs: (string | undefined)[]) => xs.filter(Boolean).join("\n");
  return {
    summary: s([b.label, b.summary]),
    skills: s((r.skills ?? []).flatMap((k) => [k.name, ...(k.keywords ?? [])])),
    work: s((r.work ?? []).flatMap((w) => [w.position, w.summary, ...(w.highlights ?? [])])),
    projects: s((r.projects ?? []).flatMap((p) => [p.name, p.description, ...(p.highlights ?? []), ...(p.keywords ?? [])])),
    education: s((r.education ?? []).flatMap((e) => [e.area, e.studyType])),
    certificates: s((r.certificates ?? []).map((c) => c.name)),
  };
}

/**
 * Compare a resume with a job description. Suggestions only point at wording and placement;
 * they never tell you to claim experience the resume does not show.
 */
export function matchResume(r: Resume, jd: string, extraTerms: Term[] = []): MatchReport {
  const terms = new Map([...TERMS, ...extraTerms].map((t) => [t.name, t]));
  const reqs = extractRequirements(jd, extraTerms);
  const sections = resumeSections(r);
  const matched: TermMatch[] = [];
  const missing: Requirement[] = [];

  for (const req of reqs) {
    const t = terms.get(req.name)!;
    const foundIn = Object.entries(sections).filter(([, text]) => find(t, text).count > 0).map(([k]) => k);
    if (!foundIn.length) { missing.push(req); continue; }
    const jdSpellings = find(t, jd).spellings;
    const resumeSpellings = find(t, Object.values(sections).join("\n")).spellings;
    const shared = [...jdSpellings].some((x) => resumeSpellings.has(x));
    const jdWord = patterns(t).find((p) => jdSpellings.has(p.spelling.toLowerCase()))?.spelling;
    matched.push({ ...req, foundIn, exactMissing: shared ? undefined : jdWord });
  }

  const weight = (x: Requirement) => (x.priority === "required" ? 2 : 1);
  const total = reqs.reduce((n, x) => n + weight(x), 0);
  const got = matched.reduce((n, x) => n + weight(x), 0);
  const reqTotal = reqs.filter((x) => x.priority === "required").length;
  const reqGot = matched.filter((x) => x.priority === "required").length;

  const suggestions: string[] = [];
  for (const m of matched) {
    if (m.exactMissing) suggestions.push(`The job says "${m.exactMissing}". Your resume uses another spelling of ${m.name}; using the job's exact wording helps keyword filters.`);
    else if (m.priority === "required" && m.foundIn.length === 1 && m.foundIn[0] === "skills")
      suggestions.push(`${m.name} is only in your Skills list. If you used it in a role or project, name it in that bullet so the context is visible.`);
  }
  for (const m of missing) {
    suggestions.push(
      m.priority === "required"
        ? `${m.name} (required): not found. If you have real experience with it, add it to Skills and to the bullet where you used it.`
        : `${m.name} (nice to have): not found. Add it only if you have actually used it.`,
    );
  }

  return {
    coverage: total ? Math.round((got / total) * 100) : 100,
    requiredCoverage: reqTotal ? Math.round((reqGot / reqTotal) * 100) : 100,
    matched,
    missing,
    suggestions,
  };
}
