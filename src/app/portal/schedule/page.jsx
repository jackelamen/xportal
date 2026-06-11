"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarX2, Download } from "lucide-react";
import { toast } from "@/components/Toaster";

const LENGTHS = [15, 30, 45, 60];

export default function SchedulePage() {
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setSlots(null);
    fetch(`/api/bookings?duration=${duration}`)
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.slots || []);
        setBookings(d.bookings || []);
      });
  }, [duration]);

  useEffect(load, [load]);

  async function book(slot) {
    if (!topic.trim()) {
      toast.error("Please enter a meeting topic first.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starts_at: slot, topic, duration_minutes: duration }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error((await res.json()).error || "Could not book that slot");
      load();
      return;
    }
    toast(`Booked "${topic.trim()}" — ${slot.slice(0, 16)}.`);
    setTopic("");
    load();
  }

  async function cancel(b) {
    setBusy(true);
    const res = await fetch(`/api/bookings/${b.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast("Meeting cancelled.");
      load();
    } else {
      toast.error("Could not cancel that meeting");
    }
  }

  const byDay = (slots || []).reduce((acc, s) => {
    ((acc[s.slice(0, 10)] ||= [])).push(s);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-semibold">Book a meeting</h1>

      {bookings.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-bg-secondary p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Upcoming</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <CalendarCheck size={15} className="text-accent-2" />
                <span className="font-medium">{b.topic}</span>
                <span className="text-ink-soft">
                  {b.starts_at.slice(0, 16)} · {b.duration_minutes} min
                </span>
                <span className="ml-auto flex gap-3">
                  <a href={`/api/bookings/${b.id}/ics`} className="inline-flex items-center gap-1 text-accent hover:underline">
                    <Download size={13} /> .ics
                  </a>
                  <button
                    disabled={busy}
                    onClick={() => cancel(b)}
                    className="inline-flex items-center gap-1 text-ink-muted hover:text-danger"
                  >
                    <CalendarX2 size={13} /> Cancel
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="block text-sm text-ink-soft">
          Topic <span className="text-danger">*</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's the meeting about?"
            className="mt-1 block w-72 rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="text-sm text-ink-soft">
          Length
          <div className="mt-1 flex gap-1.5">
            {LENGTHS.map((len) => (
              <button
                key={len}
                onClick={() => setDuration(len)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  duration === len
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-bg-secondary text-ink-soft hover:text-ink"
                }`}
              >
                {len} min
              </button>
            ))}
          </div>
        </div>
      </div>

      {slots === null ? (
        <p className="mt-6 text-ink-muted">Loading availability…</p>
      ) : (
        <div className="mt-6 space-y-5">
          {Object.entries(byDay).map(([day, daySlots]) => (
            <div key={day}>
              <p className="text-sm font-medium text-ink-soft">
                {new Date(day + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => book(s)}
                    className="rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
                  >
                    {s.slice(11, 16)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
