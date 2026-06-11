import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

// White-labeled login: /p/acme shows the client's logo and accent color.
export default async function BrandedLoginPage({ params }) {
  const { slug } = await params;
  const client = getDb()
    .prepare("SELECT company_name, logo_path, accent_color FROM clients WHERE slug = ?")
    .get(slug);
  if (!client) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-bg-secondary p-8">
        {client.logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/public-logo/${slug}`} alt={client.company_name} className="h-10 object-contain" />
        ) : (
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: client.accent_color || "#5b48ee" }}
          >
            {client.company_name}
          </p>
        )}
        <h1 className="mt-2 text-2xl font-semibold">{client.company_name} — Client workspace</h1>
        <LoginForm kind="client" accent={client.accent_color} />
      </div>
    </main>
  );
}
