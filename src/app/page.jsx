import LoginForm from "@/components/LoginForm";
import LoginShell from "@/components/LoginShell";
import Logo from "@/components/Logo";

export default function LoginPage() {
  return (
    <LoginShell
      tile="indigo"
      eyebrow="Client portal"
      headline="Your project, your progress, in one place."
      blurb="Review deliverables, follow progress, and stay in sync with your team — all in real time."
    >
      <div className="mb-8">
        <Logo size={30} sub="Client portal" />
      </div>
      <h2 className="text-2xl font-semibold text-ink">Sign in to your workspace</h2>
      <p className="mt-1.5 text-sm text-ink-soft">Review progress, deliverables, and billing in one place.</p>
      <div className="mt-7">
        <LoginForm kind="client" />
      </div>
    </LoginShell>
  );
}
