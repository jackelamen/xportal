import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import FilePicker from "@/components/FilePicker";
import { EditableRow } from "@/components/admin/EditableRow";
import { InfoTip } from "@/components/Tip";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABS = ["projects", "settings"];

export default async function AdminClientPage({ params, searchParams }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.includes(rawTab) ? rawTab : "projects";

  const client = (await sql("SELECT * FROM clients WHERE id = ?", [id]))[0];
  if (!client) notFound();

  const users = await sql("SELECT * FROM client_users WHERE client_id = ? ORDER BY name", [id]);
  const projects = await sql(
    "SELECT * FROM portal_projects WHERE client_id = ? ORDER BY updated_at DESC", [id]
  );
  const notes = await sql(
    "SELECT * FROM internal_notes WHERE client_id = ? AND project_id IS NULL ORDER BY created_at DESC", [id]
  );
  const here = `/admin/clients/${id}${tab === "projects" ? "" : `?tab=${tab}`}`;

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-ink-muted">
        <Link href="/admin" className="hover:text-ink">Dashboard</Link>
        <ChevronRight size={14} className="shrink-0" />
        <span className="text-ink">{client.company_name}</span>
      </nav>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{client.company_name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {client.primary_email}
            {client.slug && (
              <> · <Link href={`/p/${client.slug}`} className="text-accent hover:underline">/p/{client.slug}</Link></>
            )}
          </p>
        </div>
        <form action="/api/admin/preview" method="post">
          <input type="hidden" name="client_id" value={client.id} />
          <button
            title="Open the client portal exactly as this client sees it — read-only"
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft hover:border-accent hover:text-ink"
          >
            <Eye size={14} /> Preview their portal
          </button>
        </form>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-line text-sm">
        {[
          { key: "projects", label: "Projects" },
          { key: "settings", label: "Settings" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin/clients/${id}${t.key === "projects" ? "" : `?tab=${t.key}`}`}
            className={`border-b-2 px-4 py-2.5 -mb-px ${
              tab === t.key
                ? "border-accent-2 font-medium text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-8">
        {tab === "projects" && (
          <>
            <section>
              <h2 className="text-lg font-medium">Projects</h2>
              <div className="mt-3 space-y-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`relative flex items-center justify-between gap-3 rounded-lg border border-line bg-bg-secondary px-4 py-3 text-sm hover:border-accent-2 ${
                      p.hidden_from_client ? "opacity-60" : ""
                    }`}
                  >
                    <Link href={`/admin/projects/${p.id}`} className="flex min-w-0 items-center gap-2 font-medium after:absolute after:inset-0">
                      <span className="truncate">{p.title}</span>
                      {p.hidden_from_client ? (
                        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
                          hidden from client
                        </span>
                      ) : null}
                    </Link>
                    <span className="ml-auto shrink-0 text-ink-soft">{p.current_phase} · {p.progress_percentage}%</span>
                    <form action={`/api/admin/projects/${p.id}`} method="post" className="relative z-10 shrink-0">
                      <input type="hidden" name="_action" value="toggle_visibility" />
                      <input type="hidden" name="_redirect" value={here} />
                      <button
                        title={p.hidden_from_client ? "Show this project in the client portal" : "Hide this project from the client portal"}
                        className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink-soft hover:border-accent hover:text-ink"
                      >
                        {p.hidden_from_client ? <><Eye size={12} /> Show</> : <><EyeOff size={12} /> Hide</>}
                      </button>
                    </form>
                  </div>
                ))}
                {projects.length === 0 && (
                  <p className="text-sm text-ink-muted">No projects yet.</p>
                )}
              </div>
              <details className="mt-3 rounded-xl border border-line bg-bg-secondary p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink-soft">+ New project</summary>
                <form action="/api/admin/projects" method="post" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
                  <input type="hidden" name="client_id" value={id} />
                  <input type="hidden" name="_redirect" value={here} />
                  <label className="block text-ink-soft">
                    Title
                    <input name="title" required className="mt-1 block w-64 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2" />
                  </label>
                  <label className="block text-ink-soft">
                    Target date
                    <input name="target_date" type="date" className="mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2" />
                  </label>
                  <label className="block text-ink-soft">
                    <span className="flex items-center gap-1.5">xPM id (optional) <InfoTip text="Links this project to its xPM counterpart so phase, progress, KPIs, and decisions sync automatically over the bridge." /></span>
                    <input name="xpm_project_id" className="mt-1 block w-32 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2" />
                  </label>
                  <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Create</button>
                </form>
              </details>
            </section>

            <section className="rounded-xl border border-warn/30 bg-bg-secondary p-5">
              <h2 className="font-medium text-warn">Internal notes — never shown to the client</h2>
              <ul className="mt-3 space-y-2">
                {notes.length === 0 && <li className="py-2 text-sm text-ink-muted">No notes yet.</li>}
                {notes.map((n) => (
                  <EditableRow
                    key={n.id}
                    text={n.content}
                    meta={`${n.author_name} · ${n.created_at.slice(0, 10)}`}
                    action={`/api/admin/clients/${id}`}
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
              <form action={`/api/admin/clients/${id}`} method="post" className="mt-3 flex items-end gap-2 text-sm">
                <input type="hidden" name="_action" value="add_note" />
                <input type="hidden" name="_redirect" value={here} />
                <input
                  name="content"
                  required
                  placeholder="Private note about this client…"
                  className="flex-1 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2"
                />
                <button className="rounded-lg border border-line px-4 py-2 text-ink-soft hover:text-ink">Add note</button>
              </form>
            </section>
          </>
        )}

        {tab === "settings" && (
          <>
            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">Branding <InfoTip side="bottom" text="Makes the portal look like it was built for this client. The accent color recolors buttons, links, and badges throughout their portal; the logo replaces the text mark; the slug gives them a branded sign-in page at /p/<slug>." /></h2>
              <form
                action={`/api/admin/clients/${id}`}
                method="post"
                encType="multipart/form-data"
                className="mt-3 flex flex-wrap items-end gap-4 text-sm"
              >
                <input type="hidden" name="_action" value="branding" />
                <input type="hidden" name="_redirect" value={here} />
                <label className="block text-ink-soft">
                  Accent color
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      name="accent_color"
                      defaultValue={client.accent_color || "#5b48ee"}
                      className="h-9 w-12 cursor-pointer rounded border border-line bg-bg-tertiary"
                    />
                    <span className="text-xs text-ink-muted">{client.accent_color || "default"}</span>
                  </div>
                </label>
                <label className="block text-ink-soft">
                  Login slug (/p/…)
                  <input
                    name="slug"
                    defaultValue={client.slug || ""}
                    className="mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2"
                  />
                </label>
                <div className="text-ink-soft">
                  Logo (PNG/SVG, &lt;2 MB)
                  <div className="mt-1">
                    <FilePicker name="logo" accept="image/*" label="Choose logo…" />
                  </div>
                </div>
                <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Save branding</button>
              </form>
              {client.logo_path && (
                <p className="mt-2 text-xs text-ink-muted">Current logo: {client.logo_path.split("/").pop()}</p>
              )}
            </section>

            <section className="rounded-xl border border-line bg-bg-secondary p-5">
              <h2 className="flex items-center gap-1.5 font-medium text-ink">Contacts <InfoTip side="bottom" text="Everyone who can sign in to this client's portal. Each contact gets their own magic-link login and receives email notifications." /></h2>
              <ul className="mt-3 space-y-2 text-sm">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <span className="text-ink">{u.name}</span>
                    <span className="text-ink-muted">{u.email}</span>
                    {users.length > 1 && (
                      <form action={`/api/admin/clients/${id}`} method="post" className="ml-auto">
                        <input type="hidden" name="_action" value="remove_user" />
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="_redirect" value={here} />
                        <button className="text-xs text-ink-muted hover:text-danger">Remove</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <form action={`/api/admin/clients/${id}`} method="post" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
                <input type="hidden" name="_action" value="add_user" />
                <input type="hidden" name="_redirect" value={here} />
                <label className="block text-ink-soft">
                  Name
                  <input name="name" required className="mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2" />
                </label>
                <label className="block text-ink-soft">
                  Email
                  <input name="email" type="email" required className="mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-ink outline-none focus:border-accent-2" />
                </label>
                <button className="rounded-lg border border-line px-4 py-2 text-ink-soft hover:text-ink">Add contact</button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
