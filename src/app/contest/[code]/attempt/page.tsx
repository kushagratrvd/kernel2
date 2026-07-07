"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  HourglassIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

export default function ContestAttemptPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const trpc = useTRPC();

  // Fetch contest details & questions
  const { data, isLoading, error } = useQuery(trpc.contest.getByCode.queryOptions({ code }));
  const finishAttemptMutation = useMutation(trpc.contest.finishAttempt.mutationOptions());

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contest = data?.contest;
  const participation = data?.participation;
  const questions = contest?.questions || [];

  // 1. Redirect if already finished
  useEffect(() => {
    if (participation?.finishedAt) {
      router.push(`/contest/${code}/results`);
    }
  }, [participation, code, router]);

  // 2. Set up countdown timer
  useEffect(() => {
    if (!participation?.startedAt || !contest?.totalTime) return;

    const startTime = new Date(participation.startedAt).getTime();
    const durationMs = contest.totalTime * 60 * 1000;
    const endTime = startTime + durationMs;

    const updateTimer = () => {
      const now = new Date().getTime();
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        // Auto-submit when time runs out
        clearInterval(timerInterval);
        handleAutoSubmit();
      }
    };

    updateTimer(); // run once immediately
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [participation, contest]);

  // Helper: auto submit
  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await submitContest(true);
  };

  // Helper: Calculate score and submit
  const submitContest = async (auto = false) => {
    if (!contest || !participation) return;

    let computedScore = 0;
    questions.forEach((q) => {
      const userAnswer = answers[q.id];
      if (userAnswer === q.correctOption) {
        computedScore += q.questionScore;
      }
    });

    try {
      await finishAttemptMutation.mutateAsync({
        contestId: contest.id,
        score: computedScore,
      });
      router.push(`/contest/${code}/results`);
    } catch (err) {
      console.error("Failed to submit contest:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !contest || !participation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <HugeiconsIcon icon={AlertCircleIcon} className="size-12 text-destructive" />
        <h2 className="text-xl font-bold mt-4">Unable to Load Contest</h2>
        <p className="text-muted-foreground mt-2">Make sure you have started the contest properly.</p>
        <Button onClick={() => router.push(`/contest/${code}`)} className="mt-4">
          Go back to cover
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const options = (currentQuestion?.options as string[]) || [];

  // Format time remaining: MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold bg-gradient-to-r from-chart-1 to-chart-3 bg-clip-text text-transparent">
            {contest.title}
          </span>
        </div>

        {/* Timer Banner */}
        <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          <HugeiconsIcon icon={HourglassIcon} className="size-4 animate-pulse" />
          <span>{timeLeft !== null ? formatTime(timeLeft) : "Loading..."}</span>
        </div>
      </header>

      {/* Main Attempt Workspace */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left Side: Questions Panel */}
        <main className="flex-1 p-6 lg:p-8 space-y-6">
          {currentQuestion ? (
            <div className="space-y-6">
              {/* Question Header */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <h2 className="text-xl font-bold text-foreground leading-snug">
                  {currentQuestion.questionText}
                </h2>
              </div>

              <Separator />

              {/* MCQ Options */}
              <div className="space-y-3">
                {options.map((option, idx) => {
                  const isSelected = answers[currentQuestion.id] === option;
                  return (
                    <button
                      key={idx}
                      onClick={() =>
                        setAnswers({ ...answers, [currentQuestion.id]: option })
                      }
                      className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all outline-none ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 bg-card hover:bg-muted/40"
                      }`}
                    >
                      <span className="text-base font-medium">{option}</span>
                      {isSelected && (
                        <HugeiconsIcon icon={Tick02Icon} className="size-5 text-primary" />
                      )}
                    </button>
                  );
                }
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No questions found.</div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
              className="gap-2"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              Previous
            </Button>

            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                className="gap-2"
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => submitContest()}
                disabled={isSubmitting}
                className="gap-2 bg-chart-1 text-white hover:bg-chart-1/80"
              >
                {isSubmitting ? <Spinner className="size-4" /> : "Finish Contest"}
              </Button>
            )}
          </div>
        </main>

        {/* Right Side: Quick jump list (Sidebar) */}
        <aside className="w-full border-t border-border/40 bg-muted/20 p-6 lg:w-80 lg:border-t-0 lg:border-l lg:bg-muted/10">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase text-muted-foreground">
              Questions Navigator
            </h3>
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentQuestionIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                        : isAnswered
                        ? "bg-chart-1/10 text-chart-1 border border-chart-1/25"
                        : "bg-card border border-border/50 hover:bg-muted/50"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Answered</span>
                <span className="font-semibold text-foreground">
                  {Object.keys(answers).length} / {questions.length}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-chart-1 transition-all duration-300"
                  style={{
                    width: `${(Object.keys(answers).length / questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
