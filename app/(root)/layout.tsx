import { ReactNode } from "react";
import { redirect } from "next/navigation";

import AppHeader from "@/components/AppHeader";
import { isAuthenticated } from "@/lib/actions/auth.action";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Layout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");
  const user = await getCurrentUser();

  return (
    <div className="app-frame">
      <div className="ambient-grid" />
      <div className="root-layout">
        <AppHeader userName={user?.name} />
        {children}
      </div>
    </div>
  );
};

export default Layout;
