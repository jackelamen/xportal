"use client";

import { useState } from "react";

// The "add key result" form's fields change shape by type: numeric KPIs need
// current/goal/unit/direction, boolean ones need only a Yes/No/Pending
// reading. One client component toggles which set is visible, still
// submitting as a plain form post to the hub route.
export default function KpiTypeFields({ input }) {
  const [kind, setKind] = useState("numeric");

  return (
    <>
      <label className="block text-ink-soft">
        Type
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={input}
        >
          <option value="numeric">Numeric</option>
          <option value="boolean">Yes / No</option>
        </select>
      </label>

      {kind === "numeric" ? (
        <>
          <label className="block text-ink-soft">
            Current
            <input name="current_value" type="number" step="any" className={`${input} w-24`} />
          </label>
          <label className="block text-ink-soft">
            Goal
            <input name="target_value" type="number" step="any" className={`${input} w-24`} />
          </label>
          <label className="block text-ink-soft">
            Unit
            <input name="unit" placeholder="s, %, users…" className={`${input} w-24`} />
          </label>
          <label className="block text-ink-soft">
            Direction
            <select name="direction" className={input}>
              <option value="up">Higher is better</option>
              <option value="down">Lower is better</option>
            </select>
          </label>
        </>
      ) : (
        <label className="block text-ink-soft">
          Reading
          <select name="current_value" defaultValue="" className={input}>
            <option value="">Pending</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
      )}
    </>
  );
}
