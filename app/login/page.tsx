import Link from "next/link";
import { AuthForm } from "./auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-lg font-extrabold tracking-tight">AllInOne API</Link>
        <div className="panel mt-6 p-6">
          <AuthForm initialMode={mode === "signup" ? "signup" : "signin"} />
        </div>
      </div>
    </main>
  );
}
