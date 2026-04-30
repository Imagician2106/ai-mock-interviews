import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, CalendarDays, Star } from "lucide-react";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";

import { cn, getCompanyLogo } from "@/lib/utils";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";

const InterviewCard = async ({
  interviewId,
  userId,
  role,
  type,
  techstack,
  createdAt,
  company,
}: InterviewCardProps) => {
  const feedback =
    userId && interviewId
      ? await getFeedbackByInterviewId({
          interviewId,
          userId,
        })
      : null;

  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const badgeColor =
    {
      Behavioral: "bg-light-400",
      Mixed: "bg-light-600",
      Technical: "bg-light-800",
      "System Design": "bg-[#2d1f54]",
    }[normalizedType] || "bg-light-600";

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");

  return (
    <div className="interview-card-shell">
      <div className="card-interview">
        <div>
          <div
            className={cn(
              "absolute top-4 right-4 w-fit px-3 py-1.5 rounded-full border border-white/10",
              badgeColor
            )}
          >
            <p className="badge-text">{normalizedType}</p>
          </div>

          <div className="company-orb">
            <Image
              src={getCompanyLogo(company)}
              alt={company ? `${company} logo` : "company logo"}
              width={76}
              height={76}
              className="rounded-full object-contain size-[76px] bg-white p-3"
            />
          </div>

          <h3 className="mt-5 capitalize">{role} Interview</h3>

          {company && company !== "Other" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a1c3a] text-primary-200 text-xs font-semibold border border-primary-200/20">
                {company}
              </span>
            </div>
          )}

          <div className="card-meta-row">
            <div className="card-meta">
              <CalendarDays className="size-4" />
              <p>{formattedDate}</p>
            </div>

            <div className="card-meta">
              <Star className="size-4" />
              <p>{feedback?.totalScore || "---"}/100</p>
            </div>
          </div>

          <p className="line-clamp-2 mt-5">
            {feedback?.finalAssessment ||
              "You haven't taken this interview yet. Take it now to improve your skills."}
          </p>
        </div>

        <div className="flex flex-row justify-between items-center gap-4">
          <DisplayTechIcons techStack={techstack} />

          <Button className="btn-primary">
            <Link
              href={
                feedback
                  ? `/interview/${interviewId}/feedback`
                  : `/interview/${interviewId}`
              }
            >
              {feedback ? "Check Feedback" : "View Interview"}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InterviewCard;
