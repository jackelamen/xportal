import OperatorLoginForm from "@/components/OperatorLoginForm";
import LoginShell from "@/components/LoginShell";
import Logo from "@/components/Logo";

export default function AdminLoginPage() {
  return (
    <LoginShell
      tile="emerald"
      eyebrow="Operator console"
      headline="Run every client engagement from one place."
      blurb="Status, deliverables, billing, and messages for every client, updated the moment you touch them."
    >
      <div className="mb-8">
        <Logo size={30} tile="emerald" sub="Operator console" />
      </div>
      <h2 className="text-2xl font-semibold text-ink">Operator sign-in</h2>
      <p className="mt-1.5 text-sm text-ink-soft">Sign in to manage clients and projects.</p>
      <div className="mt-7">
        <OperatorLoginForm />
      </div>
    </LoginShell>
  );
}
