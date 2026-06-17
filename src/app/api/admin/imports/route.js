import { NextResponse } from "next/server";
import { sql, uuid } from "@/lib/db";
import { requireOperator } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { parseProjectImport, summarizeImport } from "@/lib/csv";
import { importProjectData } from "@/lib/project-import";

// Import one project from a section-keyed CSV.
//   { client_id, csv } -> create a new project for that client
//   { project_id, csv } -> merge the CSV into an existing project
export async function POST(request) {
  const { error, operator } = await requireOperator();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.csv !== "string") {
    return NextResponse.json({ error: "csv text is required" }, { status: 400 });
  }

  const clientId = body.client_id ? String(body.client_id) : null;
  const projectId = body.project_id ? String(body.project_id) : null;
  if ((clientId && projectId) || (!clientId && !projectId)) {
    return NextResponse.json({ error: "Provide exactly one of client_id or project_id" }, { status: 400 });
  }

  const data = parseProjectImport(body.csv);
  if (clientId && !data.project.title) {
    data.errors.push("A project title is required to create a project — add a “project,title,…” row.");
  }
  if (data.errors.length) {
    return NextResponse.json(
      { error: "import_invalid", errors: data.errors, warnings: data.warnings },
      { status: 400 }
    );
  }

  let pid = projectId;
  if (clientId) {
    const client = (await sql("SELECT id FROM clients WHERE id = ?", [clientId]))[0];
    if (!client) return NextResponse.json({ error: "Unknown client" }, { status: 404 });
    pid = uuid();
    await sql(
      "INSERT INTO portal_projects (id, client_id, title, current_phase) VALUES (?, ?, ?, '')",
      [pid, clientId, data.project.title]
    );
  } else {
    const project = (await sql("SELECT id FROM portal_projects WHERE id = ?", [pid]))[0];
    if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });
  }

  await importProjectData(pid, data, { recordedBy: operator.name });

  const project = (await sql("SELECT client_id, title FROM portal_projects WHERE id = ?", [pid]))[0];
  const summary = summarizeImport(data);
  await logActivity({
    clientId: project.client_id, projectId: pid, actorType: "operator", actorName: operator.name,
    eventType: "project.imported",
    summary: `${operator.name} imported ${clientId ? "new project" : "data into"} "${project.title}" (${summary})`,
  });

  return NextResponse.json({ ok: true, project_id: pid, summary, warnings: data.warnings });
}
