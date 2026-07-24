"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  AddCircleIcon,
  Edit01Icon,
  Delete02Icon,
  CalendarIcon,
  HourglassIcon,
  StarIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

import { ModeToggle } from "@/components/ui/mode-toggle";

export default function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;

  const { data: contestData, isLoading, error, refetch } = useQuery(
    trpc.contest.getForEdit.queryOptions({ id: contestId }),
  );

  const deleteQuestionMutation = useMutation(
    trpc.contest.deleteQuestion.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const handleDeleteQuestion = async (qId: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      try {
        await deleteQuestionMutation.mutateAsync({ id: qId });
      } catch (err) {
        console.error("Failed to delete question:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !contestData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <HugeiconsIcon icon={AlertCircleIcon} className="size-12 text-destructive animate-bounce" />
        <h2 className="text-xl font-bold mt-4">Contest Not Found</h2>
        <Button onClick={() => router.push("/dashboard")} className="mt-4 rounded-xl">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => router.push("/dashboard")} 
            variant="ghost" 
            size="sm" 
            className="gap-1 rounded-xl"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back
          </Button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Manage Contest
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle />
        </div>
      </header>

      {/* Workspace */}
      <main className="flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
        {/* Contest Summary Box */}
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">{contestData.title}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  contestData.isActive 
                    ? "bg-green-500/10 text-green-500" 
                    : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {contestData.isActive ? "Published" : "Draft"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">{contestData.description || "No description provided."}</p>
            </div>
             <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => router.push(`/dashboard/contests/${contestId}/edit`)}
                variant="outline"
                className="gap-2 rounded-2xl"
              >
                <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                Edit Settings
              </Button>
              <Button 
                onClick={() => router.push(`/dashboard/contests/${contestId}/questions/new`)}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-2xl"
              >
                <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                Add Question
              </Button>
            </div>
          </div>

          <Separator />

          {/* Details Metadata grid */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <code className="text-sm font-mono font-bold">{contestData.code}</code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Contest Code</p>
                <p className="text-sm font-bold text-foreground">Code</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={HourglassIcon} className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Duration</p>
                <p className="text-sm font-bold text-foreground">{contestData.totalTime} Minutes</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={StarIcon} className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Score</p>
                <p className="text-sm font-bold text-foreground">{contestData.totalScore} pts</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={CalendarIcon} className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Start Date</p>
                <p className="text-sm font-bold text-foreground truncate max-w-[150px]">
                  {new Date(contestData.startTime).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Questions Manager */}
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
          <h2 className="text-xl font-black">Contest Questions</h2>

          {contestData.questions && contestData.questions.length > 0 ? (
            <div className="space-y-4">
              {contestData.questions.map((q, idx) => (
                <div 
                  key={q.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl border border-border/40 bg-card hover:bg-muted/10 transition-colors gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Q{idx + 1}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${
                        q.questionType === "code" 
                          ? "bg-blue-500/10 text-blue-500" 
                          : q.questionType === "mcq"
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-orange-500/10 text-orange-500"
                      }`}>
                        {q.questionType.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">({q.questionScore} pts)</span>
                    </div>
                    <p className="text-base font-semibold text-foreground line-clamp-1">{q.questionText}</p>
                    {q.questionType === "code" && (
                      <p className="text-xs text-muted-foreground">
                        Test Cases: {q.testCases?.length || 0} configured
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      onClick={() => router.push(`/dashboard/contests/${contestId}/questions/${q.id}`)}
                      variant="outline" 
                      size="sm"
                      className="gap-1.5 rounded-xl border-border/60"
                    >
                      <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                      Edit
                    </Button>
                    <Button 
                      onClick={() => handleDeleteQuestion(q.id)}
                      disabled={deleteQuestionMutation.isPending}
                      variant="destructive" 
                      size="sm"
                      className="gap-1.5 rounded-xl bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20"
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl p-12 text-center space-y-4">
              <p className="text-muted-foreground text-sm">No questions added to this contest yet.</p>
              <Button 
                onClick={() => router.push(`/dashboard/contests/${contestId}/questions/new`)}
                size="sm" 
                className="rounded-xl"
              >
                Add your first question
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
