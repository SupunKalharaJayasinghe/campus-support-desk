'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BookOpen,
  Clock3,
  LifeBuoy,
  Mail,
  Package,
  Phone,
  ShieldAlert,
  Users,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Container from '@/components/ui/Container';
import universityLogo from '@/app/images/university-logo.png';
import studentImg from '@/app/images/Services/student.png';
import lecturerImg from '@/app/images/Services/lecturer.png';
import officerImg from '@/app/images/Services/officer.png';
import administratorImg from '@/app/images/Services/administrator.png';

const roleCards = [
  {
    title: 'Student',
    icon: Users,
    image: studentImg,
    items: [
      'View announcements',
      'Track academic progress',
      'Book lecturer consultations',
      'Submit support requests',
      'Report lost items',
    ],
  },
  {
    title: 'Lecturer',
    icon: BookOpen,
    image: lecturerImg,
    items: [
      'Manage availability',
      'Handle student bookings',
      'Publish announcements',
      'Respond to student queries',
    ],
  },
  {
    title: 'Lost Item Officer',
    icon: Package,
    image: officerImg,
    items: [
      'Register found items',
      'Verify ownership claims',
      'Manage recovery process',
    ],
  },
  {
    title: 'Administrator',
    icon: ShieldAlert,
    image: administratorImg,
    items: [
      'Manage users & permissions',
      'Oversee academic structure',
      'Monitor system activity',
    ],
  },
];

const systemInfo = [
  { label: 'System Status', value: 'Operational' },
  { label: 'Support', value: 'Campus IT Services' },
  { label: 'Support Hours', value: 'Mon–Fri 8:00 AM – 5:00 PM' },
  { label: 'Emergency Line', value: '555-0199' },
];

