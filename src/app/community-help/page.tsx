import Link from "next/link";
import { MessageCircleQuestion, ArrowLeft, ShieldCheck } from "lucide-react";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import communityImage from "@/app/images/community/community.jpg";

const quickTips = [
  "Search for similar questions before posting.",
  "Share clear details so others can help quickly.",
  "Keep replies respectful and focused on solutions.",
];

export default function CommunityHelpPage() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-no-repeat py-16 lg:py-24"
      style={{ backgroundImage: `url(${communityImage.src})` }}
    >
      <Link
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primaryHover hover:shadow-shadowHover"
        href="/"
      >
        <ArrowLeft size={16} />
        Back to Main Page
      </Link>
      <Container size="6xl">
        <div className="rounded-3xl border border-gray-500/40 bg-gray-300/80 p-8 shadow-shadow md:p-12">
          <p className="text-xs uppercase tracking-[0.16em] text-text/60">
            Support Space
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Community Help
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-text/80">
            Ask questions, share guidance, and help others solve campus-related
            issues together.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Card accent className="bg-gray-100/90 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                  <MessageCircleQuestion size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-heading">
                    What you can do here
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-text/80">
                    <li>- Post your question and get help from the community.</li>
                    <li>- Share answers based on your campus experience.</li>
                    <li>- Build a helpful knowledge base for everyone.</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="bg-gray-100/90 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-heading">
                    Quick guidelines
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-text/80">
                    {quickTips.map((tip) => (
                      <li key={tip}>- {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">

            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-500/40 bg-gray-100/90 px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-gray-50"
              href="/report-problem"
            >
              Report a Problem
            </Link>

            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-500/40 bg-gray-100/90 px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-gray-50"
              href="/community"
            >
              Goto to Community
            </Link>

            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-500/40 bg-gray-100/90 px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-gray-50"
              href="/"
            >
              FAQ
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
