"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getUserRoles } from "@/lib/get-user-roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  KeyIcon,
  ArrowRight01Icon,
  Logout01Icon,
  AwardIcon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  Calendar03Icon,
  HelpCircleIcon,
  Task01Icon,
  DashboardSquare01Icon,
  CodeSquareIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { format } from "date-fns";

export default function ContestHubPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  // "Enter Code" modal state & input
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [contestCodeInput, setContestCodeInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const roles = getUserRoles(session?.user);
  const isStaff = roles.some((r) => r === "admin" || r === "creator" || r === "reviewer");

  // Fetch student's past contest participations
  const { data: pastContests, isLoading } = useQuery(
    trpc.contest.getStudentPastContests.queryOptions()
  );

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = contestCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setInputError("Please enter a valid contest code.");
      return;
    }
    setInputError(null);
    setIsCodeModalOpen(false);
    router.push(`/contest/${trimmed}`);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/signin");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/95 text-primary-foreground shadow-sm">
            <span className="text-sm font-bold">K</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Kernel
          </span>
          <Badge
            variant="outline"
            className="text-2xs font-bold uppercase tracking-wider border-border/60 bg-muted/40 text-muted-foreground"
          >
            Contest Hub
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Staff link to Dashboard if creator/admin */}
          {isStaff && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={DashboardSquare01Icon} className="size-4" />
              Staff Dashboard
            </Button>
          )}

          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/40 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{session?.user?.name || "Student"}</span>
          </div>

          <ModeToggle />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive"
          >
            <HugeiconsIcon icon={Logout01Icon} className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 space-y-8 w-full">
        {/* Hero Banner with Action Button */}
        <div className="rounded-3xl border border-border/40 bg-card p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Student Contests
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Track your past contest performances, review verified answers and source code, or enter an invitation code to attempt a live contest.
            </p>
          </div>

          <div className="shrink-0">
            <Button
              size="lg"
              onClick={() => {
                setContestCodeInput("");
                setInputError(null);
                setIsCodeModalOpen(true);
              }}
              className="w-full sm:w-auto rounded-2xl gap-2 font-bold shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <HugeiconsIcon icon={KeyIcon} className="size-4" />
              Enter Contest Code
            </Button>
          </div>
        </div>

        {/* Past Contests Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Task01Icon} className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">My Past Contests</h2>
            </div>
            {pastContests && (
              <span className="text-xs font-semibold text-muted-foreground">
                {pastContests.length} {pastContests.length === 1 ? "Contest" : "Contests"}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-8" />
            </div>
          ) : !pastContests || pastContests.length === 0 ? (
            /* Empty State */
            <div className="rounded-3xl border border-dashed border-border/50 bg-card/40 p-10 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <HugeiconsIcon icon={CodeSquareIcon} className="size-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-foreground">No Participated Contests Yet</h3>
                <p className="text-xs text-muted-foreground">
                  You have not attempted any contests yet. When you join a live contest using an invitation code, your submissions, scores, and solutions review will appear here.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCodeModalOpen(true)}
                  className="rounded-xl gap-1.5 text-xs font-semibold"
                >
                  <HugeiconsIcon icon={KeyIcon} className="size-3.5" />
                  Enter Contest Code
                </Button>
              </div>
            </div>
          ) : (
            /* Grid of Past Participated Contests */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pastContests.map((c) => {
                const isConcluded = c.status === "concluded";
                const isPending = c.status === "results_pending";
                const isInProgress = c.status === "in_progress";

                return (
                  <div
                    key={c.participationId}
                    className="rounded-3xl border border-border/40 bg-card p-5 shadow-xs hover:border-border/70 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Top Row: Code Badge & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-xl bg-muted/80 text-foreground border border-border/40 uppercase">
                        {c.contestCode}
                      </span>

                      {isConcluded ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
                          Rank #{c.rank ?? "-"} • {c.score} pts
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <HugeiconsIcon icon={HourglassIcon} className="size-3" />
                          Results Pending
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                          <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                          Unfinished
                        </span>
                      )}
                    </div>

                    {/* Middle: Title & Meta */}
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-bold text-base text-foreground line-clamp-1" title={c.contestTitle}>
                          {c.contestTitle}
                        </h3>
                        {c.contestDescription && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {c.contestDescription}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-border/30 grid grid-cols-2 gap-2 text-2xs text-muted-foreground font-medium">
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={HelpCircleIcon} className="size-3.5 text-muted-foreground" />
                          <span>{c.totalQuestions} Questions</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={AwardIcon} className="size-3.5 text-muted-foreground" />
                          <span>{c.totalScore} Total pts</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 text-muted-foreground" />
                          <span>Attempted: {format(new Date(c.joinedAt), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-border/30">
                      {isConcluded ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/contest/${c.contestCode}/results`)}
                            className="rounded-xl text-xs font-semibold h-8"
                          >
                            Scorecard
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/contest/${c.contestCode}/review`)}
                            className="rounded-xl text-xs font-semibold h-8 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            Review
                            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                          </Button>
                        </div>
                      ) : isPending ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/contest/${c.contestCode}/results`)}
                          className="w-full rounded-xl text-xs font-semibold h-8 gap-1.5"
                        >
                          View Holding Status
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                        </Button>
                      ) : isInProgress ? (
                        <Button
                          size="sm"
                          onClick={() => router.push(`/contest/${c.contestCode}/attempt`)}
                          className="w-full rounded-xl text-xs font-semibold h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        >
                          <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                          Resume Attempt
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/contest/${c.contestCode}/results`)}
                          className="w-full rounded-xl text-xs font-semibold h-8"
                        >
                          View Summary
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Enter Contest Code Modal */}
      <Dialog open={isCodeModalOpen} onOpenChange={setIsCodeModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-2 text-center items-center">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
              <HugeiconsIcon icon={KeyIcon} className="size-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Enter Contest Code
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground max-w-xs">
              Type the code provided by your instructor or institution to join the live contest.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleJoinByCode} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="modal-code" className="sr-only">
                Contest Code
              </Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={KeyIcon}
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  id="modal-code"
                  placeholder="e.g. KRN101"
                  value={contestCodeInput}
                  onChange={(e) => {
                    setContestCodeInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  className="pl-10 text-center text-lg font-mono tracking-wider uppercase h-11 rounded-2xl"
                  autoFocus
                  maxLength={10}
                />
              </div>
              {inputError && (
                <p className="text-xs text-destructive text-center font-medium">
                  {inputError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-2xl gap-2 font-bold shadow-sm"
              disabled={!contestCodeInput.trim()}
            >
              Proceed to Contest
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
