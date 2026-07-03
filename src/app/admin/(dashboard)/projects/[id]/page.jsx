import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, FileCheck2, FolderOpen,
  Receipt, MessageSquare, ClipboardList, Lock, ChevronRight,
} from "lucide-react";
import FilePicker from "@/components/FilePicker";
import CsvImport from "@/components/admin/CsvImport";
import InvoiceForm from "@/components/admin/InvoiceForm";
import { EditableRow, RowButton } from "@/components/admin/EditableRow";
import { InfoTip } from "@/components/Tip";
import { sql } from "@/lib/db";
import { numberPhases, phaseLabel } from "@/lib/phases";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const MS_STATUS = ["upcoming", "active", "blocked", "done"];
const TABS = ["overview", "plan", "deliverables", "documents", "billing", "messages", "notes", "internal"];

const input =
  "mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2";

export default async function AdminProjectPage({ params, searchParams }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.includes(rawTab) ? rawTab : "overview";

  const project = (await sql(
    `SELECT p.*, c.company_name, c.id AS cid FROM portal_projects p
     JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
    [id]
  ))[0];
  if (!project) notFound();

  const milestones = numberPhases(await sql(
    "SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order", [id]
  ));
  const phaseList = milestones.filter((m) => m.kind === "phase");
  const deliverableRows = await sql(
    "SELECT * FROM deliverables_approvals WHERE project_id = ? ORDER BY submitted_at DESC", [id]
  );
  const deliverables = [];
  for (const d of deliverableRows) {
    deliverables.push({
      ...d,
      versions: await sql(
        "SELECT * FROM deliverable_versions WHERE deliverable_id = ? ORDER BY version_no DESC", [d.id]
      ),
    });
  }
  const invoices = await sql(
    "SELECT * FROM invoices WHERE project_id = ? ORDER BY issued_date DESC", [id]
  );
  const lineItemRows = await sql(
    `SELECT li.* FROM invoice_line_items li JOIN invoices i ON i.id = li.invoice_id
     WHERE i.project_id = ? ORDER BY li.sort_order`, [id]
  );
  const lineItemsByInvoice = {};
  for (const li of lineItemRows) (lineItemsByInvoice[li.invoice_id] ||= []).push(li);
  const messages = await sql(
    "SELECT * FROM communication_threads WHERE project_id = ? ORDER BY created_at ASC", [id]
  );
  const kpis = await sql("SELECT * FROM project_kpis WHERE project_id = ? ORDER BY name", [id]);
  const documents = await sql(
    "SELECT * FROM project_documents WHERE project_id = ? ORDER BY category, created_at DESC", [id]
  );
  const links = await sql("SELECT * FROM project_links WHERE project_id = ?", [id]);
  const people = await sql("SELECT * FROM project_people WHERE project_id = ? ORDER BY side DESC", [id]);
  const fileRequests = await sql(
    "SELECT * FROM file_requests WHERE project_id = ? ORDER BY created_at DESC", [id]
  );
  const decisions = await sql(
    "SELECT * FROM decision_log WHERE project_id = ? ORDER BY decided_on DESC", [id]
  );
  const working = await sql(
    "SELECT * FROM working_items WHERE project_id = ? ORDER BY status, created_at", [id]
  );
  const notes = await sql(
    "SELECT * FROM internal_notes WHERE project_id = ? ORDER BY created_at DESC", [id]
  );

  // Badge counts before any read-marking below.
  const unreadMessages = messages.filter((m) => m.sender_type === "Client" && !m.operator_read).length;
  const revisionCount = deliverables.filter((d) => d.status === "Revisions Requested").length;
  const disputeCount = invoices.filter((i) => i.status === "Disputed").length;

  // Operators don't need manual read controls - opening the messages tab is reading.
  if (tab === "messages" && unreadMessages > 0) {
    await sql(
      "UPDATE communication_threads SET operator_read = 1 WHERE project_id = ? AND sender_type = 'Client'", [id]
    );
  }

  const here = `/admin/projects/${id}${tab === "overview" ? "" : `?tab=${tab}`}`;
  const post = () => `/api/admin/projects/${id}`;
  const hub = `/api/admin/projects/${id}/hub`;

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "plan", label: "Plan", icon: CalendarDays },
    { key: "deliverables", label: "Deliverables", icon: FileCheck2, badge: revisionCount, badgeColor: "bg-danger" },
    { key: "documents", label: "Documents", icon: FolderOpen },
    { key: "billing", label: "Billing", icon: Receipt, badge: disputeCount, badgeColor: "bg-dispute" },
    { key: "messages", label: "Messages", icon: MessageSquare, badge: unreadMessages, badgeColor: "bg-accent" },
    { key: "notes", label: "Log", icon: ClipboardList },
    { key: "internal", label: "Internal", icon: Lock },
  ];

  return (
    <div className="page-enter">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-ink-muted">
        <Link href="/admin" className="hover:text-ink">Dashboard</Link>
        <ChevronRight size={14} className="shrink-0" />
        <Link href={`/admin/clients/${project.cid}`} className="hover:text-ink">
          {project.company_name}
        </Link>
        <ChevronRight size={14} className="shrink-0" />
        <span className="text-ink">{project.title}</span>
      </nav>
      <div className="mt-3 flex items-stretch gap-4">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <div>
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">{project.company_name}</p>
          <h1 className="mt-1 text-[1.5rem] leading-none text-ink">{project.title}</h1>
        </div>
      </div>

      <div className="sticky top-0 z-10 -mx-6 mt-5 border-b border-line bg-bg-primary px-6">
        <nav className="flex gap-0.5 overflow-x-auto text-sm">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.key}
                href={`/admin/projects/${id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 border-b-2 -mb-px text-[13px] transition-colors ${
                  tab === t.key
                    ? "border-accent-2 font-semibold text-ink"
                    : "border-transparent text-ink-muted hover:text-ink-soft"
                }`}
              >
                <Icon size={13} />
                {t.label}
                {t.badge > 0 && (
                  <span className={`font-data rounded-full px-1.5 text-[10px] font-bold leading-tight text-white ${t.badgeColor || "bg-accent"}`}>
                    {t.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 space-y-8">
        {tab === "overview" && (
          <>
            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">Status <InfoTip side="bottom" text="What the client sees at the top of their portal: current phase, percent complete, and target date." /></h2>
              <form action={post()} method="post" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
                <input type="hidden" name="_action" value="status" />
                <input type="hidden" name="_redirect" value={here} />
                <label className="block text-ink-soft">
                  Phase
                  {phaseList.length > 0 ? (
                    <select name="current_phase" defaultValue={project.current_phase} className={input}>
                      {phaseList.map((m) => (
                        <option key={m.id} value={m.title}>{phaseLabel(m.phaseNo, m.title)}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 max-w-xs text-xs text-ink-muted">
                      No phases yet. Add them in the{" "}
                      <Link href={`/admin/projects/${id}?tab=plan`} className="text-accent hover:underline">Plan tab</Link>{" "}
                      to set how many phases there are and name them.
                    </p>
                  )}
                </label>
                <label className="block text-ink-soft">
                  Progress %
                  <input name="progress_percentage" type="number" min="0" max="100" defaultValue={project.progress_percentage} className={`${input} w-24`} />
                </label>
                <label className="block text-ink-soft">
                  Target date
                  <input name="target_date" type="date" defaultValue={project.target_date || ""} className={input} />
                </label>
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Save</button>
              </form>
            </section>

            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">Project hub <InfoTip side="bottom" text="The client-facing overview: brief, KPIs, key links, and people. Everything here is visible to the client." /></h2>

              <form action={hub} method="post" className="mt-3 text-sm">
                <input type="hidden" name="_action" value="description" />
                <input type="hidden" name="_redirect" value={here} />
                <label className="block text-ink-soft">
                  Brief / description (visible to client)
                  <textarea name="description" rows={3} defaultValue={project.description || ""} className={`${input} w-full`} />
                </label>
                <button className="mt-2 rounded-lg border border-line px-3 py-1.5 text-ink-soft hover:text-ink">Save brief</button>
              </form>

              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">KPIs <InfoTip text="Shown to the client as health-colored cards: green when the target is met, amber within 15%, red when off. 'Better' sets whether higher or lower numbers win." /></p>
                <div className="mt-2 divide-y divide-line/70 rounded-lg border border-line">
                  {kpis.map((k) => (
                    <div key={k.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-sm">
                      <span className="w-40 font-semibold">{k.name}</span>
                      <span className="font-data text-xs text-ink-muted">target {k.target_value ?? "–"}{k.unit || ""} ({k.direction})</span>
                      <form action={hub} method="post" className="ml-auto flex items-center gap-2">
                        <input type="hidden" name="_action" value="update_kpi" />
                        <input type="hidden" name="kpi_id" value={k.id} />
                        <input type="hidden" name="kpi_name" value={k.name} />
                        <input type="hidden" name="_redirect" value={here} />
                        <input name="current_value" type="number" step="any" defaultValue={k.current_value ?? ""} className="font-data w-20 rounded-md border border-line bg-bg-tertiary px-2 py-1 text-xs text-ink" />
                        <button className="text-xs text-ink-muted hover:text-ink">Update</button>
                      </form>
                      <form action={hub} method="post">
                        <input type="hidden" name="_action" value="delete_kpi" />
                        <input type="hidden" name="kpi_id" value={k.id} />
                        <input type="hidden" name="_redirect" value={here} />
                        <button className="text-xs text-ink-muted hover:text-danger">Delete</button>
                      </form>
                    </div>
                  ))}
                  {kpis.length === 0 && <p className="px-3.5 py-3 text-sm text-ink-muted">No KPIs yet.</p>}
                </div>
                <form action={hub} method="post" className="mt-2 flex flex-wrap items-end gap-3 text-sm">
                  <input type="hidden" name="_action" value="add_kpi" />
                  <input type="hidden" name="_redirect" value={here} />
                  <label className="block text-ink-soft">Name<input name="name" required className={input} /></label>
                  <label className="block text-ink-soft">Target<input name="target_value" type="number" step="any" className={`${input} w-24`} /></label>
                  <label className="block text-ink-soft">Current<input name="current_value" type="number" step="any" className={`${input} w-24`} /></label>
                  <label className="block text-ink-soft">Unit<input name="unit" placeholder="s, %, …" className={`${input} w-20`} /></label>
                  <label className="block text-ink-soft">
                    Better
                    <select name="direction" className={input}>
                      <option value="up">higher</option>
                      <option value="down">lower</option>
                    </select>
                  </label>
                  <button className="rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">Add KPI</button>
                </form>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-ink-muted">Key links</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {links.map((l) => (
                      <li key={l.id} className="flex items-center gap-2">
                        <a href={l.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{l.label}</a>
                        <form action={hub} method="post">
                          <input type="hidden" name="_action" value="delete_link" />
                          <input type="hidden" name="link_id" value={l.id} />
                          <input type="hidden" name="_redirect" value={here} />
                          <button className="text-xs text-ink-muted hover:text-danger">×</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <form action={hub} method="post" className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                    <input type="hidden" name="_action" value="add_link" />
                    <input type="hidden" name="_redirect" value={here} />
                    <input name="label" required placeholder="Label" className={`${input} w-28`} />
                    <input name="url" required placeholder="https://…" className={`${input} w-44`} />
                    <button className="rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">Add</button>
                  </form>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">People</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {people.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span>{p.name} <span className="text-ink-muted">· {p.role || p.side}</span></span>
                        <form action={hub} method="post">
                          <input type="hidden" name="_action" value="delete_person" />
                          <input type="hidden" name="person_id" value={p.id} />
                          <input type="hidden" name="_redirect" value={here} />
                          <button className="text-xs text-ink-muted hover:text-danger">×</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <form action={hub} method="post" className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                    <input type="hidden" name="_action" value="add_person" />
                    <input type="hidden" name="_redirect" value={here} />
                    <input name="name" required placeholder="Name" className={`${input} w-28`} />
                    <input name="role" placeholder="Role" className={`${input} w-28`} />
                    <select name="side" className={input}>
                      <option value="operator">our team</option>
                      <option value="client">client team</option>
                    </select>
                    <button className="rounded-lg border border-line px-3 py-2 text-ink-soft hover:text-ink">Add</button>
                  </form>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">Import from CSV <InfoTip side="bottom" text="Pull project data in from a CSV instead of typing it: phases & milestones, KPIs, links, people, working items, and decisions are added to this project. New items are appended; matching KPIs update in place." /></h2>
              <div className="mt-3">
                <CsvImport mode="merge" projectId={id} />
              </div>
            </section>
          </>
        )}

        {tab === "plan" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-5">
            <h2 className="flex items-center gap-1.5 font-medium text-ink">Phases &amp; milestones <InfoTip side="bottom" text="Phases draw as bars on the client's status bar and timeline; milestones draw as diamond markers. Statuses color them: done = green, active = blue, blocked = red." /></h2>
            <div className="mt-3 divide-y divide-line/70 rounded-lg border border-line">
              {milestones.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-sm ${
                    m.status === "done" ? "bg-accent-2" : m.status === "active" ? "bg-accent" : m.status === "blocked" ? "bg-danger" : "bg-line"
                  }`} />
                  <span className="font-semibold">{phaseLabel(m.phaseNo, m.title)}</span>
                  <span className="font-data text-xs text-ink-muted">{m.kind}</span>
                  <span className="font-data text-xs text-ink-soft">
                    {m.starts_on || "–"}{m.ends_on ? ` → ${m.ends_on}` : ""}
                  </span>
                  <form action={post()} method="post" className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="_action" value="set_milestone_status" />
                    <input type="hidden" name="milestone_id" value={m.id} />
                    <input type="hidden" name="_redirect" value={here} />
                    <select name="status" defaultValue={m.status} className="rounded-md border border-line bg-bg-tertiary px-2 py-1 text-xs text-ink">
                      {MS_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <button className="text-xs text-ink-muted hover:text-ink">Set</button>
                  </form>
                  <form action={post()} method="post">
                    <input type="hidden" name="_action" value="delete_milestone" />
                    <input type="hidden" name="milestone_id" value={m.id} />
                    <input type="hidden" name="_redirect" value={here} />
                    <button className="text-xs text-ink-muted hover:text-danger">Delete</button>
                  </form>
                </div>
              ))}
              {milestones.length === 0 && <p className="px-3.5 py-3 text-sm text-ink-muted">No phases or milestones yet.</p>}
            </div>
            <form action={post()} method="post" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
              <input type="hidden" name="_action" value="add_milestone" />
              <input type="hidden" name="_redirect" value={here} />
              <label className="block text-ink-soft">Title<input name="title" required className={input} /></label>
              <label className="block text-ink-soft">
                Kind
                <select name="kind" className={input}>
                  <option value="phase">phase (bar)</option>
                  <option value="milestone">milestone (marker)</option>
                </select>
              </label>
              <label className="block text-ink-soft">Starts<input name="starts_on" type="date" className={input} /></label>
              <label className="block text-ink-soft">Ends<input name="ends_on" type="date" className={input} /></label>
              <button className="rounded-lg border border-line px-4 py-2 text-ink-soft hover:text-ink">Add</button>
            </form>
          </section>
        )}

        {tab === "deliverables" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-5">
            <h2 className="flex items-center gap-1.5 font-medium text-ink">Deliverables <InfoTip side="bottom" text="Work submitted for client sign-off. The client can approve (locks it) or request revisions. Uploading a new version reopens it for review and notifies them." /></h2>
            <div className="mt-3 space-y-4">
              {deliverables.map((d) => (
                <div key={d.id} className="rounded-lg border border-line bg-bg-tertiary p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{d.title}</p>
                    <span className={
                      d.status === "Approved" ? "text-accent-2" :
                      d.status === "Revisions Requested" ? "text-danger" : "text-warn"
                    }>
                      {d.status}{d.actioned_by ? ` · ${d.actioned_by}` : ""}
                    </span>
                  </div>
                  {d.feedback_notes && <p className="mt-1 text-ink-soft">Client feedback: {d.feedback_notes}</p>}
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {d.versions.map((v) => (
                      <li key={v.id}>
                        v{v.version_no} · {v.kind === "file" ? v.original_name : v.asset_path}
                        {v.viewed_at ? ` · viewed ${v.viewed_at}` : " · not viewed"}
                      </li>
                    ))}
                  </ul>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-ink-muted">Upload new version</summary>
                    <form
                      action={`/api/admin/deliverables/${d.id}/versions`}
                      method="post"
                      encType="multipart/form-data"
                      className="mt-2 flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="_redirect" value={here} />
                      <div className="text-ink-soft">File<div className="mt-1"><FilePicker /></div></div>
                      <label className="block text-ink-soft">or link<input name="link" placeholder="https://…" className={input} /></label>
                      <label className="block text-ink-soft">Note<input name="note" className={input} /></label>
                      <button className="rounded-lg bg-accent-2 px-3 py-2 font-medium text-white">Submit version</button>
                    </form>
                  </details>
                </div>
              ))}
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-soft">+ New deliverable</summary>
              <form
                action="/api/admin/deliverables"
                method="post"
                encType="multipart/form-data"
                className="mt-3 flex flex-wrap items-end gap-3 text-sm"
              >
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="_redirect" value={here} />
                <label className="block text-ink-soft">Title<input name="title" required className={input} /></label>
                <div className="text-ink-soft">File<div className="mt-1"><FilePicker /></div></div>
                <label className="block text-ink-soft">or link<input name="link" placeholder="https://…" className={input} /></label>
                <label className="block text-ink-soft">Note<input name="note" className={input} /></label>
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Create</button>
              </form>
            </details>
          </section>
        )}

        {tab === "documents" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-5">
            <h2 className="flex items-center gap-1.5 font-medium text-ink">Documents &amp; file requests <InfoTip side="bottom" text="The shared document library. Clients see everything here, organized by category, and can add their own reference documents." /></h2>
            <div className="mt-3 divide-y divide-line/70 rounded-lg border border-line">
              {documents.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-sm">
                  <span className="font-data rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{d.category}</span>
                  <a
                    href={d.kind === "file" ? `/api/${d.asset_path.replace(/^uploads\//, "files/")}` : d.asset_path}
                    target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline"
                  >
                    {d.title}
                  </a>
                  <span className="font-data text-xs text-ink-muted">{d.uploaded_by_name} · {d.created_at.slice(0, 10)}</span>
                  <form action={`/api/admin/projects/${id}/documents`} method="post" className="ml-auto">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="document_id" value={d.id} />
                    <input type="hidden" name="_redirect" value={here} />
                    <button className="text-xs text-ink-muted hover:text-danger">Delete</button>
                  </form>
                </div>
              ))}
              {documents.length === 0 && <p className="px-3.5 py-3 text-sm text-ink-muted">No documents yet.</p>}
            </div>
            <form
              action={`/api/admin/projects/${id}/documents`}
              method="post"
              encType="multipart/form-data"
              className="mt-3 flex flex-wrap items-end gap-3 text-sm"
            >
              <input type="hidden" name="_redirect" value={here} />
              <label className="block text-ink-soft">Title<input name="title" required className={input} /></label>
              <label className="block text-ink-soft">
                Category
                <select name="category" className={input}>
                  <option value="contract">contract</option>
                  <option value="agreement">agreement / NDA</option>
                  <option value="reference">reference</option>
                  <option value="brand">brand asset</option>
                  <option value="report">report</option>
                </select>
              </label>
              <div className="text-ink-soft">File<div className="mt-1"><FilePicker /></div></div>
              <label className="block text-ink-soft">or link<input name="link" placeholder="https://…" className={input} /></label>
              <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Add document</button>
            </form>

            <div className="mt-5 border-t border-line pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">File requests <InfoTip text="Ask the client for a file. The request appears at the top of their Documents tab and on their dashboard, and they get an email. It closes automatically when they upload." /></p>
              <ul className="mt-2 space-y-1 text-sm">
                {fileRequests.map((fr) => (
                  <li key={fr.id} className="text-ink-soft">
                    {fr.title}:{" "}
                    <span className={fr.status === "open" ? "text-warn" : "text-accent-2"}>{fr.status}</span>
                    {fr.fulfilled_at && <span className="text-ink-muted"> ({fr.fulfilled_at.slice(0, 10)})</span>}
                  </li>
                ))}
                {fileRequests.length === 0 && <li className="text-ink-muted">None.</li>}
              </ul>
              <form action={hub} method="post" className="mt-2 flex flex-wrap items-end gap-3 text-sm">
                <input type="hidden" name="_action" value="create_file_request" />
                <input type="hidden" name="_redirect" value={here} />
                <label className="block text-ink-soft">Request a file<input name="title" required placeholder="e.g. Brand guidelines" className={input} /></label>
                <label className="block text-ink-soft">Note<input name="note" className={`${input} w-64`} /></label>
                <button className="rounded-lg border border-line px-4 py-2 text-ink-soft hover:text-ink">Send request</button>
              </form>
            </div>
          </section>
        )}

        {tab === "billing" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-5">
            <h2 className="font-medium text-ink">Invoices</h2>
            <div className="mt-3 divide-y divide-line/70 rounded-lg border border-line">
              {invoices.map((inv) => (
                <div key={inv.id}>
                  <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-sm">
                    <span className="font-data font-semibold">{inv.invoice_number}</span>
                    <span className="font-data">{formatMoney(inv.amount, inv.currency, "en")}</span>
                    <span className="font-data text-xs text-ink-muted">due {inv.due_date}</span>
                    <span className={`font-data ml-auto text-xs font-semibold ${
                      inv.status === "Disputed" ? "text-dispute" : inv.status === "Paid" ? "text-accent-2" : "text-warn"
                    }`}>
                      {inv.status}
                    </span>
                    <div className="flex gap-2">
                      {inv.status !== "Paid" && (
                        <InvoiceAction id={inv.id} action="mark_paid" label="Mark paid" here={here} />
                      )}
                      {inv.status === "Disputed" && (
                        <InvoiceAction id={inv.id} action="resolve_dispute" label="Resolve dispute" here={here} />
                      )}
                      {inv.status === "Unpaid" && (
                        <InvoiceAction id={inv.id} action="mark_overdue" label="Mark overdue" here={here} />
                      )}
                    </div>
                  </div>
                  {lineItemsByInvoice[inv.id]?.length > 0 && (
                    <ul className="border-t border-line/60 bg-bg-primary/30 px-3.5 py-2 text-xs text-ink-soft">
                      {lineItemsByInvoice[inv.id].map((li) => (
                        <li key={li.id} className="flex items-center gap-2 py-0.5">
                          <span className="min-w-0 flex-1 truncate">{li.description}</span>
                          <span className="font-data text-ink-muted">{li.quantity} × {formatMoney(li.unit_price, inv.currency, "en")}</span>
                          <span className="font-data w-20 text-right">{formatMoney(li.quantity * li.unit_price, inv.currency, "en")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {inv.dispute_reason && (
                    <p className="bg-dispute/5 px-3.5 pb-2.5 text-xs text-dispute">
                      {inv.invoice_number} dispute: {inv.dispute_reason}
                    </p>
                  )}
                </div>
              ))}
              {invoices.length === 0 && <p className="px-3.5 py-3 text-sm text-ink-muted">No invoices yet.</p>}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-ink-soft">+ New invoice</summary>
              <InvoiceForm projectId={id} redirectTo={here} inputClass={input} />
            </details>
          </section>
        )}

        {tab === "messages" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-5">
            <h2 className="font-medium text-ink">Messages</h2>
            <div className="mt-3 space-y-2 text-sm">
              {messages.length === 0 && <p className="text-ink-muted">No messages yet.</p>}
              {messages.map((m) => {
                const isNew = m.sender_type === "Client" && !m.operator_read;
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-2.5 ${m.sender_type === "Client" ? "bg-bg-tertiary" : ""} ${
                      isNew ? "border-accent/60" : "border-line"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-xs text-ink-muted">
                      {m.sender_name || m.sender_type} · <span className="font-data">{m.created_at}</span>
                      {m.invoice_id && <span className="text-dispute">[invoice thread]</span>}
                      {isNew && (
                        <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white">NEW</span>
                      )}
                      {m.sender_type === "Internal_Operator" && (
                        m.is_read
                          ? <span className="text-accent-2">✓ read by client</span>
                          : <span title="The client hasn't opened or marked this message yet">unread</span>
                      )}
                    </p>
                    <p className="mt-0.5">{m.message_content}</p>
                  </div>
                );
              })}
            </div>
            <form action="/api/admin/messages" method="post" className="mt-3 flex gap-2 text-sm">
              <input type="hidden" name="project_id" value={id} />
              <input type="hidden" name="_redirect" value={here} />
              <input
                name="message_content"
                required
                placeholder="Reply to the client…"
                className="flex-1 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2"
              />
              <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Send</button>
            </form>
          </section>
        )}

        {tab === "notes" && (
          <>
            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">We're working on (shown to client) <InfoTip side="bottom" text="A live list on the client's project overview showing what the team is doing right now. Mark items done as you finish them." /></h2>
              <ul className="mt-3 divide-y divide-line/60">
                {working.length === 0 && <li className="py-2 text-sm text-ink-muted">No items yet.</li>}
                {working.map((w) => (
                  <EditableRow
                    key={w.id}
                    text={w.title}
                    struck={w.status === "done"}
                    meta={w.status === "done" ? "done" : "active"}
                    action={hub}
                    here={here}
                    idField="item_id"
                    idValue={w.id}
                    updateAction="update_working"
                    deleteAction="delete_working"
                    editField="title"
                    extraActions={
                      w.status === "active" ? (
                        <RowButton action={hub} here={here} formAction="finish_working" idField="item_id" idValue={w.id} label="Mark done" tone="good" />
                      ) : (
                        <RowButton action={hub} here={here} formAction="reopen_working" idField="item_id" idValue={w.id} label="Reopen" />
                      )
                    }
                  />
                ))}
              </ul>
              <form action={hub} method="post" className="mt-3 flex items-end gap-2 text-sm">
                <input type="hidden" name="_action" value="add_working" />
                <input type="hidden" name="_redirect" value={here} />
                <input name="title" required placeholder="New work item…" className={`${input} flex-1`} />
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Add item</button>
              </form>
            </section>

            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">Decision log (shown to client) <InfoTip side="bottom" text="The agreed record of key decisions. Client deliverable approvals are added automatically; record anything else decided in meetings or email." /></h2>
              <ul className="mt-3 divide-y divide-line/60">
                {decisions.length === 0 && <li className="py-2 text-sm text-ink-muted">No decisions recorded.</li>}
                {decisions.map((d) => (
                  <EditableRow
                    key={d.id}
                    text={d.summary}
                    meta={`${d.decided_on} · ${d.recorded_by || d.source}${d.source === "approval" ? " · from approval" : d.source === "xpm" ? " · from xPM" : ""}`}
                    action={hub}
                    here={here}
                    idField="decision_id"
                    idValue={d.id}
                    updateAction="update_decision"
                    deleteAction="delete_decision"
                    editField="summary"
                    editDateField="decided_on"
                    editDateValue={d.decided_on}
                  />
                ))}
              </ul>
              <form action={hub} method="post" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
                <input type="hidden" name="_action" value="add_decision" />
                <input type="hidden" name="_redirect" value={here} />
                <input name="summary" required placeholder="What was decided…" className={`${input} min-w-64 flex-1`} />
                <input name="decided_on" type="date" className={input} />
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Record decision</button>
              </form>
            </section>

          </>
        )}

        {tab === "internal" && (
          <section className="rounded-xl border border-warn/30 bg-bg-secondary p-5">
            <h2 className="font-medium text-warn">Internal notes (never shown to the client)</h2>
              <ul className="mt-3 space-y-2">
                {notes.length === 0 && <li className="py-2 text-sm text-ink-muted">No notes yet.</li>}
                {notes.map((n) => (
                  <EditableRow
                    key={n.id}
                    text={n.content}
                    meta={`${n.author_name} · ${n.created_at.slice(0, 10)}`}
                    action={hub}
                    here={here}
                    idField="note_id"
                    idValue={n.id}
                    updateAction="update_note"
                    deleteAction="delete_note"
                    editField="content"
                    boxed
                  />
                ))}
              </ul>
              <form action={hub} method="post" className="mt-3 flex items-end gap-2 text-sm">
                <input type="hidden" name="_action" value="add_note" />
                <input type="hidden" name="_redirect" value={here} />
                <input name="content" required placeholder="Private note about this project…" className={`${input} flex-1`} />
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Add note</button>
              </form>
          </section>
        )}
      </div>
    </div>
  );
}

function InvoiceAction({ id, action, label, here }) {
  return (
    <form action={`/api/admin/invoices/${id}`} method="post">
      <input type="hidden" name="_action" value={action} />
      <input type="hidden" name="_redirect" value={here} />
      <button className="rounded border border-line px-2 py-1 text-xs text-ink-soft hover:text-ink">
        {label}
      </button>
    </form>
  );
}
