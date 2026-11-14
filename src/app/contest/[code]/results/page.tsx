"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ChampionIcon,
  AwardIcon,
  RankingIcon,
  Tick02Icon,
  HourglassIcon,
  CodeSquareIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { format } from "date-fns";

import { ModeToggle } from "@/components/ui/mode-toggle";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const trpc = useTRPC();

  // 1. Get contest to find contestId first
  const { data: contestData, isLoading: loadingContest } = useQuery(
    trpc.contest.getByCode.queryOptions({ code }));

  const contestId = contestData?.contest?.id;

  // 2. Fetch results using contestId (enabled only if contestId exists)
  const { data: results, isLoading: loadingResults, error } = useQuery(
    trpc.contest.getResults.queryOptions(
      { contestId: contestId as string },
      { enabled: !!contestId }
    ));

  if (loadingContest || loadingResults) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold">Failed to Load Results</h2>
        <p className="text-muted-foreground mt-2">
          {error?.message || "There was a problem retrieving your ranking."}
        </p>
        <Button onClick={() => router.push("/contest")} className="mt-4">
          Back to contest lobby
        </Button>
      </div>
    );
  }

  const { contest, participation, leaderboard, isEnded, attemptedCount, totalQuestions } = results;

  // Medal helper for leaderboard
  const getMedalColor = (rank: number) => {
    if (rank === 1) return "text-yellow-500 bg-yellow-500/10";
    if (rank === 2) return "text-zinc-400 bg-zinc-400/10";
    if (rank === 3) return "text-amber-600 bg-amber-600/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/contest")}
          className="gap-2"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Contest Lobby
        </Button>
        <div className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          {isEnded ? "Contest Finished" : "Attempt Submitted"}
        </div>
        <ModeToggle />
      </header>

      {/* Main content grid */}
      <main className="mx-auto my-auto grid w-full max-w-5xl gap-8 px-6 py-12 lg:grid-cols-5">
        {!isEnded ? (
          /* ── Holding State Screen (Contest still active) ── */
          <>
            <section className="space-y-6 lg:col-span-2">
              <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-2xl backdrop-blur-xl dark:bg-card/50 text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <HugeiconsIcon icon={HourglassIcon} className="size-8 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight">Attempt Submitted!</h1>
                  <p className="text-sm text-muted-foreground">
                    Your answers have been securely recorded.
                  </p>
                </div>

                <Separator />

                {/* Progress Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-muted/40 p-4 space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">
                      Questions Attempted
                    </span>
                    <p className="text-2xl font-extrabold text-foreground">
                      {attemptedCount}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {totalQuestions}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-1">
                    <span className="text-xs text-amber-500 uppercase font-semibold">
                      Contest Status
                    </span>
                    <p className="text-base font-bold text-amber-500 mt-1">
                      In Progress
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/30 border border-border/40 p-4 text-xs text-muted-foreground text-left space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-amber-500" />
                    <span>Scores & Rankings Locked</span>
                  </div>
                  <p className="leading-relaxed">
                    Official scores, rankings, and solution reviews will be published once the contest officially concludes.
                  </p>
                  {contest.endTime && (
                    <p className="text-foreground font-medium pt-1">
                      Contest Concludes: {format(new Date(contest.endTime), "PPP 'at' p")}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-foreground/5 border border-foreground/10 p-4 text-xs text-foreground space-y-1">
                  <div className="flex items-center gap-1.5 justify-center font-semibold">
                    <HugeiconsIcon icon={Tick02Icon} className="size-4 text-foreground" />
                    <span>Submitted Successfully</span>
                  </div>
                  <p className="text-muted-foreground text-center">
                    Finished at: {new Date(participation.finishedAt!).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 lg:col-span-3">
              <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-2xl backdrop-blur-xl dark:bg-card/50 space-y-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{contest.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Time: {contest.totalTime} mins • Total Questions: {totalQuestions} • Total Points: {contest.totalScore}
                  </p>
                </div>

                <Separator />

                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Thank you for participating! To maintain strict exam fairness and prevent answer leaks while other students may still be competing, individual scores, rankings, and answer evaluations remain locked until the contest window closes.
                  </p>
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                    <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                      Post-Contest Review
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Once the contest concludes, return to this URL anytime to view your official ranking, total points, and launch the <strong>Submission Review Workspace</strong> to inspect your submitted answers and test diagnostics.
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => router.push("/contest")}
                    variant="outline"
                    className="w-full rounded-2xl h-11 font-semibold"
                  >
                    Back to Contest Lobby
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : (
          /* ── Concluded Contest Screen (Scores unlocked) ── */
          <>
            {/* Left side: User performance card */}
            <section className="space-y-6 lg:col-span-2">
              <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-2xl backdrop-blur-xl dark:bg-card/50 text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <HugeiconsIcon icon={ChampionIcon} className="size-8" />
                </div>

                <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight">Congratulations!</h1>
                  <p className="text-sm text-muted-foreground">
                    You successfully completed the contest.
                  </p>
                </div>

                <Separator />

                {/* Performance Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-muted/40 p-4 space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">
                      Your Score
                    </span>
                    <p className="text-2xl font-extrabold text-foreground">
                      {participation.score ?? 0}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {contest.totalScore}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted/40 p-4 space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">
                      Your Rank
                    </span>
                    <p className="text-2xl font-extrabold text-primary">
                      #{participation.rank || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-foreground/5 border border-foreground/10 p-4 text-xs text-foreground space-y-1">
                  <div className="flex items-center gap-1.5 justify-center font-semibold">
                    <HugeiconsIcon icon={Tick02Icon} className="size-4 text-foreground" />
                    <span>Submitted Successfully</span>
                  </div>
                  <p className="text-muted-foreground text-center">
                    Finished at: {new Date(participation.finishedAt!).toLocaleTimeString()}
                  </p>
                </div>

                {/* Review My Submissions Action Button */}
                <Button
                  onClick={() => router.push(`/contest/${code}/review`)}
                  className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2 hover:bg-primary/90 transition-all text-sm"
                >
                  <HugeiconsIcon icon={CodeSquareIcon} className="size-4" />
                  Review My Submissions
                </Button>
              </div>
            </section>

            {/* Right side: Leaderboard / Rankings */}
            <section className="space-y-4 lg:col-span-3">
              <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-2xl backdrop-blur-xl dark:bg-card/50 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <HugeiconsIcon icon={RankingIcon} className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Leaderboard</h2>
                    <p className="text-xs text-muted-foreground">Top participants of this contest</p>
                  </div>
                </div>

                <Separator />

                {/* Leaderboard Table */}
                <div className="space-y-2">
                  {leaderboard.length > 0 ? (
                    leaderboard.map((item, idx) => {
                      const rank = idx + 1;
                      const isCurrentUser = item.userId === participation.userId;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                            isCurrentUser
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border/40 bg-muted/20"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Rank Badge */}
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${getMedalColor(
                                rank
                              )}`}
                            >
                              {rank}
                            </div>
                            {/* User Info */}
                            <div>
                              <p className="text-sm font-semibold leading-none">
                                {item.user?.name || "Anonymous Student"}
                                {isCurrentUser && (
                                  <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.user?.email}
                              </p>
                            </div>
                          </div>

                          {/* Score */}
                          <span className="text-sm font-extrabold text-foreground">
                            {item.score} pts
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No submissions yet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground/60">
        Kernel Contest Platform &copy; 2026
      </footer>
    </div>
  );
}
