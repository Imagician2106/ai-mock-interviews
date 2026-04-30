import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });
  const score = feedback?.totalScore ?? 0;

  return (
    <section className="section-feedback">
      <div className="feedback-hero">
        <div>
          <span className="section-kicker">Performance report</span>
          <h1>
            <span className="capitalize">{interview.role}</span> Interview
          </h1>
          <p>{feedback?.finalAssessment}</p>
        </div>

        <div className="score-orbit" style={{ "--score": `${score}%` } as CSSProperties}>
          <div>
            <strong>{score}</strong>
            <span>/100</span>
          </div>
        </div>
      </div>

      <div className="feedback-meta">
        <div className="flex flex-row gap-2">
          <Image src="/calendar.svg" width={22} height={22} alt="calendar" />
          <p>
            {feedback?.createdAt
              ? dayjs(feedback.createdAt).format("MMM D, YYYY h:mm A")
              : "N/A"}
          </p>
        </div>
        <div className="flex flex-row gap-2 items-center">
          <Sparkles className="size-5 text-primary-200" />
          <p>{interview.type} interview</p>
        </div>
      </div>

      <div className="feedback-breakdown">
        <h2>Breakdown</h2>
        {feedback?.categoryScores?.map((category, index) => (
          <div key={index} className="score-row">
            <div className="score-row-header">
              <p className="font-bold">{category.name}</p>
              <span>{category.score}/100</span>
            </div>
            <div className="score-track">
              <span style={{ width: `${category.score}%` }} />
            </div>
            <p>{category.comment}</p>
          </div>
        ))}
      </div>

      <div className="feedback-columns">
      <div className="feedback-list">
        <h3>Strengths</h3>
        <ul>
          {feedback?.strengths?.map((strength, index) => (
            <li key={index}>{strength}</li>
          ))}
        </ul>
      </div>

      <div className="feedback-list">
        <h3>Areas for Improvement</h3>
        <ul>
          {feedback?.areasForImprovement?.map((area, index) => (
            <li key={index}>{area}</li>
          ))}
        </ul>
      </div>
      </div>

      <div className="buttons">
        <Button className="btn-secondary flex-1">
          <Link href="/" className="flex w-full justify-center">
            <ArrowLeft className="size-4" />
            <span className="text-sm font-semibold text-primary-200 text-center">
              Back to dashboard
            </span>
          </Link>
        </Button>

        <Button className="btn-primary flex-1">
          <Link
            href={`/interview/${id}`}
            className="flex w-full justify-center"
          >
            <RotateCcw className="size-4" />
            <span className="text-sm font-semibold text-black text-center">
              Retake Interview
            </span>
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default Feedback;
