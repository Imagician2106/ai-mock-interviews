import Image from "next/image";
import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import VoiceInterview from "@/components/VoiceInterview";
import { getCompanyLogo } from "@/lib/utils";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params }: RouteParams) => {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  return (
    <>
      <div className="interview-room-header">
        <div className="flex flex-row gap-4 items-center max-sm:flex-col max-sm:items-start">
          <div className="flex flex-row gap-4 items-center">
            <Image
              src={getCompanyLogo(interview.company)}
              alt={interview.company ? `${interview.company} logo` : "company logo"}
              width={40}
              height={40}
              className="rounded-full object-contain size-[40px] bg-white p-1"
            />
            <div>
              <span className="section-kicker">Live practice room</span>
              <h1 className="capitalize">{interview.role} Interview</h1>
            </div>
          </div>

          <DisplayTechIcons techStack={interview.techstack} />
        </div>

        <p className="room-type-pill">
          <BadgeCheck className="size-4" />
          {interview.type}
        </p>
      </div>

      <VoiceInterview
        userName={user.name}
        userId={user.id}
        interviewId={id}
        questions={interview.questions}
        feedbackId={feedback?.id}
      />
    </>
  );
};

export default InterviewDetails;
