"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import campusBackground from "@/app/images/Services/lecturer.png";

export default function LoginPage() {
  const router = useRouter();
  const [campusIdOrEmail, setCampusIdOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push("/student");
  };

  return (
    <div className="relative min-h-screen bg-[#D9D9D9]">
      <Image
        alt=""
        aria-hidden
        className="object-cover"
        fill
        priority
        src={campusBackground}
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-[rgba(3,74,166,0.10)]" />

      <div className="relative z-10">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 lg:px-10">
          <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="space-y-5 text-[#D9D9D9]">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#D9D9D9]/80">
                Welcome to UniHub
              </p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Campus Services, One Login.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[#D9D9D9]/88">
                Access campus support, service requests, and your role dashboard
                securely.
              </p>
              <p className="text-sm text-[#D9D9D9]/72">
                Authorized university members only.
              </p>
            </div>

            <div className="w-full rounded-3xl border border-black/10 bg-white p-8 shadow-lg shadow-black/10 lg:p-10">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                Login
              </h2>
              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label
                    className="text-sm font-medium text-[#26150F]"
                    htmlFor="campus-id-email"
                  >
                    Campus ID or Campus Email
                  </label>
                  <input
                    className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[#26150F] placeholder:text-[#26150F]/45 outline-none transition focus:border-[#034AA6] focus:ring-4 focus:ring-[#034AA6]/30"
                    id="campus-id-email"
                    name="campusIdOrEmail"
                    onChange={(event) => setCampusIdOrEmail(event.target.value)}
                    placeholder="e.g., IT23123456 or name@campus.edu"
                    required
                    type="text"
                    value={campusIdOrEmail}
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-medium text-[#26150F]"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <input
                    className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[#26150F] placeholder:text-[#26150F]/45 outline-none transition focus:border-[#034AA6] focus:ring-4 focus:ring-[#034AA6]/30"
                    id="password"
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    type="password"
                    value={password}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label
                    className="inline-flex items-center gap-2 text-sm text-[#26150F]/85"
                    htmlFor="remember-me"
                  >
                    <input
                      checked={rememberMe}
                      className="h-4 w-4 rounded border border-black/25 accent-[#034AA6] focus:ring-2 focus:ring-[#034AA6]/30"
                      id="remember-me"
                      name="rememberMe"
                      onChange={(event) => setRememberMe(event.target.checked)}
                      type="checkbox"
                    />
                    Remember Me
                  </label>

                  <Link
                    className="text-sm text-[#034AA6] transition-colors duration-200 hover:text-[#0339A6] hover:underline"
                    href="#"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  className="w-full rounded-2xl bg-[#034AA6] px-6 py-3 font-semibold text-[#D9D9D9] transition-colors duration-200 hover:bg-[#0339A6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#034AA6]/30"
                  type="submit"
                >
                  Login
                </button>

                <p className="text-sm text-[#26150F]/68">
                  Need access? Contact Campus IT Services.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
