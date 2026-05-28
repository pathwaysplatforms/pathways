import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: { error?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const hasError = searchParams.error === "auth";

  return (
    <main className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-[28px] font-medium text-text-primary">Pathways</h1>
        </div>

        <div className="bg-bg-surface border border-border-light rounded-panel p-8 space-y-6">
          <LoginForm hasError={hasError} />
        </div>
      </div>
    </main>
  );
}
