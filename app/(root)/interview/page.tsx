import InterviewSetupForm from "@/components/InterviewSetupForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <div className="page-heading">
        <span className="section-kicker">Custom generator</span>
        <h1>Create Your Interview</h1>
        <p className="text-lg">
          Customize your mock interview experience by selecting the company,
          technologies, and role details below.
        </p>
      </div>

      <InterviewSetupForm userId={user.id} />
    </>
  );
};

export default Page;
