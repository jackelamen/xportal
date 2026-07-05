import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { Link2, Users, Gavel, Hammer, CheckCircle2 } from "lucide-react";
import ProjectStatus from "@/components/ProjectStatus";
import ProjectProgress from "@/components/ProjectProgress";
import ProjectPlan from "@/components/ProjectPlan";
import DeliverableCard from "@/components/DeliverableCard";
import MessageFeed from "@/components/MessageFeed";
// KpiGrid is paused for now (kept in src/components/KpiGrid.jsx for when KPIs
// return). The Plan takes its place in the overview for the time being.
// import KpiGrid from "@/components/KpiGrid";
import DocumentLibrary from "@/components/DocumentLibrary";
import { InfoTip } from "@/components/Tip";
import { t as translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TABS = ["overview", "deliverables", "documents", "progress", "messages"];

export default async function ProjectPage({ params, searchParams }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.includes(rawTab) ? rawTab : "overview";

  const { user, client } = await getClientSession();
  const locale = user.locale || "en";
  const t = (key, vars) => translate(locale, key, vars);

  const project = (await sql(
    "SELECT * FROM portal_projects WHERE id = ? AND client_id = ? AND hidden_from_client = 0 AND archived_at IS NULL",
    [id, client.id]
  ))[0];
  if (!project) notFound();

  const milestones = await sql(
    "SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order", [id]
  );
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
  const messages = await sql(
    "SELECT * FROM communication_threads WHERE project_id = ? AND invoice_id IS NULL ORDER BY created_at ASC",
    [id]
  );
  // KPIs are paused for now; keep the query out until they return.
  // const kpis = await sql("SELECT * FROM project_kpis WHERE project_id = ? ORDER BY name", [id]);
  const documents = await sql(
    "SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC", [id]
  );
  const fileRequests = await sql(
    "SELECT * FROM file_requests WHERE project_id = ? AND status = 'open' ORDER BY created_at", [id]
  );
  const links = await sql("SELECT * FROM project_links WHERE project_id = ?", [id]);
  const people = await sql("SELECT * FROM project_people WHERE project_id = ? ORDER BY side DESC, name", [id]);
  const decisions = await sql(
    "SELECT * FROM decision_log WHERE project_id = ? ORDER BY decided_on DESC, created_at DESC", [id]
  );
  const working = await sql(
    `SELECT * FROM working_items WHERE project_id = ? AND status IN ('active', 'done')
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at`, [id]
  );
  // The Progress tab's pulse: this project's recent team activity, the next
  // meeting, and any open invoices for the "coming up" list.
  const projectActivity = await sql(
    `SELECT * FROM activity_log WHERE project_id = ? AND actor_type = 'operator'
     ORDER BY created_at DESC LIMIT 12`, [id]
  );
  const nextMeeting = (await sql(
    `SELECT * FROM bookings WHERE client_id = ? AND status = 'confirmed' AND starts_at > NOW()
     ORDER BY starts_at ASC LIMIT 1`, [client.id]
  ))[0] || null;
  const dueInvoices = await sql(
    `SELECT invoice_number, due_date FROM invoices
     WHERE project_id = ? AND status IN ('Unpaid','Overdue') ORDER BY due_date ASC`, [id]
  );

  // Attention counts drive the tab badges. Messages stay unread until the
  // client marks them read (or replies) - no silent auto-read on page visit.
  const unreadCount = messages.filter((m) => m.sender_type === "Internal_Operator" && !m.is_read).length;
  const pendingCount = deliverables.filter((d) => d.status === "Pending").length;
  const requestCount = fileRequests.length;

  // Progress tab shows whenever the project has any phases to walk through.
  const hasProgress = milestones.some((m) => m.kind === "phase");
  const tabs = [
    { key: "overview", label: t("project.tabOverview") },
    { key: "deliverables", label: t("project.tabDeliverables"), badge: pendingCount },
    { key: "documents", label: t("project.tabDocuments"), badge: requestCount },
    ...(hasProgress ? [{ key: "progress", label: t("project.tabProgress") }] : []),
    { key: "messages", label: t("project.tabMessages"), badge: unreadCount },
  ];

  return (
    <div className="page-enter">
      {/* Hero: status + serif project title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {milestones.some((m) => m.kind === "phase" && m.status === "blocked") ? (
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-danger">
                <span className="h-2 w-2 rounded-full bg-danger ring-4 ring-danger/15" /> {t("project.needsAttention")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-accent-2">
                <span className="h-2 w-2 rounded-full bg-accent-2 ring-4 ring-accent-2/15" /> {t("project.onTrack")}
              </span>
            )}
            <span className="text-ink-muted/40">·</span>
            <span className="font-mono text-[11px] text-ink-muted">{t("project.updated", { date: project.updated_at?.slice(0, 10) })}</span>
          </div>
          <h1 className="mt-2 text-[2.9rem] leading-[1.02] text-ink">{project.title}</h1>
          <p className="font-mono mt-3 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">{client.company_name}</p>
        </div>
      </div>

      {/* Phase timeline card */}
      <section className="mt-7 rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04),0_18px_40px_-24px_rgb(16_16_29_/_0.18)]">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
            {t("project.phaseTimeline")}
            <InfoTip side="bottom" text={t("project.phaseTimelineTip")} />
          </span>
        </div>
        <ProjectStatus
          phases={milestones.filter((m) => m.kind === "phase")}
          currentPhase={project.current_phase}
          progress={project.progress_percentage}
          targetDate={project.target_date}
          locale={locale}
        />
      </section>

      <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-line text-sm">
        {tabs.map((tb) => (
          <Link
            key={tb.key}
            href={`/portal/projects/${id}${tb.key === "overview" ? "" : `?tab=${tb.key}`}`}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 -mb-px text-[13.5px] transition-colors ${
              tab === tb.key
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {tb.label}
            {tb.badge > 0 && (
              <span className="font-data rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
                {tb.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-8">
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* Left: project hub + the plan */}
            <div className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
                <h2 className="text-[19px]">{t("project.projectHub")}</h2>
                {project.description && (
                  <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-ink-soft">{project.description}</p>
                )}

                <div className="mt-7 grid gap-6 sm:grid-cols-2">
                  {links.length > 0 && (
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">{t("project.keyLinks")}</p>
                      <ul className="mt-2.5 space-y-2">
                        {links.map((l) => (
                          <li key={l.id}>
                            <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13.5px] text-accent hover:underline">
                              <Link2 size={13} /> {l.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {people.length > 0 && (
                    <div>
                      <p className="font-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
                        <Users size={11} /> {t("project.people")}
                      </p>
                      <ul className="mt-2.5 space-y-2 text-[13.5px]">
                        {people.map((p) => (
                          <li key={p.id} className="text-ink">
                            {p.name}
                            <span className="text-ink-muted"> · {p.role || (p.side === "operator" ? t("project.ourTeam") : t("project.yourTeam"))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              <ProjectPlan milestones={milestones} locale={locale} />
            </div>

            {/* Right rail: live work + decisions */}
            <div className="space-y-5">
              <section className="rounded-2xl border border-line bg-bg-secondary p-5 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
                <h2 className="flex items-center gap-2 text-[15px]">
                  <Hammer size={15} className="text-accent" /> {t("project.workingOn")}
                  <InfoTip text={t("project.workingOnTip")} />
                </h2>
                <ul className="mt-4 space-y-3 text-[13.5px] text-ink-soft">
                  {working.length === 0 && <li className="text-ink-muted">{t("project.nothingInFlight")}</li>}
                  {working.map((w) => (
                    <li key={w.id} className="flex items-start gap-2.5">
                      {w.status === "done" ? (
                        <CheckCircle2 size={14} className="mt-[1px] shrink-0 text-ink-muted" />
                      ) : (
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      )}
                      <span className={w.status === "done" ? "text-ink-muted line-through" : ""}>{w.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-line bg-bg-secondary p-5 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
                <h2 className="flex items-center gap-2 text-[15px]">
                  <Gavel size={15} className="text-accent" /> {t("project.decisionLog")}
                  <InfoTip text={t("project.decisionLogTip")} />
                </h2>
                <ul className="mt-4 space-y-4 text-[13.5px]">
                  {decisions.length === 0 && <li className="text-ink-muted">{t("project.noDecisions")}</li>}
                  {decisions.map((d) => (
                    <li key={d.id}>
                      <p className="text-ink">{d.summary}</p>
                      <p className="font-mono mt-1 text-[10.5px] text-ink-muted">
                        {d.decided_on}{d.recorded_by ? ` · ${d.recorded_by}` : ""}
                        {d.source === "approval" ? t("project.fromApproval") : d.source === "xpm" ? t("project.fromXpm") : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {tab === "deliverables" && (
          <section className="space-y-3">
            {deliverables.length === 0 && (
              <p className="text-sm text-ink-muted">{t("project.nothingAwaitingReview")}</p>
            )}
            {deliverables.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} locale={locale} />
            ))}
          </section>
        )}

        {tab === "documents" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-6">
            <DocumentLibrary projectId={project.id} documents={documents} fileRequests={fileRequests} locale={locale} />
          </section>
        )}

        {tab === "progress" && hasProgress && (
          <ProjectProgress
            milestones={milestones}
            activity={projectActivity}
            nextMeeting={nextMeeting}
            dueInvoices={dueInvoices}
            locale={locale}
          />
        )}

        {tab === "messages" && (
          <section>
            <MessageFeed projectId={project.id} messages={messages} locale={locale} />
          </section>
        )}
      </div>
    </div>
  );
}
