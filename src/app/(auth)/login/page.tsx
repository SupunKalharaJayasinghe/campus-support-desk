import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <div className="grid w-full max-w-5xl gap-10 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-4">
        <div className="flex items-center gap-2 text-indigo-600">
          <span className="h-10 w-10 rounded-xl bg-indigo-600 text-center text-lg font-semibold leading-10 text-white">
            CS
          </span>
          <span className="font-display text-xl font-semibold text-slate-900">
            Campus Support Desk
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-slate-900">
          Welcome back
        </h1>
        <p className="text-slate-600">
          Sign in to access your personalized dashboard and manage campus support
          requests.
        </p>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          Return to home
        </Link>
      </div>
      <Card>
        <LoginForm />
      </Card>
    </div>
  );
}
