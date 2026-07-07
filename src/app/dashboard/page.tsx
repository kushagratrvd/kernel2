"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Logout01Icon,
  DashboardSquare01Icon,
  AddCircleIcon,
  BookOpen01Icon,
  UserGroupIcon,
  ActivityIcon,
  ArrowRight01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

export default function DashboardPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: isSessionLoading } = authClient.useSession();

  // Load contests using tRPC
  const { data: contests, isLoading: isContestsLoading, error } = useQuery(
    trpc.contest.listAll.queryOptions(),
  );

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/signin");
  };

  const isLoading = isSessionLoading || isContestsLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  // Quick stats
  const activeContestsCount = contests?.filter((c) => c.isActive).length || 0;
  const totalQuestionsCount = contests?.reduce((sum, c) => sum + c.totalQuestions, 0) || 0;

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
          <Button 
            onClick={() => router.push("/dashboard/contests/new")}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-2xl"
          >
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
                Active Contests
              </p>
              <h3 className="text-2xl font-black mt-1">{activeContestsCount} Active</h3>
            </div>
          </div>

          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-1/10 text-chart-1">
              <HugeiconsIcon icon={UserGroupIcon} className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Questions
              </p>
              <h3 className="text-2xl font-black mt-1">{totalQuestionsCount} Problems</h3>
            </div>
          </div>

          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/10 text-chart-3">
              <HugeiconsIcon icon={ActivityIcon} className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Contests
              </p>
              <h3 className="text-2xl font-black mt-1">{contests?.length || 0} Created</h3>
            </div>
          </div>
        </div>

        {/* Contests List */}
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={DashboardSquare01Icon} className="size-5" />
            </div>
            <h3 className="text-lg font-bold">Manage Contests</h3>
          </div>

          {contests && contests.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/30">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30 font-semibold text-muted-foreground">
                    <th className="p-4">Contest Info</th>
                    <th className="p-4">Contest Code</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Questions</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {contests.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{c.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{c.description || "No description"}</div>
                      </td>
                      <td className="p-4">
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono font-bold text-primary">
                          {c.code}
                        </code>
                      </td>
                      <td className="p-4 text-muted-foreground">{c.totalTime} mins</td>
                      <td className="p-4 text-muted-foreground">{c.totalQuestions}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.isActive 
                            ? "bg-green-500/10 text-green-500" 
                            : "bg-yellow-500/10 text-yellow-500"
                        }`}>
                          {c.isActive ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                              Active
                            </>
                          ) : (
                            "Inactive"
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          onClick={() => router.push(`/dashboard/contests/${c.id}`)}
                          variant="ghost" 
                          size="sm"
                          className="gap-1 group-hover:text-primary transition-colors rounded-xl"
                        >
                          Manage
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl p-12 text-center space-y-4">
              <p className="text-muted-foreground text-sm">No contests created yet.</p>
              <Button 
                onClick={() => router.push("/dashboard/contests/new")}
                size="sm" 
                className="rounded-xl"
              >
                Create your first contest
              </Button>
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground/60 border-t border-border/40">
        Kernel Contest Platform &copy; 2026
      </footer>
    </div>
  );
}
