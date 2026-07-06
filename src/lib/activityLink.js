// Maps an activity_log row to the page a viewer should land on to see the
// actual record it describes. There's no stored link column - event_type
// plus project_id/client_id is all activity_log carries, so the target is
// derived at render time. Mirrors the href conventions already used by the
// client home page's "attention" list (src/app/portal/page.jsx) - e.g.
// invoices are a standalone /portal/billing page, not a project tab.
const PROJECT_TAB = {
  message: { admin: "messages", client: "messages" },
  document: { admin: "documents", client: "documents" },
  deliverable: { admin: "deliverables", client: "deliverables" },
  kpi: { admin: "overview", client: "overview" },
  file_request: { admin: "overview", client: "documents" },
  project: { admin: "plan", client: "overview" },
};

export function activityHref({ event_type, project_id, client_id }, audience) {
  const category = String(event_type || "").split(".")[0];

  if (category === "meeting") {
    return audience === "admin" ? "/admin/bookings" : "/portal/schedule";
  }
  if (category === "client") {
    return audience === "admin" ? `/admin/clients/${client_id}` : null;
  }
  if (category === "invoice") {
    return audience === "admin" && project_id
      ? `/admin/projects/${project_id}?tab=billing`
      : audience === "client"
      ? "/portal/billing"
      : null;
  }
  if (!project_id) {
    return audience === "admin" ? `/admin/clients/${client_id}` : null;
  }

  const tab = PROJECT_TAB[category]?.[audience];
  const base = audience === "admin" ? `/admin/projects/${project_id}` : `/portal/projects/${project_id}`;
  return tab && tab !== "overview" ? `${base}?tab=${tab}` : base;
}
