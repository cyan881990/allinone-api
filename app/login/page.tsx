import Link from "next/link";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-lg font-extrabold tracking-tight">AllInOne API</Link>
        <div className="panel mt-6 p-6">
          <AuthForm />
        </div>
      </div>
    </main>
  );
}
