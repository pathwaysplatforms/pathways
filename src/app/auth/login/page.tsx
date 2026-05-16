import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: { error?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const hasError = searchParams.error === "auth";

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-[28px] font-medium text-neutral-900">Pathways</h1>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-8 space-y-6">
          <LoginForm hasError={hasError} />
        </div>
      </div>
    </main>
  );
}
