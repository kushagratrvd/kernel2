"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  Clock01Icon,
  CodeSquareIcon,
  UserIcon,
  ArrowRight01Icon,
  Copy01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import Editor from "@monaco-editor/react";
import { getLanguageInfo } from "@/lib/language-map";
import { formatDistanceToNow, format } from "date-fns";
import { useTheme } from "next-themes";

interface StudentSubmissionsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  userId: string | null;
  initialContestQuestionId?: string | null;
}

export function StudentSubmissionsDrawer({
  isOpen,
  onOpenChange,
  contestId,
  userId,
  initialContestQuestionId,
}: StudentSubmissionsDrawerProps) {
  const trpc = useTRPC();
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";
  const [selectedCQId, setSelectedCQId] = useState<string | null>(initialContestQuestionId ?? null);
  const [expandedCodeAttemptId, setExpandedCodeAttemptId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery(
    trpc.contest.adminGetStudentSubmissions.queryOptions(
      { contestId, userId: userId! },
      { enabled: isOpen && !!userId }
    )
  );

  const codingQuestions = data?.codingQuestions ?? [];
  const activeCQId = selectedCQId && codingQuestions.some((q) => q.contestQuestionId === selectedCQId)
    ? selectedCQId
    : codingQuestions[0]?.contestQuestionId ?? null;

  const activeQuestion = codingQuestions.find((q) => q.contestQuestionId === activeCQId);
  const attempts = (data?.submissions ?? []).filter((s) => s.contestQuestionId === activeCQId);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto p-0 bg-background border-l border-border/40"
      >
        {isLoading ? (
          <div className="flex h-full min-h-[400px] items-center justify-center">
            <Spinner className="size-8" />
          </div>
        ) : error || !data ? (
          <div className="p-8 text-center space-y-3">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-10 text-destructive mx-auto" />
            <h3 className="font-bold text-lg">Unable to load student submissions</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || "Student participation record not found."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            {/* Student & Contest Header */}
            <SheetHeader className="p-6 border-b border-border/40 bg-card/60 backdrop-blur-sm sticky top-0 z-20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {data.student.name ? data.student.name.charAt(0).toUpperCase() : <HugeiconsIcon icon={UserIcon} className="size-5" />}
                  </div>
                  <div>
                    <SheetTitle className="text-lg font-bold">
                      {data.student.name || "Student"}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground">
                      {data.student.email}
                    </SheetDescription>
                  </div>
                </div>

                {/* Score & Status Badges */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-xl text-xs font-semibold">
                    Score: <span className="font-bold">{data.participation?.score ?? 0}</span> / {data.contest.totalScore}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-xl font-semibold border ${
                      data.participation?.finishedAt
                        ? "bg-muted text-muted-foreground border-border/40"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {data.participation?.finishedAt ? "Finished" : "In Progress"}
                  </span>
                </div>
              </div>

              {/* Contest Title Reference */}
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <span>Contest:</span>
                <span className="text-foreground font-semibold">{data.contest.title}</span>
                <code className="text-2xs bg-muted px-1.5 py-0.5 rounded font-mono">{data.contest.code}</code>
              </div>
            </SheetHeader>

            {/* Problem Selector (Coding Only) */}
            <div className="p-4 border-b border-border/30 bg-muted/20 overflow-x-auto">
              <div className="text-2xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                Coding Problems ({codingQuestions.length})
              </div>
              {codingQuestions.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">
                  No coding problems configured in this contest.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {codingQuestions.map((q) => {
                    const isActive = q.contestQuestionId === activeCQId;
                    return (
                      <button
                        key={q.contestQuestionId}
                        type="button"
                        onClick={() => {
                          setSelectedCQId(q.contestQuestionId);
                          setExpandedCodeAttemptId(null);
                        }}
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold shrink-0 text-left transition-all border ${
                          isActive
                            ? "bg-primary/10 border-primary/50 text-foreground shadow-xs ring-1 ring-primary/30"
                            : "bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/40"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                            #{q.questionOrder}
                          </span>
                          <span className="max-w-[200px] truncate font-bold text-foreground">
                            {q.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-2xs text-muted-foreground font-medium">
                          <span className={q.isAccepted ? "text-emerald-700 dark:text-emerald-400 font-bold" : ""}>
                            Best: {q.bestScore}/{q.marks}
                          </span>
                          <span>•</span>
                          <span>{q.attemptCount} {q.attemptCount === 1 ? "try" : "tries"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attempts Timeline Workspace */}
            <div className="flex-1 p-6 space-y-4">
              {activeQuestion && (
                <div className="flex items-center justify-between pb-2 border-b border-border/30">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      Problem #{activeQuestion.questionOrder}: {activeQuestion.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Best Score: {activeQuestion.bestScore} / {activeQuestion.marks} marks ({attempts.length} total attempts)
                    </p>
                  </div>
                  {activeQuestion.isAccepted && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
                      Solved
                    </span>
                  )}
                </div>
              )}

              {attempts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/40 rounded-2xl bg-card/40">
                  <HugeiconsIcon icon={CodeSquareIcon} className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-foreground">No submissions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The student has not submitted any code for this problem.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attempts
                    .slice()
                    .reverse()
                    .map((attempt, index) => {
                      const attemptNumber = attempts.length - index;
                      const langInfo = getLanguageInfo(attempt.languageId);
                      const isCodeExpanded = expandedCodeAttemptId === attempt.id;
                      const isAccepted = attempt.status === "Accepted";
                      const executionDetails = (attempt.executionResult as any)?.details ?? [];
                      const passedCount = (attempt.executionResult as any)?.passedCount ?? 0;
                      const totalCount = (attempt.executionResult as any)?.totalCount ?? executionDetails.length;

                      return (
                        <div
                          key={attempt.id}
                          className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-xs space-y-0"
                        >
                          {/* Attempt Summary Row */}
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card">
                            <div className="flex items-center gap-3">
                              <span className="size-7 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0">
                                #{attemptNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                      isAccepted
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                        : attempt.status === "Wrong Answer"
                                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                        : attempt.status === "Time Limit Exceeded"
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                        : "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                                    }`}
                                  >
                                    {attempt.status}
                                  </span>
                                  <span className="text-xs font-bold text-foreground">
                                    {attempt.scoreObtained} pts
                                  </span>
                                  <span className="text-2xs text-muted-foreground">
                                    ({passedCount}/{totalCount} test cases)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-2xs text-muted-foreground">
                                  <span>{langInfo.name}</span>
                                  <span>•</span>
                                  <span title={format(new Date(attempt.createdAt), "PPpp")}>
                                    {formatDistanceToNow(new Date(attempt.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={isCodeExpanded ? "default" : "outline"}
                                className="text-xs h-8 rounded-xl gap-1.5"
                                onClick={() => setExpandedCodeAttemptId(isCodeExpanded ? null : attempt.id)}
                              >
                                <HugeiconsIcon icon={CodeSquareIcon} className="size-3.5" />
                                {isCodeExpanded ? "Hide Code" : "View Code"}
                              </Button>
                            </div>
                          </div>

                          {/* Monaco Code Viewer Drawer Panel */}
                          {isCodeExpanded && (
                            <div className="border-t border-border/30 bg-white dark:bg-[#1e1e1e]">
                              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 dark:border-zinc-800 text-2xs text-muted-foreground">
                                <span>Language: {langInfo.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-2xs text-foreground hover:bg-muted/60 gap-1 px-2"
                                  onClick={() => handleCopy(attempt.id, attempt.userAnswer)}
                                >
                                  <HugeiconsIcon
                                    icon={copiedId === attempt.id ? Tick01Icon : Copy01Icon}
                                    className="size-3"
                                  />
                                  {copiedId === attempt.id ? "Copied" : "Copy Code"}
                                </Button>
                              </div>
                              <Editor
                                height="220px"
                                language={langInfo.monacoKey}
                                theme={monacoTheme}
                                value={attempt.userAnswer}
                                options={{
                                  readOnly: true,
                                  minimap: { enabled: false },
                                  fontSize: 12,
                                  lineHeight: 18,
                                  automaticLayout: true,
                                  scrollBeyondLastLine: false,
                                }}
                              />
                            </div>
                          )}

                          {/* Test Cases Diagnostics */}
                          {executionDetails.length > 0 && (
                            <div className="p-4 border-t border-border/30 bg-muted/10 space-y-2">
                              <div className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">
                                Test Case Results
                              </div>
                              <div className="space-y-1.5">
                                {executionDetails.map((tc: any, tcIndex: number) => {
                                  const passed = tc.passed;
                                  return (
                                    <div
                                      key={tcIndex}
                                      className={`p-3 rounded-2xl border text-xs ${
                                        passed
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                          : "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-300"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold">
                                          <HugeiconsIcon
                                            icon={passed ? CheckmarkCircle01Icon : AlertCircleIcon}
                                            className={`size-4 shrink-0 ${
                                              passed
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-600 dark:text-rose-400"
                                            }`}
                                          />
                                          <span>
                                            Test Case #{tcIndex + 1} {tc.isSample ? "(Sample)" : "(Private)"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-2xs font-mono font-medium">
                                          {tc.time && <span>Time: {tc.time}s</span>}
                                          {tc.memory && <span>Mem: {Math.round(tc.memory / 1024)}MB</span>}
                                          <span
                                            className={`font-bold uppercase px-2 py-0.5 rounded-full ${
                                              passed
                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                            }`}
                                          >
                                            {tc.status?.description || (passed ? "Passed" : "Wrong Answer")}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Detailed Diagnostics for Failed Test Cases */}
                                      {!passed && (
                                        <div className="mt-3 pt-2.5 border-t border-rose-500/20 space-y-2.5 text-2xs font-mono">
                                          {tc.compile_output && (
                                            <div>
                                              <span className="text-rose-800 dark:text-rose-300 font-bold block mb-1">
                                                Compilation Output:
                                              </span>
                                              <pre className="p-2.5 bg-rose-500/10 dark:bg-black/50 border border-rose-500/20 rounded-xl overflow-x-auto text-rose-900 dark:text-rose-200 whitespace-pre-wrap">
                                                {tc.compile_output}
                                              </pre>
                                            </div>
                                          )}
                                          {tc.input !== undefined && (
                                            <div>
                                              <span className="text-zinc-700 dark:text-zinc-300 font-bold block mb-1">
                                                Input (stdin):
                                              </span>
                                              <pre className="p-2.5 bg-muted/70 dark:bg-black/50 border border-border/50 rounded-xl overflow-x-auto text-foreground max-h-24">
                                                {tc.input || "<empty>"}
                                              </pre>
                                            </div>
                                          )}
                                          {tc.expectedOutput !== undefined && (
                                            <div>
                                              <span className="text-emerald-800 dark:text-emerald-300 font-bold block mb-1">
                                                Expected Output:
                                              </span>
                                              <pre className="p-2.5 bg-emerald-500/10 dark:bg-black/50 border border-emerald-500/20 rounded-xl overflow-x-auto text-emerald-900 dark:text-emerald-200 max-h-24">
                                                {tc.expectedOutput}
                                              </pre>
                                            </div>
                                          )}
                                          {tc.stdout !== undefined && (
                                            <div>
                                              <span className="text-rose-800 dark:text-rose-300 font-bold block mb-1">
                                                Actual Student Output (stdout):
                                              </span>
                                              <pre className="p-2.5 bg-rose-500/10 dark:bg-black/50 border border-rose-500/20 rounded-xl overflow-x-auto text-rose-900 dark:text-rose-200 max-h-24">
                                                {tc.stdout || "<empty / no output>"}
                                              </pre>
                                            </div>
                                          )}
                                          {tc.stderr && (
                                            <div>
                                              <span className="text-rose-800 dark:text-rose-300 font-bold block mb-1">
                                                Error (stderr):
                                              </span>
                                              <pre className="p-2.5 bg-rose-500/10 dark:bg-black/50 border border-rose-500/20 rounded-xl overflow-x-auto text-rose-900 dark:text-rose-200 whitespace-pre-wrap max-h-24">
                                                {tc.stderr}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
