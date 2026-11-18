import { StrictMode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { matchResume, parseResume, renderResume, type RenderResult } from "../src/index";
import sampleResume from "../examples/resume.json";
import sampleJob from "../examples/job.txt?raw";
import "./styles.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const SAMPLE = JSON.stringify(sampleResume, null, 2);

function Preview({ pdf }: { pdf: Uint8Array }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: pdfjs.RenderTask | undefined;
    (async () => {
      const doc = await pdfjs.getDocument({ data: pdf.slice() }).promise;
      const page = await doc.getPage(1);
      const canvas = ref.current;
      if (cancelled || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: 1.6 * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      task = page.render({ canvas, viewport });
      await task.promise.catch(() => {});
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf]);
  return <canvas ref={ref} className="page" aria-label="Preview of page 1 of the generated PDF" />;
}

function App() {
  const [json, setJson] = useState(SAMPLE);
  const [jd, setJd] = useState(sampleJob);
  const [size, setSize] = useState<"letter" | "a4">("letter");
  const [result, setResult] = useState<RenderResult | null>(null);
  const deferredJson = useDeferredValue(json);
  const deferredJd = useDeferredValue(jd);

  const parsed = useMemo(() => {
    try { return { resume: parseResume(deferredJson), error: "" }; }
    catch (e) { return { resume: null, error: (e as Error).message }; }
  }, [deferredJson]);

  useEffect(() => {
    if (!parsed.resume) return;
    let live = true;
    const t = setTimeout(() => renderResume(parsed.resume!, { pageSize: size }).then((r) => live && setResult(r)), 250);
    return () => { live = false; clearTimeout(t); };
  }, [parsed.resume, size]);

  const report = useMemo(
    () => (parsed.resume && deferredJd.trim() ? matchResume(parsed.resume, deferredJd) : null),
    [parsed.resume, deferredJd],
  );

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.pdf.slice()], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(parsed.resume?.basics?.name || "resume").replace(/[^\w-]+/g, "-")}-resume.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <header className="bar">
        <div className="brand">
          <strong>ATS Resume Kit</strong>
          <span className="privacy">Runs in your browser. Nothing you paste leaves this device.</span>
        </div>
        <div className="actions">
          <label className="select">
            <span className="sr-only">Paper size</span>
            <select value={size} onChange={(e) => setSize(e.target.value as "letter" | "a4")}>
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <button className="ghost" onClick={() => { setJson(SAMPLE); setJd(sampleJob); }}>Load sample</button>
          <button className="primary" onClick={download} disabled={!result || !!parsed.error}>Download PDF</button>
        </div>
      </header>

      <main className="grid">
        <section className="inputs" aria-label="Inputs">
          <div className="field">
            <label htmlFor="resume">Resume (JSON Resume format)</label>
            <textarea id="resume" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} aria-invalid={!!parsed.error} aria-describedby="resume-help" />
            <p id="resume-help" className={parsed.error ? "help error" : "help"} role={parsed.error ? "alert" : undefined}>
              {parsed.error || <>Uses the <a href="https://jsonresume.org/schema" target="_blank" rel="noreferrer">jsonresume.org</a> schema. Unknown fields are ignored.</>}
            </p>
          </div>
          <div className="field">
            <label htmlFor="jd">Job description</label>
            <textarea id="jd" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full posting, including the requirements list." />
          </div>
        </section>

        <section className="report" aria-label="Keyword coverage" aria-live="polite">
          {!report ? (
            <div className="empty">
              <h2>Keyword coverage</h2>
              <p>{parsed.error ? "Fix the resume JSON to see coverage." : "Paste a job description to see which of its skills your resume covers."}</p>
            </div>
          ) : (
            <>
              <div className="score">
                <div>
                  <span className="num">{report.coverage}%</span>
                  <span className="cap">weighted coverage</span>
                </div>
                <div>
                  <span className="num small">{report.requiredCoverage}%</span>
                  <span className="cap">of required terms</span>
                </div>
              </div>
              <h3>Matched <span className="count">{report.matched.length}</span></h3>
              <ul className="chips">
                {report.matched.map((m) => <li key={m.name} className="chip ok" title={`Found in: ${m.foundIn.join(", ")}`}>{m.name}</li>)}
                {!report.matched.length && <li className="none">None yet</li>}
              </ul>
              <h3>Missing <span className="count">{report.missing.length}</span></h3>
              <ul className="chips">
                {report.missing.map((m) => (
                  <li key={m.name} className={`chip ${m.priority === "required" ? "miss" : "opt"}`}>
                    {m.name}{m.priority === "preferred" && <span className="tag">nice to have</span>}
                  </li>
                ))}
                {!report.missing.length && <li className="none">Nothing missing</li>}
              </ul>
              {report.suggestions.length > 0 && (
                <>
                  <h3>Suggestions</h3>
                  <ul className="tips">{report.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
                </>
              )}
              <p className="fine">Suggestions only cover wording and placement. Never add a skill you don't have.</p>
            </>
          )}
        </section>

        <section className="preview" aria-label="PDF preview">
          <div className="preview-head">
            <h2>Preview</h2>
            {result && <span className="meta">{result.pages === 1 ? "1 page" : `${result.pages} pages, trim content to fit one`}{result.scale < 1 && `, text scaled to ${Math.round(result.scale * 100)}%`}</span>}
          </div>
          {result ? <Preview pdf={result.pdf} /> : <div className="page skeleton" aria-hidden />}
        </section>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
