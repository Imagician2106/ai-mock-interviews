"use client";

import { ReactNode, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import AppHeader from "@/components/AppHeader";

const Layout = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push("/sign-in");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="app-frame">
      <div className="ambient-grid" />
      <div className="root-layout">
        <AppHeader userName={user?.displayName || "User"} />
        {children}
      </div>
    </div>
  );
};

export default Layout;