export default function LandingPage() {
  const router = useRouter();
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <section className="w-full py-24">
        <Container size="6xl">
          <div
            className="rounded-3xl border border-border bg-card p-8 shadow-shadow md:p-12 lg:p-14"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(3,74,166,0.12), transparent 60%)',
            }}
          >
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-text/60">
                  Internal University Platform
                </p>
                <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-heading sm:text-5xl">
                  UniHub – Campus Academic & Support System
                </h1>
                <span className="mt-4 block h-0.5 w-20 rounded-full bg-primary" />
                <p className="mt-5 max-w-4xl text-base leading-8 text-text/80">
                  A centralized platform for academic coordination, campus
                  services, and administrative operations.
                </p>
                <div className="mt-9">
                  <button
                    className="w-full rounded-2xl border-none bg-[#034AA6] px-8 py-3 text-sm font-semibold text-[#D9D9D9] transition-all duration-200 hover:bg-[#0339A6] hover:shadow-shadowHover sm:w-auto"
                    onClick={() => router.push('/login')}
                    type="button"
                  >
                    Login to Portal
                  </button>
                  <p className="mt-3 text-xs tracking-[0.12em] text-text/62">
                    Authorized university members only
                  </p>
                </div>
              </div>

              <div className="flex min-h-56 items-center justify-center px-4 py-2 lg:min-h-80 lg:px-8">
                {logoError ? (
                  <p className="text-sm font-medium tracking-[0.12em] text-text/65">
                    University Logo
                  </p>
                ) : (
                  <Image
                    alt="University logo"
                    className="h-auto w-full max-w-72"
                    height={300}
                    onError={() => setLogoError(true)}
                    priority
                    src={universityLogo}
                    style={{
                      filter: 'drop-shadow(0 8px 18px rgba(38,21,15,0.15))',
                    }}
                    width={300}
                  />
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="w-full py-16 lg:py-20">
        <Container size="6xl">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0A0A0A] lg:text-4xl">
              Access Campus Services
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {roleCards.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  className="group p-0! rounded-3xl overflow-hidden border-2 outline-none transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#034AA6] hover:shadow-shadowHover focus-visible:outline-none focus-within:ring-2 focus-within:ring-[#034AA6]/40 focus-within:ring-offset-0"
                  key={item.title}
                >
                  <div className="relative w-full h-40 lg:h-44">
                    <Image
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-80"
                      fill
                      sizes="(min-width: 1280px) 280px, (min-width: 768px) 45vw, 90vw"
                      src={item.image}
                    />
                    <div className="absolute inset-0 z-1 bg-linear-to-b from-black/65 via-black/40 to-black/10" />
                    <div className="relative z-10 px-6 py-6">
                      <div className="inline-flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/25 text-white backdrop-blur-sm">
                          <Icon size={18} />
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/70 px-6 pb-6 pt-6">
                    <ul className="space-y-3">
                      {item.items.map((entry) => (
                        <li
                          className="text-sm leading-6 text-text/80"
                          key={entry}
                        >
                          • {entry}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="relative mt-16 w-full overflow-hidden bg-[#034AA6] py-16 lg:mt-20 lg:py-20">
        <div className="absolute -right-25 top-1/2 h-100 w-100 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
        <Container size="6xl" className="relative z-10 flex items-center">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#D9D9D9] lg:text-3xl">
                Need Help?
              </h2>
              <p className="mt-2 max-w-md text-base text-[#D9D9D9]/80">
                Report an issue to the Administrator and get assistance.
              </p>
            </div>

            <Link
              className="mx-auto inline-flex items-center justify-center gap-5 text-5xl font-bold leading-tight tracking-tight text-[#D9D9D9] transition-all duration-300 hover:translate-x-1 hover:opacity-90 lg:mx-0 lg:gap-6 lg:text-6xl"
              href="/report-problem"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 text-[#D9D9D9]">
                <LifeBuoy size={24} />
              </span>
              <span>Report a Problem</span>
            </Link>
          </div>
        </Container>
      </section>

      <section className ="mt-16 w-full py-16 lg:mt-20 lg:py-20">
         <button
                    className="w-full rounded-2xl border-none bg-[#034AA6] px-8 py-3 text-sm font-semibold text-[#D9D9D9] transition-all duration-200 hover:bg-[#0339A6] hover:shadow-shadowHover sm:w-auto"
                    onClick={() => router.push('/student-help/community-help')}
                    type="button"
                  >
                    Community-help
                  </button>
          </section>

      <section className="mt-16 w-full py-16 lg:mt-20 lg:py-20" id="system-info">
        <Container size="6xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#26150F]/60">
              STATUS
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#0A0A0A] lg:text-4xl">
              System Information
            </h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {systemInfo.map((item, index) => {
              const Icon =
                index === 0
                  ? ShieldAlert
                  : index === 1
                    ? LifeBuoy
                    : index === 2
                      ? BookOpen
                      : Users;
              const isStatus = item.value === 'Operational';

              return (
                <div
                  className="rounded-3xl border border-black/15 bg-white/60 p-5 shadow-[0_4px_14px_rgba(38,21,15,0.05)] transition-colors duration-300 hover:border-[#034AA6]/60"
                  key={item.label}
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#034AA6]/10 text-[#034AA6]">
                    <Icon size={16} />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#26150F]/70">
                    {item.label}
                  </p>
                  {isStatus ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#034AA6]/20 bg-[#034AA6]/10 px-2.5 py-1 text-sm font-medium text-[#034AA6]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#034AA6]" />
                      Operational
                    </div>
                  ) : (
                    <p className="mt-3 text-base font-medium text-[#26150F]">
                      {item.value}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <footer className="w-full bg-[#0A0A0A] text-[#D9D9D9]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 items-start gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-14">
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                UniHub
              </h3>
              <div className="space-y-3">
                <p className="max-w-xs text-sm leading-relaxed text-white/70">
                  Official campus portal for service requests, support, and
                  operational updates.
                </p>
                <p className="text-xs uppercase tracking-[0.12em] text-white/55">
                  Authorized university members only.
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                Quick Links
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    className="text-base text-[#D9D9D9] transition-colors duration-200 hover:text-[#034AA6]"
                    href="/login"
                  >
                    Login
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-base text-[#D9D9D9] transition-colors duration-200 hover:text-[#034AA6]"
                    href="/report-problem"
                  >
                    Report a Problem
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-base text-[#D9D9D9] transition-colors duration-200 hover:text-[#034AA6]"
                    href="/dashboard"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-base text-[#D9D9D9] transition-colors duration-200 hover:text-[#034AA6]"
                    href="/#system-info"
                  >
                    System Information
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                Support & Contact
              </h4>
              <ul className="space-y-2 text-sm leading-relaxed text-white/70">
                <li className="text-base font-medium leading-relaxed text-[#D9D9D9]">
                  Campus IT Services
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={14} className="shrink-0 text-[#034AA6]" />
                  <span>helpdesk@university.edu</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0 text-[#034AA6]" />
                  <span>555-0199</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock3 size={14} className="shrink-0 text-[#034AA6]" />
                  <span>Mon–Fri 8:00 AM – 5:00 PM</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-white/55">
                Emergency line: 555-0199 (urgent only)
              </p>
            </div>

          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <div className="flex flex-col gap-3 text-center text-sm text-white/65 lg:flex-row lg:items-center lg:text-left">
              <div className="flex items-center justify-center lg:flex-1 lg:justify-start">
                <p>© 2025 UniHub</p>
              </div>
              <div className="flex items-center justify-center gap-6 lg:flex-1 lg:justify-center">
                <Link
                  className="text-[#D9D9D9] transition-colors duration-200 hover:text-[#034AA6]"
                  href="/privacy"
                >
                  Privacy Policy
                </Link>
                <Link
                  className="text-[#D9D9D9] transition-colors duration-200 hover:text-[#034AA6]"
                  href="/terms"
                >
                  Terms of Use
                </Link>
              </div>
              <div className="flex items-center justify-center lg:flex-1 lg:justify-end">
                <p>Version 1.0</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
