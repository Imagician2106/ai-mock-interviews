import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BrainCircuit, Mic2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";
import { redirect } from "next/navigation";

async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [userInterviews, allInterview] = await Promise.all([
    getInterviewsByUserId(user.id),
    getLatestInterviews({ userId: user.id }),
  ]);

  const hasPastInterviews = (userInterviews?.length ?? 0) > 0;
  const hasUpcomingInterviews = (allInterview?.length ?? 0) > 0;
  const completedCount = userInterviews?.length ?? 0;
  const availableCount = allInterview?.length ?? 0;
  const uniqueTech = new Set(
    [...(userInterviews ?? []), ...(allInterview ?? [])].flatMap(
      (interview) => interview.techstack ?? []
    )
  ).size;

  return (
    <>
      <section className="dashboard-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            AI interview studio
          </div>
          <h1>Practice like the interview is already on your calendar.</h1>
          <p>
            Build targeted mock interviews, answer with voice or text, and turn
            every session into a sharper next attempt.
          </p>

          <Button asChild className="hero-action max-sm:w-full">
            <Link href="/interview">
              Start an Interview <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="hero-stage" aria-hidden="true">
          <div className="pulse-ring pulse-ring-one" />
          <div className="pulse-ring pulse-ring-two" />
          <Image
            src="/robot.png"
            alt=""
            width={390}
            height={390}
            priority
            className="hero-robot"
          />
          <div className="floating-card floating-card-top">
            <Mic2 className="size-5" />
            <span>Voice ready</span>
          </div>
          <div className="floating-card floating-card-bottom">
            <BrainCircuit className="size-5" />
            <span>Adaptive prompts</span>
          </div>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Interview summary">
        <div className="metric-tile">
          <span>Completed</span>
          <strong>{completedCount}</strong>
          <small>Practice sessions saved</small>
        </div>
        <div className="metric-tile">
          <span>Available</span>
          <strong>{availableCount}</strong>
          <small>Fresh interviews waiting</small>
        </div>
        <div className="metric-tile metric-tile-accent">
          <span>Tech coverage</span>
          <strong>{uniqueTech}</strong>
          <small>Skills across your deck</small>
        </div>
        <div className="metric-tile">
          <span>Momentum</span>
          <strong>
            <TrendingUp className="size-7" />
          </strong>
          <small>Keep the streak warm</small>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <span className="section-kicker">Replay and improve</span>
            <h2>Your Interviews</h2>
          </div>
          <Link href="/interview" className="text-link">
            Build another <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="interviews-section">
          {hasPastInterviews ? (
            userInterviews?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                company={interview.company}
              />
            ))
          ) : (
            <div className="empty-state">
              <BrainCircuit className="size-8" />
              <p>You haven&apos;t taken any interviews yet.</p>
              <Link href="/interview">Create your first session</Link>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <span className="section-kicker">Choose a challenge</span>
            <h2>Take Interviews</h2>
          </div>
        </div>

        <div className="interviews-section">
          {hasUpcomingInterviews ? (
            allInterview?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                company={interview.company}
              />
            ))
          ) : (
            <div className="empty-state">
              <Mic2 className="size-8" />
              <p>There are no interviews available.</p>
              <Link href="/interview">Generate one now</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;
