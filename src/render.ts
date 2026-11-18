import { PDFDocument, type PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { Resume, Work, Project } from "./schema.js";

export interface RenderOptions {
  /** Paper size. Default "letter". */
  pageSize?: "letter" | "a4";
  /** Shrink type (down to 80%) to keep everything on one page. Default true. */
  fitOnePage?: boolean;
}

export interface RenderResult {
  pdf: Uint8Array;
  /** Number of pages produced. 1 unless the content did not fit even at the smallest scale. */
  pages: number;
  /** Type scale that was used (1 = full size). */
  scale: number;
}

/** Section headings, in render order. Plain, standard words that every ATS recognises. */
export const HEADINGS = {
  summary: "SUMMARY",
  skills: "SKILLS",
  work: "EXPERIENCE",
  projects: "PROJECTS",
  education: "EDUCATION",
  certificates: "CERTIFICATIONS",
  languages: "LANGUAGES",
} as const;

const SIZES = { letter: [612, 792], a4: [595.28, 841.89] } as const;
const MARGIN = 46;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type FontKey = "reg" | "bold" | "ital";
type Op =
  | { kind: "text"; text: string; x: number; y: number; font: FontKey; size: number; right?: boolean }
  | { kind: "rule"; y: number };
type Fonts = Record<FontKey, PDFFont>;

/** "2021-03-15" -> "Mar 2021", "2021" -> "2021", "" -> "". */
export function formatDate(d?: string): string {
  if (!d) return "";
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(d.trim());
  if (!m) return d.trim();
  return m[2] ? `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim() : m[1];
}

export function formatRange(start?: string, end?: string): string {
  const s = formatDate(start);
  const e = end ? formatDate(end) : s ? "Present" : "";
  return s && e ? `${s} - ${e}` : s || e;
}

const join = (parts: (string | undefined)[], sep: string) => parts.map((p) => p?.trim()).filter(Boolean).join(sep);

/** Replace characters the standard PDF fonts cannot encode, so text stays real, selectable text. */
function sanitizer(font: PDFFont) {
  const ok = new Set(font.getCharacterSet());
  return (s: string) =>
    Array.from(s.replace(/[\t\r\n ]+/g, " "))
      .map((ch) => (ok.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number, firstWidth = width): string[] {
  const lines: string[] = [];
  let line = "";
  const max = () => (lines.length === 0 ? firstWidth : width);
  for (let word of text.split(/\s+/).filter(Boolean)) {
    // Hard-break words longer than a full line (long URLs).
    while (font.widthOfTextAtSize(word, size) > width) {
      let i = word.length - 1;
      while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > width) i--;
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, i));
      word = word.slice(i);
    }
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= max()) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Lay the resume out at a given type scale. Returns draw ops (y measured down from the top margin) and total height. */
function layout(r: Resume, f: Fonts, width: number, s: number): { ops: Op[]; height: number } {
  const ops: Op[] = [];
  let y = 0;
  const body = 10 * s;
  const lead = 1.32;

  const text = (t: string, font: FontKey, size: number, x = 0, right = false) =>
    ops.push({ kind: "text", text: t, x, y, font, size, right });
  const para = (t: string, font: FontKey, size: number, indent = 0, prefix?: { text: string; font: FontKey }) => {
    const pw = prefix ? f[prefix.font].widthOfTextAtSize(prefix.text, size) : 0;
    const lines = wrap(t, f[font], size, width - indent, width - indent - pw);
    lines.forEach((l, i) => {
      y += size * lead;
      if (i === 0 && prefix) text(prefix.text, prefix.font, size, indent);
      text(l, font, size, indent + (i === 0 ? pw : 0));
    });
    if (lines.length === 0 && prefix) { y += size * lead; text(prefix.text, prefix.font, size, indent); }
  };
  const bullet = (t: string) => {
    const indent = 12 * s;
    const lines = wrap(t, f.reg, body, width - indent);
    lines.forEach((l, i) => {
      y += body * lead;
      if (i === 0) text("•", "reg", body, 3 * s);
      text(l, "reg", body, indent);
    });
  };
  const heading = (t: string) => {
    y += 11 * s;
    y += 11 * s;
    text(t, "bold", 11 * s);
    y += 3.5 * s;
    ops.push({ kind: "rule", y });
    y += 1 * s;
  };
  const entry = (left: string, right: string, sub?: string) => {
    y += 4 * s + body * lead;
    const rw = right ? f.reg.widthOfTextAtSize(right, body) + 10 : 0;
    const [first, ...rest] = wrap(left, f.bold, body, width, width - rw);
    text(first ?? "", "bold", body);
    if (right) text(right, "reg", body, width, true);
    for (const l of rest) { y += body * lead; text(l, "bold", body); }
    if (sub) para(sub, "ital", body);
  };

  const b = r.basics ?? {};
  y += 20 * s;
  text(b.name?.trim() || "Your Name", "bold", 20 * s);
  if (b.label) { y += 4 * s; para(b.label, "reg", 11 * s); }
  const loc = join([b.location?.city, b.location?.region, b.location?.countryCode], ", ");
  const contact = join([b.email, b.phone, loc, b.url, ...(b.profiles ?? []).map((p) => p.url || join([p.network, p.username], ": "))], " | ");
  if (contact) para(contact, "reg", 9.5 * s);

  if (b.summary?.trim()) { heading(HEADINGS.summary); para(b.summary, "reg", body); }

  const skills = (r.skills ?? []).filter((k) => k.name || k.keywords?.length);
  if (skills.length) {
    heading(HEADINGS.skills);
    for (const k of skills) {
      const kws = (k.keywords ?? []).join(", ");
      if (k.name && kws) para(kws, "reg", body, 0, { text: `${k.name}: `, font: "bold" });
      else para(k.name || kws, "reg", body);
    }
  }

  const work = r.work ?? [];
  if (work.length) {
    heading(HEADINGS.work);
    for (const w of work as Work[]) {
      entry(join([w.position, w.name], ", "), formatRange(w.startDate, w.endDate), w.location);
      if (w.summary?.trim()) para(w.summary, "reg", body);
      for (const h of w.highlights ?? []) bullet(h);
    }
  }

  const projects = r.projects ?? [];
  if (projects.length) {
    heading(HEADINGS.projects);
    for (const p of projects as Project[]) {
      entry(join([p.name, p.url], " | "), formatRange(p.startDate, p.endDate));
      if (p.description?.trim()) para(p.description, "reg", body);
      for (const h of p.highlights ?? []) bullet(h);
      if (p.keywords?.length) para(p.keywords.join(", "), "reg", body, 0, { text: "Tech: ", font: "bold" });
    }
  }

  const edu = r.education ?? [];
  if (edu.length) {
    heading(HEADINGS.education);
    for (const e of edu) {
      const degree = join([e.studyType, e.area], " in ");
      entry(join([degree, e.institution], ", "), formatRange(e.startDate, e.endDate), e.score ? `Grade: ${e.score}` : undefined);
    }
  }

  const certs = r.certificates ?? [];
  if (certs.length) {
    heading(HEADINGS.certificates);
    for (const c of certs) bullet(join([c.name, c.issuer, formatDate(c.date)], ", "));
  }

  const langs = r.languages ?? [];
  if (langs.length) {
    heading(HEADINGS.languages);
    para(langs.map((l) => join([l.language, l.fluency && `(${l.fluency})`], " ")).join(", "), "reg", body);
  }

  return { ops, height: y + 4 };
}

/** Render a JSON Resume to an ATS-safe PDF: one column, real text, standard headings, no tables or images. */
export async function renderResume(resume: Resume, opts: RenderOptions = {}): Promise<RenderResult> {
  const [pw, ph] = SIZES[opts.pageSize ?? "letter"];
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const clean = sanitizer(fonts.reg);
  const width = pw - MARGIN * 2;
  const avail = ph - MARGIN * 2;

  let scale = 1;
  let out = layout(resume, fonts, width, scale);
  if (opts.fitOnePage !== false) {
    while (out.height > avail && scale > 0.8) {
      scale = Math.round((scale - 0.02) * 100) / 100;
      out = layout(resume, fonts, width, scale);
    }
  }

  let page = doc.addPage([pw, ph]);
  let offset = 0; // content height already placed on previous pages
  const ink = rgb(0.1, 0.1, 0.1);
  for (const op of out.ops) {
    if (op.y - offset > avail) { page = doc.addPage([pw, ph]); offset = op.y - (op.kind === "text" ? op.size : 0); }
    const y = ph - MARGIN - (op.y - offset);
    if (op.kind === "rule") {
      page.drawLine({ start: { x: MARGIN, y }, end: { x: pw - MARGIN, y }, thickness: 0.6, color: rgb(0.55, 0.55, 0.55) });
      continue;
    }
    const t = clean(op.text);
    const x = MARGIN + (op.right ? op.x - fonts[op.font].widthOfTextAtSize(t, op.size) : op.x);
    page.drawText(t, { x, y, size: op.size, font: fonts[op.font], color: ink });
  }

  const name = resume.basics?.name?.trim() || "Resume";
  doc.setTitle(`${name} - Resume`);
  doc.setAuthor(name);
  doc.setSubject(resume.basics?.label ?? "Resume");
  doc.setKeywords((resume.skills ?? []).flatMap((k) => k.keywords ?? []));
  doc.setCreator("ats-resume-kit");
  doc.setProducer("ats-resume-kit (pdf-lib)");
  doc.setLanguage("en");

  return { pdf: await doc.save(), pages: doc.getPageCount(), scale };
}
