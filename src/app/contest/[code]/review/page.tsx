"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import Editor from "@monaco-editor/react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  HelpCircleIcon,
  MinusSignIcon,
  CodeSquareIcon,
  Clock01Icon,
  AwardIcon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { getLanguageInfo } from "@/lib/language-map";
import { useTheme } from "next-themes";

export default function ContestReviewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const trpc = useTRPC();
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  // 1. Get contest to find contestId first
  const { data: contestData, isLoading: loadingContest } = useQuery(
    trpc.contest.getByCode.queryOptions({ code })
  );

  const contestId = contestData?.contest?.id;

  // 2. Fetch authoritative review data (enabled only when contestId is loaded)
  const {
    data: reviewData,
    isLoading: loadingReview,
    error,
  } = useQuery(
    trpc.contest.getStudentReview.queryOptions(
      { contestId: contestId as string },
      { enabled: !!contestId }
    )
  );

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  if (loadingContest || loadingReview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-7" />
        </div>
        <h2 className="text-xl font-bold">Review Unavailable</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          {error?.message || "Could not load submission review for this contest."}
        </p>
        <Button
          onClick={() => router.push(`/contest/${code}/results`)}
          className="mt-6 rounded-2xl font-bold"
        >
          Back to Results
        </Button>
      </div>
    );
  }

  const { contest, participation, questions } = reviewData;
  const currentQuestion = questions[currentQuestionIndex];

  // Helper for question status pills in the navigator
  const getStatusBadge = (status: "correct" | "partial" | "incorrect" | "unattempted") => {
    switch (status) {
      case "correct":
        return {
          icon: CheckmarkCircle01Icon,
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          activeBg: "bg-emerald-600 text-white shadow-emerald-600/30",
          label: "Correct",
        };
      case "partial":
        return {
          icon: AlertCircleIcon,
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          activeBg: "bg-amber-600 text-white shadow-amber-600/30",
          label: "Partial",
        };
      case "incorrect":
        return {
          icon: AlertCircleIcon,
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
          activeBg: "bg-rose-600 text-white shadow-rose-600/30",
          label: "Incorrect",
        };
      case "unattempted":
      default:
        return {
          icon: MinusSignIcon,
          bg: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
          activeBg: "bg-zinc-600 text-white shadow-zinc-600/30",
          label: "Unattempted",
        };
    }
  };

  const currentStatusMeta = getStatusBadge(currentQuestion?.status || "unattempted");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/contest/${code}/results`)}
            className="gap-2 rounded-xl text-xs font-semibold"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back to Results
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{contest.title}</span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary uppercase tracking-wider">
              Review Mode
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 border border-border/40 px-3 py-1.5 text-xs font-semibold">
            <HugeiconsIcon icon={AwardIcon} className="size-4 text-primary" />
            <span>
              Your Score: <strong className="text-foreground">{participation.score}</strong> / {contest.totalScore} pts
            </span>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* ── Horizontal Question Navigator Bar ── */}
      <div className="border-b border-border/40 bg-muted/20 px-6 py-3">
        <div className="flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider font-bold text-muted-foreground mr-2 shrink-0">
              Questions:
            </span>
            <div className="flex items-center gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQuestionIndex;
                const meta = getStatusBadge(q.status);
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`flex h-9 min-w-9 items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border ${
                      isCurrent
                        ? `${meta.activeBg} shadow-md`
                        : `${meta.bg} hover:brightness-105`
                    }`}
                  >
                    <span>Q{idx + 1}</span>
                    <HugeiconsIcon icon={meta.icon} className="size-3" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-4 text-2xs text-muted-foreground font-semibold shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Correct</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>Partial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" />
              <span>Incorrect</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-zinc-400" />
              <span>Unattempted</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Review Layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {currentQuestion && (
          <ResizablePanelGroup orientation="horizontal" className="w-full">
            {/* ── Left Column: Question Statement & Details ── */}
            <ResizablePanel defaultSize={45} minSize={30} className="bg-card flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-bold text-primary uppercase">
                        {currentQuestion.questionType.toUpperCase()}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-2xs font-semibold text-muted-foreground capitalize">
                        {currentQuestion.difficulty}
                      </span>
                    </div>

                    {/* Score Awarded Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${currentStatusMeta.bg}`}
                    >
                      <HugeiconsIcon icon={currentStatusMeta.icon} className="size-3.5" />
                      <span>
                        {currentQuestion.awardedMarks} / {currentQuestion.marks} pts
                      </span>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-foreground leading-snug">
                    {currentQuestion.title}
                  </h2>
                </div>

                <Separator />

                {/* Markdown Problem Description */}
                {currentQuestion.description && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Problem Statement
                    </h3>
                    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
                      <MarkdownRenderer content={currentQuestion.description} />
                    </div>
                  </div>
                )}

                {/* Optional Hint */}
                {currentQuestion.hint && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                      <HugeiconsIcon icon={HelpCircleIcon} className="size-4" />
                      <span>Hint</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {currentQuestion.hint}
                    </p>
                  </div>
                )}

                {/* Coding Sandbox Constraints */}
                {currentQuestion.questionType === "code" && (
                  <div className="flex gap-6 text-xs text-muted-foreground bg-muted/20 p-3.5 rounded-2xl border border-border/30">
                    <div>
                      <span className="font-bold text-foreground">Time Limit:</span>{" "}
                      {currentQuestion.timeLimit}s
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Memory Limit:</span>{" "}
                      {Math.round(currentQuestion.memoryLimit / 1000)} MB
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* ── Right Column: Answer Review Panel ── */}
            <ResizablePanel defaultSize={55} minSize={35} className="bg-muted/10 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                {/* ── Case 1: Multiple Choice Question (MCQ) ── */}
                {currentQuestion.questionType === "mcq" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-foreground">Response Review</h3>
                      <p className="text-xs text-muted-foreground">
                        Your selected answer compared against the official key.
                      </p>
                    </div>

                    {currentQuestion.status === "unattempted" && (
                      <div className="rounded-2xl border border-zinc-500/30 bg-zinc-500/5 p-4 text-xs font-semibold text-zinc-500 flex items-center gap-2">
                        <HugeiconsIcon icon={MinusSignIcon} className="size-4" />
                        You did not attempt this question. (0 marks awarded)
                      </div>
                    )}

                    <div className="space-y-3">
                      {currentQuestion.options.map((opt) => {
                        const isStudentPick = currentQuestion.studentAnswer === opt.id;
                        const isCorrectOpt = currentQuestion.correctOptionId === opt.id;

                        let cardStyle = "border-border/40 bg-card";
                        if (isCorrectOpt) {
                          cardStyle = "border-emerald-500/50 bg-emerald-500/5 shadow-sm shadow-emerald-500/10";
                        } else if (isStudentPick && !isCorrectOpt) {
                          cardStyle = "border-rose-500/50 bg-rose-500/5";
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${cardStyle}`}
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                  isCorrectOpt
                                    ? "bg-emerald-500 text-white"
                                    : isStudentPick
                                    ? "bg-rose-500 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {opt.id.toUpperCase()}
                              </span>
                              <span className="text-sm text-foreground pt-0.5 leading-relaxed">
                                {opt.text}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isStudentPick && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-bold ${
                                    isCorrectOpt
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                  }`}
                                >
                                  Your Answer
                                </span>
                              )}
                              {isCorrectOpt && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-2xs font-bold">
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
                                  Correct Key
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Case 2: Short Text Question ── */}
                {currentQuestion.questionType === "text" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-foreground">Text Response Review</h3>
                      <p className="text-xs text-muted-foreground">
                        Your submitted answer compared to expected solution.
                      </p>
                    </div>

                    {currentQuestion.status === "unattempted" ? (
                      <div className="rounded-2xl border border-zinc-500/30 bg-zinc-500/5 p-4 text-xs font-semibold text-zinc-500 flex items-center gap-2">
                        <HugeiconsIcon icon={MinusSignIcon} className="size-4" />
                        You did not attempt this question. (0 marks awarded)
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-2">
                        <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                          Your Submitted Answer
                        </span>
                        <p className="font-mono text-sm text-foreground bg-muted/40 p-3 rounded-xl border border-border/30">
                          {currentQuestion.studentAnswer || "<empty>"}
                        </p>
                        <div className="flex items-center gap-1.5 pt-1 text-xs font-bold">
                          {currentQuestion.isCorrect ? (
                            <span className="text-emerald-500 flex items-center gap-1">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                              Correct Match (+{currentQuestion.awardedMarks} pts)
                            </span>
                          ) : (
                            <span className="text-rose-500 flex items-center gap-1">
                              <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                              Incorrect (0 pts)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                      <span className="text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Official Expected Answer
                      </span>
                      <p className="font-mono text-sm text-foreground bg-background/50 p-3 rounded-xl border border-emerald-500/20">
                        {currentQuestion.expectedAnswer}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Case 3: Coding Problem ── */}
                {currentQuestion.questionType === "code" && (
                  <div className="space-y-6">
                    {/* Score Reconciliation Banner */}
                    {currentQuestion.finalScore !== currentQuestion.bestScore ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-amber-500" />
                          <span>Best Score Policy Active</span>
                        </div>
                        <p className="leading-relaxed">
                          Your <strong>Final Attempt</strong> scored{" "}
                          <strong>{currentQuestion.finalScore} pts</strong>, but your contest score credited your highest-scoring submission:{" "}
                          <strong>{currentQuestion.bestScore} / {currentQuestion.marks} pts</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/40">
                        <div>
                          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block">
                            Final Code Submission
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Status: <strong className="text-foreground">{currentQuestion.executionStatus || "Evaluated"}</strong>
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-foreground">
                          {currentQuestion.awardedMarks} / {currentQuestion.marks} pts
                        </span>
                      </div>
                    )}

                    {currentQuestion.status === "unattempted" ? (
                      <div className="rounded-2xl border border-zinc-500/30 bg-zinc-500/5 p-4 text-xs font-semibold text-zinc-500 flex items-center gap-2">
                        <HugeiconsIcon icon={MinusSignIcon} className="size-4" />
                        No code was submitted for this question. (0 marks awarded)
                      </div>
                    ) : (
                      /* Monaco Code Viewer */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                          <span>
                            Language:{" "}
                            <strong className="text-foreground">
                              {getLanguageInfo(currentQuestion.languageId ?? 71).name}
                            </strong>
                          </span>
                          <span className="text-2xs font-semibold uppercase tracking-wider">
                            Read-Only Code View
                          </span>
                        </div>

                        <div className="rounded-2xl border border-border/40 overflow-hidden bg-white dark:bg-[#1e1e1e]">
                          <Editor
                            height="340px"
                            theme={monacoTheme}
                            language={getLanguageInfo(currentQuestion.languageId ?? 71).monacoKey}
                            value={currentQuestion.finalCode || ""}
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              fontSize: 13,
                              scrollBeyondLastLine: false,
                              lineNumbers: "on",
                              automaticLayout: true,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Test Cases Results Breakdown */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Test Cases Evaluation
                        </h4>
                        <span className="text-2xs text-muted-foreground font-semibold">
                          Sample & Failed Hidden Cases Displayed
                        </span>
                      </div>

                      <div className="space-y-3">
                        {currentQuestion.testCases.map((tc: any) => {
                          const isPassed = tc.passed;
                          const isSample = tc.isSample;

                          if (!isSample && isPassed) {
                            // Hidden test case passed: display clean passed badge without leaking private test inputs
                            return (
                              <div
                                key={tc.index}
                                className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold"
                              >
                                <span className="flex items-center gap-2 text-foreground">
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-emerald-500" />
                                  Test Case #{tc.index} (Private Case)
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 text-2xs font-bold uppercase">
                                  Passed
                                </span>
                              </div>
                            );
                          }

                          // Sample test case or Failed Hidden test case
                          return (
                            <div
                              key={tc.index}
                              className={`rounded-2xl border p-4 space-y-3 ${
                                isPassed
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-rose-500/30 bg-rose-500/5"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-2xs font-bold ${
                                      isPassed ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                    }`}
                                  >
                                    {tc.index}
                                  </span>
                                  <span className="text-xs font-bold text-foreground">
                                    {isSample ? "Sample Test Case" : "Private Test Case (Failed)"}
                                  </span>
                                </div>
                                <span
                                  className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                    tc.unattempted
                                      ? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30"
                                      : isPassed
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                  }`}
                                >
                                  {tc.unattempted
                                    ? "Unattempted"
                                    : isPassed
                                    ? "Passed"
                                    : tc.status?.description || "Wrong Answer"}
                                </span>
                              </div>

                              {/* Test Case Inputs & Outputs Diff */}
                              <div className="grid gap-3 sm:grid-cols-2 text-2xs font-mono">
                                <div className="space-y-1">
                                  <span className="text-zinc-700 dark:text-zinc-300 uppercase font-sans font-bold">
                                    Input stdin
                                  </span>
                                  <pre className="p-2.5 rounded-xl bg-muted/70 dark:bg-background/80 border border-border/50 text-foreground overflow-auto max-h-28">
                                    {tc.input || "<empty>"}
                                  </pre>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-emerald-800 dark:text-emerald-300 uppercase font-sans font-bold">
                                    Expected stdout
                                  </span>
                                  <pre className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-background/80 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 overflow-auto max-h-28">
                                    {tc.expectedOutput || "<empty>"}
                                  </pre>
                                </div>
                              </div>

                              {/* Student's Actual Stdout or Stderr */}
                              {tc.stdout && (
                                <div className="space-y-1 text-2xs font-mono">
                                  <span className={`uppercase font-sans font-bold ${
                                    isPassed ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"
                                  }`}>
                                    Your Output
                                  </span>
                                  <pre className={`p-2.5 rounded-xl border overflow-auto max-h-28 ${
                                    isPassed
                                      ? "bg-emerald-500/10 dark:bg-background/80 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                                      : "bg-rose-500/10 dark:bg-background/80 border-rose-500/20 text-rose-900 dark:text-rose-200"
                                  }`}>
                                    {tc.stdout}
                                  </pre>
                                </div>
                              )}
                              {tc.stderr && (
                                <div className="space-y-1 text-2xs font-mono">
                                  <span className="text-rose-800 dark:text-rose-300 uppercase font-sans font-bold">
                                    Error / Stderr
                                  </span>
                                  <pre className="p-2.5 rounded-xl bg-rose-500/10 dark:bg-background/80 border border-rose-500/20 text-rose-900 dark:text-rose-200 overflow-auto max-h-28">
                                    {tc.stderr}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* ── Bottom Question Navigation Footer ── */}
      <footer className="sticky bottom-0 z-40 flex items-center justify-between border-t border-border/40 bg-background/90 px-6 py-3 backdrop-blur-md">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="gap-2 rounded-xl text-xs font-semibold"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Previous Question
        </Button>

        <span className="text-xs font-bold text-muted-foreground">
          Question {currentQuestionIndex + 1} of {questions.length}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
          disabled={currentQuestionIndex === questions.length - 1}
          className="gap-2 rounded-xl text-xs font-semibold"
        >
          Next Question
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Button>
      </footer>
    </div>
  );
}
