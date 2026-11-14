"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  CodeSquareIcon,
  UserGroupIcon,
  EyeIcon,
  RefreshIcon,
  CheckmarkCircle01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { ModeToggle } from "@/components/ui/mode-toggle";
import { QuestionPickerDialog } from "@/components/contests/question-picker-dialog";
import { StudentSubmissionsDrawer } from "@/components/contests/student-submissions-drawer";
import { getLanguageInfo } from "@/lib/language-map";
import { formatDistanceToNow, format } from "date-fns";

export default function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"questions" | "submissions" | "participants">("questions");

  // Drawer inspection state
  const [inspectingUser, setInspectingUser] = useState<{
    userId: string;
    contestId: string;
    contestQuestionId?: string;
  } | null>(null);

  // Contest Metadata Query
  const { data: contestData, isLoading, error, refetch } = useQuery(
    trpc.contest.getForEdit.queryOptions({ id: contestId }),
  );

  // Contest Participants Query
  const {
    data: participants = [],
    isLoading: isParticipantsLoading,
    refetch: refetchParticipants,
  } = useQuery(
    trpc.contest.adminGetContestParticipants.queryOptions(
      { contestId },
      { enabled: activeTab === "participants" }
    )
  );

  // Contest Submissions Tab State (live streaming)
  const [contestSubmissions, setContestSubmissions] = useState<any[]>([]);
  const [isLivePolling, setIsLivePolling] = useState<boolean>(true);

  const { data: initialSubmissions, isLoading: isSubmissionsLoading } = useQuery(
    trpc.contest.adminGetSubmissions.queryOptions(
      { contestId, limit: 50 },
      { enabled: activeTab === "submissions", refetchOnWindowFocus: false }
    )
  );

  useEffect(() => {
    if (initialSubmissions) {
      setContestSubmissions(initialSubmissions);
    }
  }, [initialSubmissions]);

  // Track newest timestamp for cursor polling
  const newestTimestampRef = useRef<Date | null>(null);
  useEffect(() => {
    if (contestSubmissions.length > 0) {
      newestTimestampRef.current = new Date(contestSubmissions[0].createdAt);
    } else {
      newestTimestampRef.current = null;
    }
  }, [contestSubmissions]);

  // Live poll for new submissions (every 4s) when Submissions tab is open
  useEffect(() => {
    if (activeTab !== "submissions" || !isLivePolling) return;

    const interval = setInterval(async () => {
      if (!newestTimestampRef.current) return;

      try {
        const newArrivals = await queryClient.fetchQuery(
          trpc.contest.adminGetSubmissions.queryOptions({
            contestId,
            afterCursor: newestTimestampRef.current,
            limit: 20,
          })
        );

        if (newArrivals && newArrivals.length > 0) {
          setContestSubmissions((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const freshItems = newArrivals.filter((item: any) => !existingIds.has(item.id));
            if (freshItems.length === 0) return prev;
            return [...freshItems, ...prev];
          });
        }
      } catch (err) {
        console.error("Contest live submissions poll failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab, isLivePolling, contestId, trpc, queryClient]);

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
                onClick={() => setIsPickerOpen(true)}
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

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <Button
            variant={activeTab === "questions" ? "default" : "ghost"}
            size="sm"
            className="rounded-xl text-xs gap-2 font-semibold"
            onClick={() => setActiveTab("questions")}
          >
            <HugeiconsIcon icon={Edit01Icon} className="size-3.5" />
            Questions ({contestData.questions?.length || 0})
          </Button>

          <Button
            variant={activeTab === "submissions" ? "default" : "ghost"}
            size="sm"
            className="rounded-xl text-xs gap-2 font-semibold relative"
            onClick={() => setActiveTab("submissions")}
          >
            <HugeiconsIcon icon={CodeSquareIcon} className="size-3.5" />
            Live Submissions
            {contestSubmissions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-2xs bg-primary/20 text-primary">
                {contestSubmissions.length}
              </span>
            )}
          </Button>

          <Button
            variant={activeTab === "participants" ? "default" : "ghost"}
            size="sm"
            className="rounded-xl text-xs gap-2 font-semibold"
            onClick={() => setActiveTab("participants")}
          >
            <HugeiconsIcon icon={UserGroupIcon} className="size-3.5" />
            Participants ({participants.length})
          </Button>
        </div>

        {/* TAB 1: Questions Manager */}
        {activeTab === "questions" && (
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
                  onClick={() => setIsPickerOpen(true)}
                  size="sm" 
                  className="rounded-xl"
                >
                  Add your first question
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Submissions Feed */}
        {activeTab === "submissions" && (
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Code Submissions</h3>
                <p className="text-xs text-muted-foreground">
                  Streaming live code submissions submitted by students in this contest.
                </p>
              </div>
              <Button
                size="sm"
                variant={isLivePolling ? "default" : "outline"}
                className="h-8 text-xs rounded-xl gap-1.5"
                onClick={() => setIsLivePolling(!isLivePolling)}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={`size-3.5 ${isLivePolling ? "animate-spin" : ""}`}
                />
                {isLivePolling ? "Live Polling (4s)" : "Resume Live"}
              </Button>
            </div>

            <div className="rounded-2xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-muted/40 border-b border-border/40 text-2xs uppercase tracking-wider font-bold text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Problem</th>
                      <th className="py-3 px-4">Language</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {isSubmissionsLoading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Spinner className="size-6 mx-auto" />
                          <p className="text-xs text-muted-foreground mt-2">Loading submissions...</p>
                        </td>
                      </tr>
                    ) : contestSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground space-y-1">
                          <HugeiconsIcon icon={CodeSquareIcon} className="size-8 mx-auto opacity-40" />
                          <p className="font-semibold text-foreground text-sm">No code submissions yet</p>
                          <p className="text-xs">Student coding submissions will appear here in real-time.</p>
                        </td>
                      </tr>
                    ) : (
                      contestSubmissions.map((sub) => {
                        const langInfo = getLanguageInfo(sub.languageId);
                        const isAccepted = sub.status === "Accepted";
                        const maxMarks = sub.contestQuestion?.marks ?? 100;

                        return (
                          <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                              {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-medium text-foreground">
                              {sub.user?.name || sub.user?.email || "Student"}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-foreground">
                                #{sub.contestQuestion?.questionOrder}:{" "}
                                {sub.contestQuestion?.version?.title || "Coding Problem"}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-muted text-2xs font-mono">
                                {langInfo.name}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold border ${
                                  isAccepted
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : sub.status === "Wrong Answer"
                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                }`}
                              >
                                <HugeiconsIcon
                                  icon={isAccepted ? CheckmarkCircle01Icon : AlertCircleIcon}
                                  className="size-3 shrink-0"
                                />
                                {sub.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-foreground">
                              {sub.scoreObtained} / {maxMarks}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs rounded-xl gap-1 px-2.5"
                                onClick={() =>
                                  setInspectingUser({
                                    userId: sub.userId,
                                    contestId,
                                    contestQuestionId: sub.contestQuestionId,
                                  })
                                }
                              >
                                <HugeiconsIcon icon={EyeIcon} className="size-3.5" />
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Participants */}
        {activeTab === "participants" && (
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4">
            <div>
              <h3 className="text-lg font-bold">Enrolled Participants ({participants.length})</h3>
              <p className="text-xs text-muted-foreground">
                All students who have joined this contest and their progress.
              </p>
            </div>

            <div className="rounded-2xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="bg-muted/40 border-b border-border/40 text-2xs uppercase tracking-wider font-bold text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Joined</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Solved Coding</th>
                      <th className="py-3 px-4 text-center">Code Submissions</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-center">Rank</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {isParticipantsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <Spinner className="size-6 mx-auto" />
                          <p className="text-xs text-muted-foreground mt-2">Loading participants...</p>
                        </td>
                      </tr>
                    ) : participants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-1">
                          <HugeiconsIcon icon={UserGroupIcon} className="size-8 mx-auto opacity-40" />
                          <p className="font-semibold text-foreground text-sm">No participants yet</p>
                          <p className="text-xs">Students will appear here once they join using the contest code.</p>
                        </td>
                      </tr>
                    ) : (
                      participants.map((p) => {
                        const isFinished = !!p.finishedAt;
                        const isStarted = !!p.startedAt;

                        return (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xs shrink-0">
                                  {p.user?.name ? p.user.name.charAt(0).toUpperCase() : <HugeiconsIcon icon={UserIcon} className="size-3" />}
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground text-xs leading-none">
                                    {p.user?.name || "Student"}
                                  </div>
                                  <div className="text-2xs text-muted-foreground mt-0.5">
                                    {p.user?.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                              {formatDistanceToNow(new Date(p.joinedAt), { addSuffix: true })}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`text-2xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                  isFinished
                                    ? "bg-muted text-muted-foreground border-border/40"
                                    : isStarted
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                }`}
                              >
                                {isFinished ? "Finished" : isStarted ? "In Progress" : "Not Started"}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-center font-bold font-mono">
                              {p.solvedQuestionsCount}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-center font-mono">
                              {p.codeSubmissionsCount}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-foreground">
                              {p.score} pts
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-center font-mono font-bold">
                              {p.rank ? `#${p.rank}` : "—"}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs rounded-xl gap-1 px-2.5"
                                onClick={() =>
                                  setInspectingUser({
                                    userId: p.userId,
                                    contestId,
                                  })
                                }
                              >
                                <HugeiconsIcon icon={EyeIcon} className="size-3.5" />
                                Submissions
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <QuestionPickerDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        contestId={contestId}
        existingQuestionIds={contestData.questions.map((q) => q.questionId || q.id)}
        onQuestionAdded={() => refetch()}
      />

      <StudentSubmissionsDrawer
        isOpen={!!inspectingUser}
        onOpenChange={(open) => !open && setInspectingUser(null)}
        contestId={inspectingUser?.contestId ?? ""}
        userId={inspectingUser?.userId ?? null}
        initialContestQuestionId={inspectingUser?.contestQuestionId}
      />
    </div>
  );
}
