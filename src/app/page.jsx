import LoginForm from "@/components/LoginForm";
import Logo from "@/components/Logo";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-bg-secondary p-8">
        <Logo size={34} />
        <h1 className="mt-5 text-2xl font-semibold">Client workspace</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Project status, deliverables, files, and billing in one place. No password — we email you a sign-in link.
        </p>
        <LoginForm kind="client" />
      </div>
    </main>
  );
}
