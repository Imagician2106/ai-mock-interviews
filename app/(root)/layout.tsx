import { ReactNode } from "react";
import { redirect } from "next/navigation";

import AppHeader from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Layout = async ({ children }: { children: ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="app-frame">
      <div className="ambient-grid" />
      <div className="root-layout">
        <AppHeader userName={user.name} />
        {children}
      </div>
    </div>
  );
};

export default Layout;
