import LoginForm from "@/components/LoginForm";
import Logo from "@/components/Logo";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-bg-secondary p-8">
        <Logo size={34} tile="emerald" sub="Operator console" />
        <h1 className="mt-5 text-2xl font-semibold">Operator sign-in</h1>
        <LoginForm kind="operator" />
      </div>
    </main>
  );
}
