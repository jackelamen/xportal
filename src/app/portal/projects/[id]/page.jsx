import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getClientSession } from "@/lib/auth";
import { Link2, Users, Gavel, Hammer } from "lucide-react";
import ProjectStatus from "@/components/ProjectStatus";
import Timeline from "@/components/Timeline";
import DeliverableCard from "@/components/DeliverableCard";
import MessageFeed from "@/components/MessageFeed";
import KpiGrid from "@/components/KpiGrid";
import DocumentLibrary from "@/components/DocumentLibrary";
import { InfoTip } from "@/components/Tip";

export const dynamic = "force-dynamic";

const TABS = ["overview", "deliverables", "documents", "timeline", "messages"];

export default async function ProjectPage({ params, searchParams }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.includes(rawTab) ? rawTab : "overview";

  const { client } = await getClientSession();

  const project = (await sql(
    "SELECT * FROM portal_projects WHERE id = ? AND client_id = ? AND hidden_from_client = 0",
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
  const kpis = await sql("SELECT * FROM project_kpis WHERE project_id = ? ORDER BY name", [id]);
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
    "SELECT * FROM working_items WHERE project_id = ? AND status = 'active' ORDER BY created_at", [id]
  );

  // Attention counts drive the tab badges. Messages stay unread until the
  // client marks them read (or replies) — no silent auto-read on page visit.
  const unreadCount = messages.filter((m) => m.sender_type === "Internal_Operator" && !m.is_read).length;
  const pendingCount = deliverables.filter((d) => d.status === "Pending").length;
  const requestCount = fileRequests.length;

  const hasTimeline = milestones.some((m) => m.kind === "phase" && m.starts_on && m.ends_on);
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "deliverables", label: "Deliverables", badge: pendingCount },
    { key: "documents", label: "Documents", badge: requestCount },
    ...(hasTimeline ? [{ key: "timeline", label: "Timeline" }] : []),
    { key: "messages", label: "Messages", badge: unreadCount },
  ];

  return (
    <div>
      {/* Hero: status + serif project title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {milestones.some((m) => m.kind === "phase" && m.status === "blocked") ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/12 px-2.5 py-1 text-[11px] font-semibold text-danger">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> NEEDS ATTENTION
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-2/12 px-2.5 py-1 text-[11px] font-semibold text-accent-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> ON TRACK
              </span>
            )}
            <span className="font-mono text-[11px] text-ink-muted">Updated {project.updated_at?.slice(0, 10)}</span>
          </div>
          <h1 className="mt-3 text-[2.4rem] font-semibold leading-none tracking-tight text-ink">{project.title}</h1>
          <p className="font-mono mt-2.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">{client.company_name}</p>
        </div>
      </div>

      {/* Phase timeline card */}
      <section className="mt-7 rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04),0_18px_40px_-24px_rgb(16_16_29_/_0.18)]">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
            Phase timeline
            <InfoTip side="bottom" text="Each segment is a project phase: green is finished, indigo is in progress now, red is blocked, and grey hasn't started." />
          </span>
        </div>
        <ProjectStatus
          phases={milestones.filter((m) => m.kind === "phase")}
          currentPhase={project.current_phase}
          progress={project.progress_percentage}
          targetDate={project.target_date}
        />
      </section>

      <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-line text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal/projects/${id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 -mb-px text-[13.5px] transition-colors ${
              tab === t.key
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="font-data rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
                {t.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-8">
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* Left: project hub */}
            <div className="min-w-0">
              <section className="rounded-2xl border border-line bg-bg-secondary p-6 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
                <h2 className="text-[19px]">Project hub</h2>
                {project.description && (
                  <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-ink-soft">{project.description}</p>
                )}

                {kpis.length > 0 && (
                  <div className="mt-7">
                    <p className="font-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
                      Key metrics
                      <InfoTip text="The numbers this project is judged by. Green means the target is met, amber means within 15% of it, red means off target." />
                    </p>
                    <div className="mt-3">
                      <KpiGrid kpis={kpis} />
                    </div>
                  </div>
                )}

                <div className="mt-7 grid gap-6 sm:grid-cols-2">
                  {links.length > 0 && (
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Key links</p>
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
                        <Users size={11} /> People
                      </p>
                      <ul className="mt-2.5 space-y-2 text-[13.5px]">
                        {people.map((p) => (
                          <li key={p.id} className="text-ink">
                            {p.name}
                            <span className="text-ink-muted"> — {p.role || (p.side === "operator" ? "Our team" : "Your team")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right rail: live work + decisions */}
            <div className="space-y-5">
              <section className="rounded-2xl border border-line bg-bg-secondary p-5 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
                <h2 className="flex items-center gap-2 text-[15px]">
                  <Hammer size={15} className="text-accent" /> We&apos;re working on
                  <InfoTip text="What the team is actively doing right now. Items disappear from this list when they're finished." />
                </h2>
                <ul className="mt-4 space-y-3 text-[13.5px] text-ink-soft">
                  {working.length === 0 && <li className="text-ink-muted">Nothing in flight right now.</li>}
                  {working.map((w) => (
                    <li key={w.id} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {w.title}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-line bg-bg-secondary p-5 shadow-[0_1px_2px_rgb(16_16_29_/_0.04)]">
                <h2 className="flex items-center gap-2 text-[15px]">
                  <Gavel size={15} className="text-accent" /> Decision log
                  <InfoTip text="A running record of the key decisions made on this project — including your deliverable approvals — so there's never a question about what was agreed and when." />
                </h2>
                <ul className="mt-4 space-y-4 text-[13.5px]">
                  {decisions.length === 0 && <li className="text-ink-muted">No recorded decisions yet.</li>}
                  {decisions.map((d) => (
                    <li key={d.id}>
                      <p className="text-ink">{d.summary}</p>
                      <p className="font-mono mt-1 text-[10.5px] text-ink-muted">
                        {d.decided_on}{d.recorded_by ? ` · ${d.recorded_by}` : ""}
                        {d.source === "approval" ? " · from approval" : d.source === "xpm" ? " · from xPM" : ""}
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
              <p className="text-sm text-ink-muted">Nothing awaiting review.</p>
            )}
            {deliverables.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} />
            ))}
          </section>
        )}

        {tab === "documents" && (
          <section className="rounded-xl border border-line bg-bg-secondary p-6">
            <DocumentLibrary projectId={project.id} documents={documents} fileRequests={fileRequests} />
          </section>
        )}

        {tab === "timeline" && hasTimeline && (
          <section className="rounded-xl border border-line bg-bg-secondary p-6">
            <p className="mb-3 flex justify-end">
              <InfoTip text="Each bar is a project phase plotted on the calendar; diamonds are one-day milestones. The vertical line marks today." />
            </p>
            <Timeline milestones={milestones} />
          </section>
        )}

        {tab === "messages" && (
          <section>
            <MessageFeed projectId={project.id} messages={messages} />
          </section>
        )}
      </div>
    </div>
  );
}
