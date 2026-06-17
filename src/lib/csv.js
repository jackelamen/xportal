// Minimal RFC-4180 CSV parsing + project-import mapping. Pure (no DB imports), so
// the admin import widget can preview client-side and the server can re-parse the
// same text as the trust boundary.

// Tokenizer: handles quoted fields, "" escapes, commas/newlines inside quotes,
// CRLF/LF, a leading BOM, and a trailing newline.
export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = ""; rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  // Drop blank lines (a trailing newline yields one).
  return rows.filter((r) => !r.every((cell) => (cell || "").trim() === ""));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHASE_STATUS = ["upcoming", "active", "blocked", "done"];

// Map a section-keyed CSV into the structured shape importProjectData expects.
// Never throws: malformed rows become warnings (skipped) so one bad line can't
// sink the whole import.
export function parseProjectImport(text) {
  const data = {
    project: {},
    phases: [], milestones: [], kpis: [], links: [],
    people: [], working: [], decisions: [],
    errors: [], warnings: [],
  };

  const rows = parseCsv(text);
  if (rows.length === 0) {
    data.errors.push("The file is empty.");
    return data;
  }

  let start = 0;
  if ((rows[0][0] || "").trim().toLowerCase() === "section") start = 1; // optional header

  for (let r = start; r < rows.length; r++) {
    const cells = rows[r].map((c) => (c ?? "").trim());
    const section = (cells[0] || "").toLowerCase();
    const [, a = "", b = "", c = "", d = "", e = ""] = cells;
    const line = r + 1;
    if (!section) continue;

    const badDate = (label, val) => {
      if (val && !DATE_RE.test(val)) {
        data.warnings.push(`Line ${line}: ${label} "${val}" isn't a YYYY-MM-DD date; left blank.`);
        return true;
      }
      return false;
    };

    switch (section) {
      case "project": {
        const field = a.toLowerCase();
        if (field === "title") data.project.title = b;
        else if (field === "description") data.project.description = b;
        else if (field === "target_date") {
          if (!badDate("target_date", b)) data.project.target_date = b || null;
        } else if (field === "progress") {
          const n = Number(b);
          if (b === "" || Number.isNaN(n)) data.warnings.push(`Line ${line}: progress "${b}" isn't a number; ignored.`);
          else data.project.progress = Math.min(100, Math.max(0, Math.round(n)));
        } else data.warnings.push(`Line ${line}: unknown project field "${a}"; ignored.`);
        break;
      }

      case "phase":
      case "milestone": {
        if (!a) { data.warnings.push(`Line ${line}: ${section} needs a name; skipped.`); break; }
        const isPhase = section === "phase";
        const startVal = b;                          // both use b as the (start) date
        const endVal = isPhase ? c : "";             // only phases have an end date
        const statusVal = (isPhase ? d : c).toLowerCase();
        const rec = {
          title: a,
          starts_on: !badDate("start date", startVal) && DATE_RE.test(startVal) ? startVal : null,
          ends_on: !badDate("end date", endVal) && DATE_RE.test(endVal) ? endVal : null,
          status: PHASE_STATUS.includes(statusVal) ? statusVal : "upcoming",
        };
        (isPhase ? data.phases : data.milestones).push(rec);
        break;
      }

      case "kpi": {
        if (!a) { data.warnings.push(`Line ${line}: kpi needs a name; skipped.`); break; }
        const numOrNull = (val, label) => {
          if (val === "") return null;
          const n = Number(val);
          if (Number.isNaN(n)) { data.warnings.push(`Line ${line}: kpi ${label} "${val}" isn't a number; left blank.`); return null; }
          return n;
        };
        data.kpis.push({
          name: a,
          target_value: numOrNull(b, "target"),
          current_value: numOrNull(c, "current"),
          unit: d || null,
          direction: e.toLowerCase() === "down" ? "down" : "up",
        });
        break;
      }

      case "link": {
        if (!a || !/^https?:\/\//i.test(b)) {
          data.warnings.push(`Line ${line}: link needs a label and an http(s) url; skipped.`);
          break;
        }
        data.links.push({ label: a, url: b });
        break;
      }

      case "person": {
        if (!a) { data.warnings.push(`Line ${line}: person needs a name; skipped.`); break; }
        data.people.push({
          name: a,
          role: b || null,
          side: c.toLowerCase() === "client" ? "client" : "operator",
          email: d || null,
        });
        break;
      }

      case "working": {
        if (a) data.working.push(a);
        break;
      }

      case "decision": {
        if (!a) { data.warnings.push(`Line ${line}: decision needs a summary; skipped.`); break; }
        const decided = badDate("decision date", b) ? null : (b || null);
        data.decisions.push({ summary: a, decided_on: decided });
        break;
      }

      default:
        data.warnings.push(`Line ${line}: unknown section "${cells[0]}"; skipped.`);
    }
  }

  return data;
}

// Human-readable count of what an import will write, for the preview.
export function summarizeImport(data) {
  const parts = [];
  const add = (n, singular, plural) => { if (n) parts.push(`${n} ${n === 1 ? singular : plural || `${singular}s`}`); };
  add(data.phases.length, "phase");
  add(data.milestones.length, "milestone");
  add(data.kpis.length, "KPI");
  add(data.links.length, "link");
  add(data.people.length, "person", "people");
  add(data.working.length, "working item");
  add(data.decisions.length, "decision");
  return parts.join(", ") || "no sections";
}
