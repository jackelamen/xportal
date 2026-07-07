"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarX2, Download } from "lucide-react";
import { toast } from "@/components/Toaster";
import { t, formatDate, formatDateTime } from "@/lib/i18n";

const LENGTHS = [15, 30, 45, 60];

export default function ScheduleClient({ locale }) {
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [counteringId, setCounteringId] = useState(null);
  const [counterSlots, setCounterSlots] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

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
      toast.error(t(locale, "schedule.toastNoTopic"));
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
      toast.error((await res.json()).error || t(locale, "schedule.toastBookError"));
      load();
      return;
    }
    toast(t(locale, "schedule.toastBooked", { topic: topic.trim(), slot: formatDateTime(locale, slot) }));
    setTopic("");
    load();
  }

  async function accept(b) {
    setBusy(true);
    const res = await fetch(`/api/bookings/${b.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    setBusy(false);
    if (res.ok) {
      toast(t(locale, "schedule.toastAccepted"));
      load();
    } else {
      toast.error((await res.json()).error || t(locale, "schedule.toastAcceptError"));
    }
  }

  async function openCounter(b) {
    setCounteringId(b.id);
    setCounterSlots(null);
    const res = await fetch(`/api/bookings?duration=${b.duration_minutes}&exclude=${b.id}`);
    const d = await res.json();
    setCounterSlots(d.slots || []);
  }

  async function counter(b, slot) {
    setBusy(true);
    const res = await fetch(`/api/bookings/${b.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "counter", starts_at: slot, duration_minutes: b.duration_minutes }),
    });
    setBusy(false);
    if (res.ok) {
      toast(t(locale, "schedule.toastBooked", { topic: b.topic, slot: formatDateTime(locale, slot) }));
      setCounteringId(null);
      load();
    } else {
      toast.error((await res.json()).error || t(locale, "schedule.toastCounterError"));
    }
  }

  async function confirmCancel(b) {
    if (!cancelReason.trim()) {
      toast.error(t(locale, "schedule.toastNoReason"));
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      toast(t(locale, "schedule.toastCancelled"));
      setCancelingId(null);
      setCancelReason("");
      load();
    } else {
      toast.error((await res.json()).error || t(locale, "schedule.toastCancelError"));
    }
  }

  const byDay = (slots || []).reduce((acc, s) => {
    ((acc[s.slice(0, 10)] ||= [])).push(s);
    return acc;
  }, {});
  const counterByDay = (counterSlots || []).reduce((acc, s) => {
    ((acc[s.slice(0, 10)] ||= [])).push(s);
    return acc;
  }, {});

  return (
    <div className="page-enter">
      <div className="flex items-stretch gap-4">
        <div className="w-[3px] shrink-0 rounded-full bg-spark" />
        <h1 className="text-[1.85rem] leading-none tracking-tight">{t(locale, "schedule.title")}</h1>
      </div>

      {bookings.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-bg-secondary p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{t(locale, "schedule.upcoming")}</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {bookings.map((b) => {
              const pendingOnUs = b.status === "pending" && b.proposed_by === "operator";
              const pendingOnThem = b.status === "pending" && b.proposed_by === "client";
              return (
                <li key={b.id} className="rounded-lg border border-line/70 bg-bg-primary/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {pendingOnUs ? (
                      <CalendarClock size={15} className="text-warn" />
                    ) : (
                      <CalendarCheck size={15} className="text-accent-2" />
                    )}
                    <span className="font-medium">{b.topic}</span>
                    <span className="text-ink-soft">
                      {formatDateTime(locale, b.starts_at)} · {t(locale, "schedule.minutes", { n: b.duration_minutes })}
                    </span>
                    <span className="ml-auto flex gap-3">
                      {b.status === "confirmed" && (
                        <a href={`/api/bookings/${b.id}/ics`} className="inline-flex items-center gap-1 text-accent hover:underline">
                          <Download size={13} /> {t(locale, "schedule.ics")}
                        </a>
                      )}
                      {pendingOnUs && (
                        <>
                          <button disabled={busy} onClick={() => accept(b)} className="text-accent-2 hover:underline">
                            {t(locale, "schedule.accept")}
                          </button>
                          <button disabled={busy} onClick={() => openCounter(b)} className="text-ink-soft hover:text-ink hover:underline">
                            {t(locale, "schedule.suggestDifferentTime")}
                          </button>
                        </>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => { setCancelingId(cancelingId === b.id ? null : b.id); setCancelReason(""); }}
                        className="inline-flex items-center gap-1 text-ink-muted hover:text-danger"
                      >
                        <CalendarX2 size={13} /> {t(locale, "schedule.cancelMeeting")}
                      </button>
                    </span>
                  </div>

                  {pendingOnThem && (
                    <p className="mt-1.5 text-xs text-ink-muted">{t(locale, "schedule.awaitingResponse")}</p>
                  )}
                  {pendingOnUs && (
                    <p className="mt-1.5 text-xs font-medium text-warn">
                      {t(locale, "schedule.newTimeProposed", { slot: formatDateTime(locale, b.starts_at) })}
                    </p>
                  )}

                  {counteringId === b.id && (
                    <div className="mt-3 rounded-lg border border-line bg-bg-secondary p-3">
                      {counterSlots === null ? (
                        <p className="text-xs text-ink-muted">{t(locale, "schedule.loadingAvailability")}</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(counterByDay).map(([day, daySlots]) => (
                            <div key={day}>
                              <p className="text-xs font-medium text-ink-soft">
                                {formatDate(locale, day, { weekday: "long", month: "short", day: "numeric" })}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {daySlots.map((s) => (
                                  <button
                                    key={s}
                                    disabled={busy}
                                    onClick={() => counter(b, s)}
                                    className="rounded-lg border border-line bg-bg-primary px-2.5 py-1 text-xs hover:border-accent disabled:opacity-50"
                                  >
                                    {s.slice(11, 16)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {Object.keys(counterByDay).length === 0 && (
                            <p className="text-xs text-ink-muted">{t(locale, "schedule.loadingAvailability")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {cancelingId === b.id && (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-bg-secondary p-3">
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={2}
                        placeholder={t(locale, "schedule.cancelReasonPlaceholder")}
                        className="rounded-lg border border-line bg-bg-primary px-2 py-1.5 text-sm text-ink outline-none focus:border-danger"
                      />
                      <button
                        disabled={busy}
                        onClick={() => confirmCancel(b)}
                        className="self-start rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {t(locale, "schedule.confirmCancellation")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-line bg-bg-secondary p-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <label className="block text-sm text-ink-soft">
            <span className="font-data text-[10.5px] font-medium uppercase tracking-widest text-ink-muted">
              {t(locale, "schedule.stepTopic")}
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t(locale, "schedule.topicPlaceholder")}
              className="mt-1.5 block w-72 max-w-full rounded-lg border border-line bg-bg-tertiary px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <div className="text-sm text-ink-soft">
            <span className="font-data text-[10.5px] font-medium uppercase tracking-widest text-ink-muted">
              {t(locale, "schedule.stepLength")}
            </span>
            <div className="mt-1.5 flex gap-1.5">
              {LENGTHS.map((len) => (
                <button
                  key={len}
                  onClick={() => setDuration(len)}
                  aria-pressed={duration === len}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    duration === len
                      ? "border-accent bg-accent font-medium text-white"
                      : "border-line bg-bg-secondary text-ink-soft hover:border-accent/50 hover:text-ink"
                  }`}
                >
                  {t(locale, "schedule.minutes", { n: len })}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="font-data text-[10.5px] font-medium uppercase tracking-widest text-ink-muted">
            {t(locale, "schedule.stepPick")}
          </p>
          {!topic.trim() && slots !== null && slots.length > 0 && (
            <p className="mt-2 text-xs text-ink-muted">{t(locale, "schedule.topicFirstHint")}</p>
          )}
          {slots === null ? (
            <p className="mt-3 text-sm text-ink-muted">{t(locale, "schedule.loadingAvailability")}</p>
          ) : slots.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{t(locale, "schedule.noSlots")}</p>
          ) : (
            <div className={`mt-4 space-y-5 transition-opacity ${topic.trim() ? "" : "opacity-60"}`}>
              {Object.entries(byDay).map(([day, daySlots]) => (
                <div key={day}>
                  <p className="text-sm font-medium text-ink-soft">
                    {formatDate(locale, day, { weekday: "long", month: "short", day: "numeric" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {daySlots.map((s) => (
                      <button
                        key={s}
                        disabled={busy}
                        onClick={() => book(s)}
                        className="font-data rounded-lg border border-line bg-bg-primary px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
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
      </section>
    </div>
  );
}
