import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, LayoutDashboard, Sparkles } from "lucide-react";

const AppHeader = ({ userName }: { userName?: string }) => {
  return (
    <header className="app-header">
      <Link href="/" className="brand-lockup" aria-label="Intergini dashboard">
        <span className="brand-mark" aria-hidden="true">
          <Image src="/intergini-official.png" alt="" width={56} height={56} priority />
        </span>
        <span className="brand-copy">
          <span>Intergini</span>
          <small>Interview command center</small>
        </span>
      </Link>

      <nav className="app-nav" aria-label="Primary">
        <Link href="/" className="nav-pill">
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
        <Link href="/interview" className="nav-pill nav-pill-primary">
          <CalendarPlus className="size-4" />
          New interview
        </Link>
      </nav>

      <div className="user-chip" aria-label={userName ? `Signed in as ${userName}` : "Signed in"}>
        <Sparkles className="size-4" />
        <span>{userName || "Ready"}</span>
      </div>
    </header>
  );
};

export default AppHeader;
