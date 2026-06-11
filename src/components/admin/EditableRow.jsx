// Server-component row with inline edit (collapsed by default), delete, and
// optional extra actions. Used for working items, decisions, and internal
// notes on the admin side. `action` is the form-post endpoint.
export function EditableRow({
  text, meta, struck, action, here, idField, idValue,
  updateAction, deleteAction, editField, editDateField, editDateValue, extraActions,
  boxed = false,
}) {
  return (
    <li className={boxed ? "rounded-lg border border-line bg-bg-primary px-4 py-3" : "py-2.5"}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-sm ${struck ? "text-ink-muted line-through" : "text-ink"}`}>{text}</p>
          {meta && <p className="mt-0.5 text-xs text-ink-muted">{meta}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          {extraActions}
          <details className="relative">
            <summary className="cursor-pointer list-none text-ink-muted hover:text-ink">Edit</summary>
            <form action={action} method="post" className="mt-2 flex w-72 flex-col gap-2 rounded-lg border border-line bg-bg-tertiary p-3">
              <input type="hidden" name="_action" value={updateAction} />
              <input type="hidden" name={idField} value={idValue} />
              <input type="hidden" name="_redirect" value={here} />
              <textarea
                name={editField}
                required
                rows={2}
                defaultValue={text}
                className="rounded-lg border border-line bg-bg-secondary px-2 py-1.5 text-sm text-ink outline-none focus:border-accent-2"
              />
              {editDateField && (
                <input
                  name={editDateField}
                  type="date"
                  defaultValue={editDateValue || ""}
                  className="rounded-lg border border-line bg-bg-secondary px-2 py-1.5 text-xs text-ink outline-none focus:border-accent-2"
                />
              )}
              <button className="self-start rounded-lg bg-accent-2 px-3 py-1.5 font-medium text-white">Save</button>
            </form>
          </details>
          <RowButton action={action} here={here} formAction={deleteAction} idField={idField} idValue={idValue} label="Delete" tone="danger" />
        </div>
      </div>
    </li>
  );
}

export function RowButton({ action, here, formAction, idField, idValue, label, tone }) {
  const color =
    tone === "danger" ? "text-ink-muted hover:text-danger"
    : tone === "good" ? "text-ink-muted hover:text-accent-2"
    : "text-ink-muted hover:text-ink";
  return (
    <form action={action} method="post">
      <input type="hidden" name="_action" value={formAction} />
      <input type="hidden" name={idField} value={idValue} />
      <input type="hidden" name="_redirect" value={here} />
      <button className={`text-xs ${color}`}>{label}</button>
    </form>
  );
}
