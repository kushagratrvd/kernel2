"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import Editor from "@monaco-editor/react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  HourglassIcon,
  AlertCircleIcon,
  CodeIcon,
  PlayIcon,
  SentIcon,
  TerminalIcon,
  CircleArrowUpIcon,
} from "@hugeicons/core-free-icons";

// Default languages map
const LANGUAGES = [
  { id: 71, name: "Python (3.8)", monacoKey: "python" },
  { id: 63, name: "JavaScript (Node 18)", monacoKey: "javascript" },
  { id: 54, name: "C++ (GCC 9)", monacoKey: "cpp" },
  { id: 50, name: "C (GCC 9)", monacoKey: "c" },
  { id: 62, name: "Java (OpenJDK 17)", monacoKey: "java" },
];

import { ModeToggle } from "@/components/ui/mode-toggle";

export default function ContestAttemptPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  // Fetch contest details & questions
  const { data, isLoading, error, refetch } = useQuery(
    trpc.contest.getByCode.queryOptions({ code }),
  );

  const finishAttemptMutation = useMutation(trpc.contest.finishAttempt.mutationOptions());
  const submitMcqOrTextAnswerMutation = useMutation(trpc.contest.submitMcqOrTextAnswer.mutationOptions());
  const runCodeMutation = useMutation(trpc.contest.runCode.mutationOptions());
  const submitCodeMutation = useMutation(trpc.contest.submitCode.mutationOptions());

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, number>>({});
  const [codeEditorValues, setCodeEditorValues] = useState<Record<string, string>>({});
  
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // MCQ/Text Save State
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});

  // Execution Console State
  const consolePanelRef = useRef<any>(null);
  const [consoleTab, setConsoleTab] = useState<"run" | "submit">("run");
  const [runResults, setRunResults] = useState<any[] | null>(null);
  const [submitResult, setSubmitResult] = useState<any | null>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contest = data?.contest;
  const participation = data?.participation;
  const questions = contest?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

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

    let timerInterval: ReturnType<typeof setInterval> | undefined;

    const updateTimer = () => {
      const now = new Date().getTime();
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        handleAutoSubmit();
      }
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [participation, contest]);

  // 3. Load previous submissions and merge with local storage draft
  useEffect(() => {
    if (!participation || !contest || !session?.user?.id) return;

    const dbAnswers: Record<string, string> = {};
    const dbLangs: Record<string, number> = {};
    const dbCodeValues: Record<string, string> = {};

    participation.submissions.forEach((sub) => {
      dbAnswers[sub.questionId] = sub.userAnswer;
      if (sub.languageId) {
        dbLangs[sub.questionId] = sub.languageId;
        dbCodeValues[`${sub.questionId}_${sub.languageId}`] = sub.userAnswer;
      }
    });

    // Retrieve local storage draft
    const localKey = `kernel_contest_draft_${session.user.id}_${contest.id}`;
    let localDraft: any = null;
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        localDraft = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse local draft from localStorage:", e);
    }

    const mergedAnswers = { ...dbAnswers, ...(localDraft?.answers || {}) };
    const mergedLangs = { ...dbLangs, ...(localDraft?.selectedLanguages || {}) };
    const mergedCodeValues = { ...dbCodeValues, ...(localDraft?.codeEditorValues || {}) };

    setAnswers(mergedAnswers);
    setSelectedLanguages(mergedLangs);
    setCodeEditorValues(mergedCodeValues);
  }, [participation, contest, session]);

  // 4. Save progress to localStorage (debounced) whenever answers, languages, or editor code values change
  useEffect(() => {
    if (!contest || !session?.user?.id) return;
    
    // Check if we actually have values to save (avoid writing empty states on initial load)
    if (Object.keys(answers).length === 0 && Object.keys(selectedLanguages).length === 0 && Object.keys(codeEditorValues).length === 0) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const localKey = `kernel_contest_draft_${session.user.id}_${contest.id}`;
      const draft = {
        answers,
        selectedLanguages,
        codeEditorValues,
      };
      localStorage.setItem(localKey, JSON.stringify(draft));
    }, 500); // Debounce write operations by 500ms

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [answers, selectedLanguages, codeEditorValues, contest, session]);

  // Helper: auto submit
  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await submitContest();
  };

  // Helper: Finish Attempt
  const submitContest = async () => {
    if (!contest || !participation) return;

    try {
      setIsSubmitting(true);
      await finishAttemptMutation.mutateAsync({
        contestId: contest.id,
      });

      // Clear local storage draft upon success
      if (session?.user?.id) {
        const localKey = `kernel_contest_draft_${session.user.id}_${contest.id}`;
        localStorage.removeItem(localKey);
      }

      router.push(`/contest/${code}/results`);
    } catch (err) {
      console.error("Failed to submit contest:", err);
      setIsSubmitting(false);
    }
  };

  // Save MCQ or Text Answer to Server
  const handleSaveMcqOrText = async () => {
    if (!contest || !currentQuestion) return;
    const answer = answers[currentQuestion.id] || "";

    if (!answer.trim()) return;

    setSaveStatus({ ...saveStatus, [currentQuestion.id]: "saving" });

    try {
      await submitMcqOrTextAnswerMutation.mutateAsync({
        contestId: contest.id,
        questionId: currentQuestion.id,
        userAnswer: answer,
      });
      setSaveStatus({ ...saveStatus, [currentQuestion.id]: "saved" });
      refetch();
    } catch (err) {
      console.error(err);
      setSaveStatus({ ...saveStatus, [currentQuestion.id]: "error" });
    }
  };

  // Run Code against Sample Test Cases
  const handleRunCode = async () => {
    if (!contest || !currentQuestion) return;
    const langId = selectedLanguages[currentQuestion.id] || 71; // default Python
    const sourceCode = codeEditorValues[`${currentQuestion.id}_${langId}`] || getStarterCodeForLang(langId);

    setIsRunningCode(true);
    consolePanelRef.current?.expand();
    setConsoleTab("run");
    setRunResults(null);

    try {
      const res = await runCodeMutation.mutateAsync({
        contestId: contest.id,
        questionId: currentQuestion.id,
        sourceCode,
        languageId: langId,
      });
      setRunResults(res.results);
    } catch (err: any) {
      console.error(err);
      setRunResults([{
        status: { id: 13, description: "Execution error" },
        stderr: err.message || String(err),
      }]);
    } finally {
      setIsRunningCode(false);
    }
  };

  // Submit Code (Graded submission)
  const handleSubmitCode = async () => {
    if (!contest || !currentQuestion) return;
    const langId = selectedLanguages[currentQuestion.id] || 71;
    const sourceCode = codeEditorValues[`${currentQuestion.id}_${langId}`] || getStarterCodeForLang(langId);

    setIsSubmittingCode(true);
    consolePanelRef.current?.expand();
    setConsoleTab("submit");
    setSubmitResult(null);

    try {
      const res = await submitCodeMutation.mutateAsync({
        contestId: contest.id,
        questionId: currentQuestion.id,
        sourceCode,
        languageId: langId,
      });
      setSubmitResult(res);
      refetch(); // Refresh to update submissions history
    } catch (err: any) {
      console.error(err);
      setSubmitResult({
        status: "Error",
        executionResult: { message: err.message || String(err) },
      });
    } finally {
      setIsSubmittingCode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
        <Button onClick={() => router.push(`/contest/${code}`)} className="mt-4 rounded-2xl">
          Go back to cover
        </Button>
      </div>
    );
  }

  // Format time remaining: MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStarterCodeForLang = (langId: number): string => {
    if (!currentQuestion) return "";
    const starterMap = (currentQuestion.starterCode as Record<string, string>) || {};
    return starterMap[String(langId)] || "";
  };

  // Get active editor value
  const activeLangId = selectedLanguages[currentQuestion?.id] || 71;
  const editorCode = codeEditorValues[`${currentQuestion?.id}_${activeLangId}`] ?? getStarterCodeForLang(activeLangId);
  const activeLangObj = LANGUAGES.find(l => l.id === activeLangId) || LANGUAGES[0];

  const currentSaveStatus = saveStatus[currentQuestion?.id] || "idle";

  // Check if a question is already answered/submitted
  const isQuestionAnswered = (qId: string): boolean => {
    return participation.submissions.some(s => s.questionId === qId);
  };

  // Get best submission status for a question
  const getQuestionSubmissionStatus = (qId: string): string | null => {
    const questionSubs = participation.submissions.filter(s => s.questionId === qId);
    if (questionSubs.length === 0) return null;
    
    // For MCQ/Text, it's just "Correct" / "Incorrect"
    // For Code, check if any is Accepted, else return status of highest score
    const acceptedSub = questionSubs.find(s => s.status === "Accepted");
    if (acceptedSub) return "Accepted";
    
    // Sort by scoreObtained descending
    const sorted = [...questionSubs].sort((a, b) => b.scoreObtained - a.scoreObtained);
    return sorted[0].status;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-foreground">
            {contest.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ModeToggle />
          {/* Timer Banner */}
          <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            <HugeiconsIcon icon={HourglassIcon} className="size-4 animate-pulse" />
            <span>{timeLeft !== null ? formatTime(timeLeft) : "Loading..."}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* Left Side: Resizable Panels or standard panels */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {currentQuestion?.questionType === "code" ? (
            <ResizablePanelGroup orientation="horizontal" className="w-full">
              {/* Question Statement Panel (Left) */}
              <ResizablePanel defaultSize={40} minSize={25} className="bg-card flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-2xs font-semibold text-blue-500 uppercase">
                        Coding Problem
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">({currentQuestion.questionScore} pts)</span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground leading-snug">
                      {currentQuestion.questionText}
                    </h2>
                  </div>

                  <Separator />

                  {/* Sandbox Constraints */}
                  <div className="flex gap-6 text-xs text-muted-foreground bg-muted/20 p-3 rounded-2xl border border-border/30">
                    <div>
                      <span className="font-bold text-foreground">Time Limit:</span> {currentQuestion.timeLimit}s
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Memory Limit:</span> {Math.round(currentQuestion.memoryLimit / 1000)} MB
                    </div>
                  </div>

                  {/* Sample Test Cases (shown to student) */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Sample Test Cases</h3>
                    {currentQuestion.testCases?.map((tc: any, index: number) => (
                      <div key={tc.id} className="space-y-2.5">
                        <div className="text-xs font-bold text-foreground">Sample Case #{index + 1}</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Input stdin</div>
                            <pre className="rounded-xl border border-border/30 bg-muted/40 p-3 font-mono text-xs overflow-auto max-h-32">
                              {tc.input || "<empty>"}
                            </pre>
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Expected stdout</div>
                            <pre className="rounded-xl border border-border/30 bg-muted/40 p-3 font-mono text-xs overflow-auto max-h-32">
                              {tc.expectedOutput}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Monaco Editor & Console Panel (Right) */}
              <ResizablePanel defaultSize={60} minSize={35}>
                <ResizablePanelGroup orientation="vertical" className="h-full">
                  {/* Editor workspace */}
                  <ResizablePanel defaultSize={65} minSize={40} className="flex flex-col min-h-0">
                    <div className="flex items-center justify-between border-b border-border/30 bg-card/60 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={CodeIcon} className="size-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">Editor</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <select
                          value={activeLangId}
                          onChange={(e) => {
                            const newLang = Number(e.target.value);
                            setSelectedLanguages({ ...selectedLanguages, [currentQuestion.id]: newLang });
                          }}
                          className="flex h-8 rounded-xl border border-border/50 bg-background px-2.5 text-xs font-semibold outline-none"
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex-1 relative min-h-0 bg-[#1e1e1e]">
                      <Editor
                        height="100%"
                        language={activeLangObj.monacoKey}
                        theme="vs-dark"
                        value={editorCode}
                        onChange={(val) => {
                          setCodeEditorValues({
                            ...codeEditorValues,
                            [`${currentQuestion.id}_${activeLangId}`]: val || "",
                          });
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineHeight: 20,
                          padding: { top: 12 },
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel 
                    defaultSize={35} 
                    minSize={15} 
                    collapsible 
                    panelRef={consolePanelRef}
                    className="bg-card border-t border-border/30 flex flex-col min-h-0"
                  >
                    {/* Console Header */}
                    <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-6 py-2 shrink-0">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setConsoleTab("run")}
                          className={`text-xs font-bold uppercase pb-1.5 pt-1 outline-none transition-all border-b-2 ${
                            consoleTab === "run"
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Run Code Console
                        </button>
                        <button
                          onClick={() => setConsoleTab("submit")}
                          className={`text-xs font-bold uppercase pb-1.5 pt-1 outline-none transition-all border-b-2 ${
                            consoleTab === "submit"
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Submissions
                        </button>
                      </div>

                      <div className="flex gap-2 items-center">
                        <Button
                          variant="outline"
                          type="button"
                          disabled={currentQuestionIndex === 0}
                          onClick={() => {
                            setCurrentQuestionIndex(currentQuestionIndex - 1);
                            setRunResults(null);
                            setSubmitResult(null);
                          }}
                          className="rounded-xl gap-1 text-xs border-border/50 h-7 px-2.5"
                        >
                          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
                          Prev
                        </Button>

                        <Button
                          disabled={isRunningCode || isSubmittingCode}
                          onClick={handleRunCode}
                          size="xs"
                          variant="outline"
                          className="rounded-xl gap-1 text-xs border-border/50 h-7"
                        >
                          {isRunningCode ? <Spinner className="size-3" /> : <HugeiconsIcon icon={PlayIcon} className="size-3" />}
                          Run Code
                        </Button>
                        <Button
                          disabled={isRunningCode || isSubmittingCode}
                          onClick={handleSubmitCode}
                          size="xs"
                          className="rounded-xl gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 h-7"
                        >
                          {isSubmittingCode ? <Spinner className="size-3" /> : <HugeiconsIcon icon={SentIcon} className="size-3" />}
                          Submit
                        </Button>

                        {currentQuestionIndex < questions.length - 1 && (
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setCurrentQuestionIndex(currentQuestionIndex + 1);
                              setRunResults(null);
                              setSubmitResult(null);
                            }}
                            className="rounded-xl gap-1 text-xs border-border/50 h-7 px-2.5"
                          >
                            Next
                            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Console Body */}
                    <div className="flex-1 overflow-y-auto p-5 font-mono text-xs bg-black/90 text-zinc-300">
                      {consoleTab === "run" ? (
                        isRunningCode ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner className="size-3" />
                            Running code on sandbox container...
                          </div>
                        ) : runResults ? (
                          <div className="space-y-4">
                            {runResults.map((res, index) => {
                              const runPassed = res.passed;
                              return (
                                <div key={index} className="space-y-2 border-b border-zinc-800/80 pb-3 last:border-0 last:pb-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-foreground">Sample Case #{index + 1}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      runPassed 
                                        ? "bg-green-500/10 text-green-400" 
                                        : "bg-red-500/10 text-red-400"
                                    }`}>
                                      {runPassed ? "PASSED" : "FAILED"}
                                    </span>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-2 text-[11px] text-zinc-400">
                                    <div>
                                      <div className="text-[10px] text-muted-foreground font-bold">Input stdin:</div>
                                      <pre className="p-2 bg-zinc-900 rounded overflow-auto mt-1 max-h-16">{res.input || "<empty>"}</pre>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground font-bold">Expected stdout:</div>
                                      <pre className="p-2 bg-zinc-900 rounded overflow-auto mt-1 max-h-16">{res.expectedOutput}</pre>
                                    </div>
                                  </div>

                                  {res.compile_output ? (
                                    <div className="text-red-400 mt-2">
                                      <div className="font-bold text-[10px] text-red-500">Compilation Error:</div>
                                      <pre className="p-2 bg-red-950/20 rounded mt-1 overflow-auto whitespace-pre-wrap">{res.compile_output}</pre>
                                    </div>
                                  ) : res.stderr ? (
                                    <div className="text-red-400 mt-2">
                                      <div className="font-bold text-[10px] text-red-500">Stderr:</div>
                                      <pre className="p-2 bg-red-950/20 rounded mt-1 overflow-auto whitespace-pre-wrap">{res.stderr}</pre>
                                    </div>
                                  ) : (
                                    <div className="mt-2 text-zinc-300">
                                      <div className="font-bold text-[10px] text-muted-foreground">Output:</div>
                                      <pre className="p-2 bg-zinc-900 rounded mt-1 overflow-auto max-h-20">{res.stdout || "<no output>"}</pre>
                                    </div>
                                  )}

                                  <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
                                    <span>Time: {res.time || "0.00"}s</span>
                                    <span>Memory: {res.memory || "0"} KB</span>
                                    <span>Status: {res.status?.description}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic flex items-center gap-1.5">
                            <HugeiconsIcon icon={TerminalIcon} className="size-4" />
                            Run code to see sample execution logs here.
                          </div>
                        )
                      ) : (
                        isSubmittingCode ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner className="size-3" />
                            Running code on sandbox container against all test cases...
                          </div>
                        ) : submitResult ? (
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900/40 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-sm text-foreground">Submission Status:</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  submitResult.status === "Accepted"
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}>
                                  {submitResult.status}
                                </span>
                              </div>
                              <div className="flex gap-6 text-xs text-zinc-400">
                                <div>
                                  Passed: <span className="text-foreground font-bold">{submitResult.executionResult?.passedCount}</span> / {submitResult.executionResult?.totalCount}
                                </div>
                                <div>
                                  Score Earned: <span className="text-foreground font-bold">{submitResult.scoreObtained} pts</span>
                                </div>
                              </div>
                            </div>

                            {/* Show details for sample test cases (for debugging) */}
                            {submitResult.executionResult?.details && (
                              <div className="space-y-3 pt-2">
                                <div className="text-xs font-bold text-muted-foreground uppercase">Sample Test Case Verifications</div>
                                {submitResult.executionResult.details.filter((d: any) => d.isSample).map((d: any, i: number) => (
                                  <div key={i} className="flex justify-between items-center p-2 bg-zinc-900/30 rounded border border-zinc-800/40 text-[11px]">
                                    <span className="text-zinc-400">Sample Case #{i + 1}</span>
                                    <span className={`font-bold ${d.passed ? "text-green-400" : "text-red-400"}`}>
                                      {d.passed ? "Passed" : d.status?.description || "Failed"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic flex items-center gap-1.5">
                            <HugeiconsIcon icon={TerminalIcon} className="size-4" />
                            Submit code to execute against all test cases and earn points.
                          </div>
                        )
                      )}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            /* MCQ or Text Question Panel (Single Columns) */
            <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-y-auto">
              {currentQuestion ? (
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Question Header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold uppercase ${
                        currentQuestion.questionType === "mcq" 
                          ? "bg-purple-500/10 text-purple-500" 
                          : "bg-orange-500/10 text-orange-500"
                      }`}>
                        {currentQuestion.questionType === "mcq" ? "Multiple Choice" : "Short Answer"}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">({currentQuestion.questionScore} pts)</span>
                    </div>
                    <h2 className="text-2xl font-black text-foreground leading-snug">
                      {currentQuestion.questionText}
                    </h2>
                  </div>

                  <Separator />

                  {/* Render MCQ Choices */}
                  {currentQuestion.questionType === "mcq" && (
                    <div className="space-y-3">
                      {((currentQuestion.options as string[]) || []).map((option, idx) => {
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
                            <span className="text-base font-semibold">{option}</span>
                            {isSelected && (
                              <HugeiconsIcon icon={Tick02Icon} className="size-5 text-primary animate-scale" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Render Short Text input */}
                  {currentQuestion.questionType === "text" && (
                    <div className="space-y-3">
                      <Label htmlFor="textAnswer" className="font-semibold text-sm">Type your answer here:</Label>
                      <input
                        id="textAnswer"
                        type="text"
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                        placeholder="e.g. cin"
                        className="flex h-12 w-full rounded-2xl border border-border/50 bg-input/50 px-4 py-3 text-base outline-none font-mono focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                  )}

                  {/* MCQ/Text Action buttons */}
                  <div className="flex flex-wrap gap-3 items-center pt-2">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={currentQuestionIndex === 0}
                      onClick={() => {
                        setCurrentQuestionIndex(currentQuestionIndex - 1);
                        setRunResults(null);
                        setSubmitResult(null);
                      }}
                      className="rounded-2xl gap-1.5 h-10 border-border/60"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                      Previous
                    </Button>

                    <Button
                      onClick={handleSaveMcqOrText}
                      disabled={currentSaveStatus === "saving" || !answers[currentQuestion.id]}
                      className="rounded-2xl px-6 bg-primary text-primary-foreground font-semibold h-10"
                    >
                      {currentSaveStatus === "saving" ? "Saving..." : "Save Answer"}
                    </Button>

                    {currentQuestionIndex < questions.length - 1 && (
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          setCurrentQuestionIndex(currentQuestionIndex + 1);
                          setRunResults(null);
                          setSubmitResult(null);
                        }}
                        className="rounded-2xl gap-1.5 h-10 border-border/60"
                      >
                        Next
                        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                      </Button>
                    )}

                    {currentSaveStatus === "saved" && (
                      <span className="text-xs text-green-500 font-bold flex items-center gap-1">
                        <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                        Answer saved successfully!
                      </span>
                    )}

                    {currentSaveStatus === "error" && (
                      <span className="text-xs text-destructive font-bold flex items-center gap-1">
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                        Failed to save answer. Try again.
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">No questions found.</div>
              )}
            </main>
          )}
        </div>

        {/* Right Side: Quick jump list (Sidebar) */}
        <aside className="w-full border-t border-border/40 bg-muted/20 p-6 lg:w-80 lg:border-t-0 lg:border-l lg:bg-muted/10 shrink-0">
          <div className="space-y-4">
            <h3 className="font-bold text-xs tracking-wider uppercase text-muted-foreground">
              Questions Navigator
            </h3>
            
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const isAnswered = isQuestionAnswered(q.id);
                const isCurrent = idx === currentQuestionIndex;
                const codeStatus = q.questionType === "code" ? getQuestionSubmissionStatus(q.id) : null;

                let borderBgClass = "bg-card border border-border/50 hover:bg-muted/50 text-foreground";
                
                if (isCurrent) {
                  borderBgClass = "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20";
                } else if (isAnswered) {
                  if (q.questionType === "code") {
                    borderBgClass = codeStatus === "Accepted"
                      ? "bg-green-500/10 text-green-600 border border-green-500/35"
                      : "bg-red-500/10 text-red-500 border border-red-500/35";
                  } else {
                    borderBgClass = "bg-primary/10 text-primary border border-primary/20";
                  }
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      // Clear console results when shifting questions
                      setRunResults(null);
                      setSubmitResult(null);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all relative outline-none ${borderBgClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completed Tasks</span>
                <span className="font-bold text-foreground">
                  {questions.filter(q => isQuestionAnswered(q.id)).length} / {questions.length}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(questions.filter(q => isQuestionAnswered(q.id)).length / questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <Separator />

            {/* Sidebar Details / Legend */}
            <div className="space-y-2.5 text-2xs text-muted-foreground font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded bg-primary/20 border border-primary/40" />
                <span>MCQ/Text Answer Saved</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded bg-green-500/10 border border-green-500/30" />
                <span>Code Accepted (100%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded bg-red-500/10 border border-red-500/30" />
                <span>Code Partial/Failed</span>
              </div>
            </div>

            <Separator />

            {/* Submit attempt action */}
            <Button
              onClick={submitContest}
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold transition-all gap-1.5 h-11"
            >
              {isSubmitting ? <Spinner className="size-4" /> : (
                <>
                  <HugeiconsIcon icon={CircleArrowUpIcon} className="size-4" />
                  Finish Contest
                </>
              )}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
