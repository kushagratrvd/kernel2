"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FileQuestionMarkIcon,
  Task01Icon,
  Comment01Icon,
  HourglassIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

import { ModeToggle } from "@/components/ui/mode-toggle";

function getUserRoles(user: any): string[] {
  if (Array.isArray(user?.roles)) return user.roles;
  if (typeof user?.roles === "string") {
    try {
      const parsed = JSON.parse(user.roles);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [user.roles];
    }
  }
  if (user?.role && typeof user.role === "string") return [user.role];
  return ["student"];
}

export default function DashboardPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "reviews" | "contests">("overview");

  const roles = getUserRoles(session?.user);
  const isCreator = roles.includes("creator") || roles.includes("admin");
  const isReviewer = roles.includes("reviewer") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  // Load contests
  const { data: contests, isLoading: isContestsLoading } = useQuery(
    trpc.contest.listAll.queryOptions(),
  );

  // Load creator questions if creator
  const { data: myQuestions, isLoading: isQuestionsLoading } = useQuery({
    ...trpc.questionBank.listMyQuestions.queryOptions({}),
    enabled: isCreator,
  });

  // Load assigned reviews if reviewer
  const { data: assignedReviews, isLoading: isReviewsLoading } = useQuery({
    ...trpc.questionBank.listAssigned.queryOptions({}),
    enabled: isReviewer,
  });

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
  const myDraftsCount = myQuestions?.filter((q) => q.status === "DRAFT").length || 0;
  const myPendingReviewCount = myQuestions?.filter((q) => q.status === "SUBMITTED_FOR_REVIEW" || q.status === "UNDER_REVIEW").length || 0;
  const myChangesRequestedCount = myQuestions?.filter((q) => q.status === "CHANGES_REQUESTED").length || 0;
  const myApprovedCount = myQuestions?.filter((q) => q.status === "APPROVED").length || 0;

  const pendingAssignedReviewsCount = assignedReviews?.filter((r) => r.status === "PENDING").length || 0;
  const inReviewCount = assignedReviews?.filter((r) => r.status === "IN_REVIEW").length || 0;

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
            Kernel Platform
          </span>

          <div className="hidden sm:flex items-center gap-1.5 ml-3">
            {roles.map((r) => (
              <Badge
                key={r}
                variant="outline"
                className={`text-2xs font-bold uppercase tracking-wider ${
                  r === "admin"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                    : r === "creator"
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-500"
                    : r === "reviewer"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
                    : "border-border/60 bg-muted/40 text-muted-foreground"
                }`}
              >
                {r}
              </Badge>
            ))}
          </div>
        </div>

        {/* Global Navigation Links */}
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-semibold">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-background text-foreground shadow-sm"
            >
              Dashboard
            </Link>
            {isCreator && (
              <Link
                href="/dashboard/questions"
                className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Question Studio
              </Link>
            )}
            {isReviewer && (
              <Link
                href="/dashboard/reviews"
                className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Review Desk
                {pendingAssignedReviewsCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-2xs px-1.5 py-0.2">
                    {pendingAssignedReviewsCount}
                  </span>
                )}
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/dashboard/admin/users"
                className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Users & Roles
              </Link>
            )}
          </nav>

          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
            {session?.user?.name || "User"}
          </span>
          <ModeToggle />
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
            <h1 className="text-3xl font-extrabold tracking-tight">
              {isAdmin
                ? "Admin & Operations Center"
                : isCreator && isReviewer
                ? "Creator & Reviewer Workspace"
                : isCreator
                ? "Question Creator Studio"
                : "Reviewer Desk"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isCreator && isReviewer
                ? "Design and draft questions, submit for peer review, and inspect assigned verification tasks."
                : isCreator
                ? "Draft questions with options, hints, test cases, and submit them for reviewer verification."
                : isReviewer
                ? "Review questions, request corrections with feedback, and approve verified questions into the bank."
                : "Manage contests, oversee question life-cycles, and administer user privileges."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isCreator && (
              <Button
                onClick={() => router.push("/dashboard/questions?action=new")}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-sm"
              >
                <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                New Question
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => router.push("/dashboard/contests/new")}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-sm"
              >
                <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                Create Contest
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Creator stats */}
          {isCreator && (
            <>
              <div
                onClick={() => router.push("/dashboard/questions?tab=DRAFT")}
                className="cursor-pointer rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4 hover:border-purple-500/40 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-105 transition-transform">
                  <HugeiconsIcon icon={FileQuestionMarkIcon} className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    My Working Drafts
                  </p>
                  <h3 className="text-2xl font-black mt-1 text-purple-500">
                    {myDraftsCount} Drafts
                  </h3>
                </div>
              </div>

              <div
                onClick={() => router.push("/dashboard/questions?tab=APPROVED")}
                className="cursor-pointer rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4 hover:border-green-500/40 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500 group-hover:scale-105 transition-transform">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Verified Questions
                  </p>
                  <h3 className="text-2xl font-black mt-1 text-green-500">
                    {myApprovedCount} Approved
                  </h3>
                </div>
              </div>
            </>
          )}

          {/* Reviewer stats */}
          {isReviewer && (
            <div
              onClick={() => router.push("/dashboard/reviews")}
              className="cursor-pointer rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4 hover:border-blue-500/40 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
                <HugeiconsIcon icon={Task01Icon} className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending Reviews
                </p>
                <h3 className="text-2xl font-black mt-1 text-blue-500">
                  {pendingAssignedReviewsCount} In Queue
                </h3>
              </div>
            </div>
          )}

          {/* Contest stats */}
          <div
            onClick={() => router.push("/dashboard")}
            className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={BookOpen01Icon} className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Contests
              </p>
              <h3 className="text-2xl font-black mt-1">{activeContestsCount} Live</h3>
            </div>
          </div>
        </div>

        {/* Creator Section: Recent Questions */}
        {isCreator && (
          <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <HugeiconsIcon icon={FileQuestionMarkIcon} className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">My Question Bank Studio</h3>
                  <p className="text-xs text-muted-foreground">
                    Manage drafts, submit for reviewer verification, and monitor approval status
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/questions")}
                className="gap-1 rounded-xl text-xs font-semibold"
              >
                View Full Studio
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Button>
            </div>

            {myQuestions && myQuestions.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/30">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30 font-semibold text-muted-foreground">
                      <th className="p-4">Question Title</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Category / Topic</th>
                      <th className="p-4">Difficulty</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {myQuestions.slice(0, 5).map((q) => {
                      const draft = q.currentDraft as any;
                      return (
                        <tr key={q.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4 font-semibold text-foreground">
                            {draft?.title || "Untitled Question"}
                          </td>
                          <td className="p-4">
                            <span className="uppercase text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                              {q.questionType}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-muted-foreground">
                            {q.category?.name || "General"} {q.topic?.name ? `• ${q.topic.name}` : ""}
                          </td>
                          <td className="p-4">
                            <span className={`text-2xs font-bold capitalize px-2 py-0.5 rounded-full ${
                              q.difficulty === "easy"
                                ? "bg-green-500/10 text-green-500"
                                : q.difficulty === "medium"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-red-500/10 text-red-500"
                            }`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="outline"
                              className={`text-2xs font-bold uppercase ${
                                q.status === "APPROVED"
                                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                                  : q.status === "DRAFT"
                                  ? "bg-muted text-muted-foreground"
                                  : q.status === "CHANGES_REQUESTED"
                                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                  : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              }`}
                            >
                              {q.status.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              onClick={() => router.push(`/dashboard/questions?id=${q.id}`)}
                              variant="ghost"
                              size="sm"
                              className="rounded-xl text-xs"
                            >
                              Open Studio
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl p-10 text-center space-y-3">
                <p className="text-muted-foreground text-sm">No questions created in your bank yet.</p>
                <Button
                  onClick={() => router.push("/dashboard/questions?action=new")}
                  size="sm"
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Create Your First Question
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Reviewer Section: Assigned Reviews */}
        {isReviewer && (
          <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <HugeiconsIcon icon={Task01Icon} className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Assigned Review Desk</h3>
                  <p className="text-xs text-muted-foreground">
                    Verify submitted questions, test edge cases, and provide review feedback
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/reviews")}
                className="gap-1 rounded-xl text-xs font-semibold"
              >
                Open Review Desk
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Button>
            </div>

            {assignedReviews && assignedReviews.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/30">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30 font-semibold text-muted-foreground">
                      <th className="p-4">Question Title</th>
                      <th className="p-4">Version</th>
                      <th className="p-4">Creator</th>
                      <th className="p-4">Review Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {assignedReviews.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 font-semibold text-foreground">
                          {a.version?.title || "Question Snapshot"}
                        </td>
                        <td className="p-4">
                          <code className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                            v{a.version?.version || 1}
                          </code>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {a.assignedBy?.name || a.assignedBy?.email}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={`text-2xs font-bold uppercase ${
                              a.status === "IN_REVIEW"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                                : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                            }`}
                          >
                            {a.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            onClick={() => router.push(`/dashboard/reviews?assignmentId=${a.id}`)}
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-xs text-blue-500 hover:text-blue-600"
                          >
                            Review Now
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl p-10 text-center space-y-2">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">Your review queue is clear. No pending reviews!</p>
              </div>
            )}
          </div>
        )}

        {/* Contests List */}
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={DashboardSquare01Icon} className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Contests Overview</h3>
                <p className="text-xs text-muted-foreground">Active and scheduled contests</p>
              </div>
            </div>

            {isAdmin && (
              <Button
                onClick={() => router.push("/dashboard/contests/new")}
                size="sm"
                className="rounded-xl text-xs"
              >
                + Add Contest
              </Button>
            )}
          </div>

          {contests && contests.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/30">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30 font-semibold text-muted-foreground">
                    <th className="p-4">Contest Info</th>
                    <th className="p-4">Code</th>
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
                          onClick={() => router.push(isAdmin ? `/dashboard/contests/${c.id}` : `/contest/${c.code}`)}
                          variant="ghost" 
                          size="sm"
                          className="gap-1 group-hover:text-primary transition-colors rounded-xl"
                        >
                          {isAdmin ? "Manage" : "View"}
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
              {isAdmin && (
                <Button 
                  onClick={() => router.push("/dashboard/contests/new")}
                  size="sm" 
                  className="rounded-xl"
                >
                  Create your first contest
                </Button>
              )}
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
