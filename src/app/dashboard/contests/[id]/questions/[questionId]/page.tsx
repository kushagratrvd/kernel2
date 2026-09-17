"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  SaveIcon,
  AlertCircleIcon,
  CodeIcon,
  CheckmarkCircle02Icon,
  Edit01Icon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";
import Link from "next/link";

export default function EditContestQuestionPage({
  params,
}: {
  params: Promise<{ id: string; questionId: string }>;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;
  const targetId = resolvedParams.questionId;

  const { data: contestData, isLoading, error, refetch } = useQuery(
    trpc.contest.getForEdit.queryOptions({ id: contestId })
  );

  const updateQuestionMutation = useMutation(
    trpc.contest.updateQuestion.mutationOptions()
  );

  const targetQuestion = contestData?.questions?.find(
    (q) => q.id === targetId || q.questionId === targetId || q.contestQuestionId === targetId
  );

  const [marks, setMarks] = useState<number>(100);
  const [questionOrder, setQuestionOrder] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (targetQuestion) {
      setMarks(targetQuestion.marks ?? targetQuestion.questionScore ?? 100);
      setQuestionOrder(targetQuestion.questionOrder ?? 1);
    }
  }, [targetQuestion]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!targetQuestion) return;

    try {
      await updateQuestionMutation.mutateAsync({
        id: targetQuestion.contestQuestionId || targetQuestion.id,
        marks: Number(marks),
        questionOrder: Number(questionOrder),
      });

      setSuccessMsg("Question settings updated successfully!");
      refetch();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update question settings.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !targetQuestion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-4">
        <HugeiconsIcon icon={AlertCircleIcon} className="size-12 text-destructive" />
        <h2 className="text-xl font-bold">Question Not Found in Contest</h2>
        <Button
          onClick={() => router.push(`/dashboard/contests/${contestId}`)}
          className="rounded-xl"
        >
          Back to Contest
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
            onClick={() => router.push(`/dashboard/contests/${contestId}`)}
            variant="ghost"
            size="sm"
            className="gap-1 rounded-xl"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back to Contest
          </Button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Contest Question Configuration
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 max-w-3xl mx-auto w-full space-y-6">
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-xs backdrop-blur-md space-y-6">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Contest: {contestData?.title}
            </span>
            <h1 className="text-2xl font-black">Configure Question</h1>
            <p className="text-sm text-muted-foreground">
              Adjust marks and ordering for this question within the contest.
            </p>
          </div>

          <Separator />

          {errorMsg && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
              {successMsg}
            </div>
          )}

          {/* Read-Only Question Snapshot Details */}
          <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                    targetQuestion.questionType === "code"
                      ? "bg-blue-500/10 text-blue-500"
                      : targetQuestion.questionType === "mcq"
                      ? "bg-purple-500/10 text-purple-500"
                      : "bg-orange-500/10 text-orange-500"
                  }`}
                >
                  {targetQuestion.questionType === "code" ? (
                    <HugeiconsIcon icon={CodeIcon} className="size-3" />
                  ) : null}
                  {targetQuestion.questionType.toUpperCase()}
                </span>
                <span className="text-2xs text-muted-foreground font-mono">
                  Version {targetQuestion.version || 1} (Snapshot)
                </span>
              </div>

              <Link
                href="/dashboard/questions"
                className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <HugeiconsIcon icon={Edit01Icon} className="size-3" />
                View in Question Bank
              </Link>
            </div>

            <h3 className="text-lg font-bold text-foreground">
              {targetQuestion.title || targetQuestion.questionText}
            </h3>

            {targetQuestion.description && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {targetQuestion.description}
              </p>
            )}

            {/* MCQ Options preview */}
            {targetQuestion.questionType === "mcq" && targetQuestion.options && (
              <div className="space-y-1.5 pt-2">
                <p className="text-xs font-semibold text-muted-foreground">Options:</p>
                <div className="grid gap-1.5">
                  {targetQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className="text-xs bg-background/60 rounded-xl px-3 py-2 border border-border/30 text-foreground"
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contest Settings Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marks" className="text-sm font-semibold">
                  Contest Marks (Points) *
                </Label>
                <Input
                  id="marks"
                  type="number"
                  min={1}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  required
                  className="rounded-2xl bg-input/50 font-bold"
                />
                <p className="text-xs text-muted-foreground">
                  Points awarded for solving this question in this contest.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="questionOrder" className="text-sm font-semibold">
                  Question Position / Order *
                </Label>
                <Input
                  id="questionOrder"
                  type="number"
                  min={1}
                  value={questionOrder}
                  onChange={(e) => setQuestionOrder(Number(e.target.value))}
                  required
                  className="rounded-2xl bg-input/50 font-bold"
                />
                <p className="text-xs text-muted-foreground">
                  The sequential order shown to students during the contest.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/contests/${contestId}`)}
                className="rounded-2xl px-5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateQuestionMutation.isPending}
                className="rounded-2xl px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {updateQuestionMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <>
                    <HugeiconsIcon icon={SaveIcon} className="size-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
