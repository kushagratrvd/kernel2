"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Logout01Icon,
  DashboardSquare01Icon,
  AddCircleIcon,
  BookOpen01Icon,
  UserGroupIcon,
  ActivityIcon,
} from "@hugeicons/core-free-icons";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/signin");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/95 text-primary-foreground shadow-sm">
            <span className="text-sm font-bold">K</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Kernel Console
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Admin: {session?.user?.name || "Organizer"}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
            <HugeiconsIcon icon={Logout01Icon} className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        {/* Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Create contests, manage questions, and review student performance.
            </p>
          </div>
          <Button className="gap-2 bg-primary text-primary-foreground">
            <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
            Create Contest
          </Button>
        </div>

        <Separator />

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={BookOpen01Icon} className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Contests
              </p>
              <h3 className="text-2xl font-black mt-1">1 Active</h3>
            </div>
          </div>

          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-1/10 text-chart-1">
              <HugeiconsIcon icon={UserGroupIcon} className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Registered Students
              </p>
              <h3 className="text-2xl font-black mt-1">1 Total</h3>
            </div>
          </div>

          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/10 text-chart-3">
              <HugeiconsIcon icon={ActivityIcon} className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Submissions
              </p>
              <h3 className="text-2xl font-black mt-1">0 Pending</h3>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-sm backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={DashboardSquare01Icon} className="size-5" />
            </div>
            <h3 className="text-lg font-bold">Contest Creation Tool (Coming Soon)</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            In the next phase, you will be able to author custom programming or multiple-choice questions, set timings, configure test cases, and download submission reports in CSV format.
          </p>
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground/60 border-t border-border/40">
        Kernel Contest Platform &copy; 2026
      </footer>
    </div>
  );
}
