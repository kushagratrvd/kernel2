"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  PlayIcon,
  Calendar03Icon,
  HourglassIcon,
  HelpCircleIcon,
  AwardIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

import { ModeToggle } from "@/components/ui/mode-toggle";

export default function ContestCoverPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const trpc = useTRPC();

  // Query contest details
  const { data, error, isLoading } = useQuery(trpc.contest.getByCode.queryOptions({ code }));

  // Mutations
  const joinMutation = useMutation(trpc.contest.join.mutationOptions());
  const startAttemptMutation = useMutation(trpc.contest.startAttempt.mutationOptions());

  // If already finished, redirect to results page
  useEffect(() => {
    if (data?.participation?.finishedAt) {
      router.push(`/contest/${code}/results`);
    }
  }, [data?.participation?.finishedAt, code, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-destructive/20 bg-destructive/5 p-8 shadow-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="mx-auto size-12 text-destructive" />
          <h2 className="text-2xl font-bold tracking-tight">Contest Not Found</h2>
          <p className="text-muted-foreground">
            {error?.message || "We couldn't find a contest with that code. Please make sure the code is correct."}
          </p>
          <Button onClick={() => router.push("/contest")} variant="outline" className="w-full gap-2">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back to code entry
          </Button>
        </div>
      </div>
    );
  }

  const { contest, participation } = data;

  if (participation?.finishedAt) {
    return null;
  }

  const handleStart = async () => {
    try {
      // 1. Join/register the contest if not already joined
      if (!participation) {
        await joinMutation.mutateAsync({ contestId: contest.id });
      }
      // 2. Start the attempt (saves startedAt timestamp)
      await startAttemptMutation.mutateAsync({ contestId: contest.id });
      // 3. Redirect to attempt page
      router.push(`/contest/${code}/attempt`);
    } catch (err) {
      console.error("Failed to start contest:", err);
    }
  };

  const isMutating = joinMutation.isPending || startAttemptMutation.isPending;

  return (
    <div className="relative flex min-h-screen flex-col justify-between">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/contest")} className="gap-2">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Back
        </Button>
        <div className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Contest Overview
        </div>
        <ModeToggle />
      </header>

      {/* Main card */}
      <main className="mx-auto my-auto w-full max-w-2xl px-6 py-12">
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl dark:bg-card/50">
          {/* Cover image if exists */}
          {contest.coverImageUrl && (
            <div className="relative h-48 w-full overflow-hidden">
              <img
                src={contest.coverImageUrl}
                alt={contest.title}
                className="h-full w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}

          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Code: {contest.code}
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight">{contest.title}</h1>
              {contest.description && (
                <p className="text-muted-foreground leading-relaxed">{contest.description}</p>
              )}
            </div>

            <Separator />

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={HourglassIcon} className="size-3.5" />
                  <span>Duration</span>
                </div>
                <p className="text-sm font-semibold">{contest.totalTime} mins</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={HelpCircleIcon} className="size-3.5" />
                  <span>Questions</span>
                </div>
                <p className="text-sm font-semibold">{contest.totalQuestions} items</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={AwardIcon} className="size-3.5" />
                  <span>Total Score</span>
                </div>
                <p className="text-sm font-semibold">{contest.totalScore} pts</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-3.5" />
                  <span>Deadline</span>
                </div>
                <p className="text-xs font-semibold">
                  {new Date(contest.endTime).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
                <h4 className="font-semibold text-foreground">Important Instructions:</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Ensure a stable internet connection before starting.</li>
                  <li>Once you click &ldquo;Start Contest&rdquo;, the timer will begin and cannot be paused.</li>
                  <li>You must submit your answers before the timer runs out.</li>
                </ul>
              </div>

              <Button onClick={handleStart} disabled={isMutating} size="lg" className="w-full gap-2 text-base font-semibold">
                {isMutating ? (
                  <>
                    <Spinner className="size-4" />
                    Preparing Contest...
                  </>
                ) : participation?.startedAt ? (
                  <>
                    <HugeiconsIcon icon={PlayIcon} className="size-4 fill-current" />
                    Resume Attempt
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={PlayIcon} className="size-4 fill-current" />
                    Start Contest
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-muted-foreground/60">
        Kernel Contest Platform &copy; 2026
      </footer>
    </div>
  );
}
