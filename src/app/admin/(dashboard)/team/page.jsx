import { getOperatorSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { InfoTip } from "@/components/Tip";

export const dynamic = "force-dynamic";

const input =
  "mt-1 block rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink outline-none focus:border-accent-2";

export default async function AdminTeam() {
  const me = await getOperatorSession();
  const operators = await sql("SELECT * FROM operator_users ORDER BY created_at");

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-stretch gap-4">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <div>
          <p className="font-data text-[11px] uppercase tracking-widest text-ink-muted">Operator console</p>
          <h1 className="mt-1 text-[1.5rem] leading-none text-ink">Team</h1>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-bg-secondary p-5">
        <h2 className="flex items-center gap-1.5 font-medium text-ink">
          Operators
          <InfoTip side="bottom" text="Everyone with access to this admin console. Operators sign in with their xPM email and password; adding someone here grants them access. Removing them revokes it immediately." />
        </h2>

        <div className="mt-3 divide-y divide-line/70 rounded-lg border border-line">
          {operators.map((o) => {
            const isMe = me?.id === o.id;
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-2/12 text-[11px] font-semibold text-accent-2">
                  {(o.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    {o.name}
                    {isMe && <span className="font-mono rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">You</span>}
                  </p>
                  <p className="font-data text-xs text-ink-muted">{o.email}</p>
                </div>
                <span className="font-data ml-auto text-xs text-ink-muted">added {o.created_at?.slice(0, 10)}</span>
                {!isMe && operators.length > 1 && (
                  <form action={`/api/admin/operators/${o.id}`} method="post">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="_redirect" value="/admin/team" />
                    <button className="text-xs text-ink-muted hover:text-danger">Remove</button>
                  </form>
                )}
              </div>
            );
          })}
          {operators.length === 0 && <p className="px-3.5 py-3 text-sm text-ink-muted">No operators yet.</p>}
        </div>

        <form action="/api/admin/operators" method="post" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="_redirect" value="/admin/team" />
          <label className="block text-ink-soft">Name<input name="name" required placeholder="Jamie Rivera" className={input} /></label>
          <label className="block text-ink-soft">xPM email<input name="email" type="email" required placeholder="jamie@studio.co" className={`${input} w-56`} /></label>
          <button className="rounded-lg bg-accent-2 px-4 py-2 font-medium text-white">Add operator</button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          They sign in with their existing xPM email and password. If they don&apos;t have an xPM account yet, create one there first.
        </p>
      </section>
    </div>
  );
}
