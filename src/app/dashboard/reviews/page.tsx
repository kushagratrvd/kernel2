"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Task01Icon,
  Comment01Icon,
  SentIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";

function ReviewDeskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  const [activeTab, setActiveTab] = useState<"assigned" | "history">("assigned");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    searchParams?.get("assignmentId") || null
  );

  // Modals for actions
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [actionComment, setActionComment] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  // Queries
  const { data: assignedList, isLoading: isAssignedLoading, refetch: refetchAssigned } = useQuery(
    trpc.questionBank.listAssigned.queryOptions({})
  );

  const { data: historyList, isLoading: isHistoryLoading } = useQuery(
    trpc.questionBank.listHistory.queryOptions()
  );

  // Mutations
  const pickUpMutation = useMutation(
    trpc.questionBank.pickUpForReview.mutationOptions({
      onSuccess: () => refetchAssigned(),
    })
  );

  const approveMutation = useMutation(
    trpc.questionBank.approve.mutationOptions({
      onSuccess: () => {
        refetchAssigned();
      },
    })
  );

  const requestChangesMutation = useMutation(
    trpc.questionBank.requestChanges.mutationOptions({
      onSuccess: () => {
        setIsChangesModalOpen(false);
        setActionComment("");
        refetchAssigned();
      },
    })
  );

  const rejectMutation = useMutation(
    trpc.questionBank.reject.mutationOptions({
      onSuccess: () => {
        setIsRejectModalOpen(false);
        setActionComment("");
        refetchAssigned();
      },
    })
  );

  const addCommentMutation = useMutation(
    trpc.questionBank.addComment.mutationOptions({
      onSuccess: () => {
        setReplyMessage("");
        refetchAssigned();
      },
    })
  );

  const currentList = activeTab === "assigned" ? assignedList : historyList;
  const currentAssignment = currentList?.find(
    (a) => a.id === selectedAssignmentId
  ) || currentList?.[0];

  // Extract jsonb unknown fields into typed variables to satisfy ReactNode constraints
  const versionDescription: string = String(currentAssignment?.version?.description ?? "");
  const versionHint: string = String(currentAssignment?.version?.hint ?? "") || "None provided";
  const versionScore: number = Number(currentAssignment?.version?.questionScore ?? 0);

  const handlePickUp = async (assignmentId: string) => {
    await pickUpMutation.mutateAsync({ assignmentId });
  };

  const handleApprove = async (assignmentId: string) => {
    if (confirm("Are you sure you want to APPROVE this question into the official question bank?")) {
      await approveMutation.mutateAsync({ assignmentId });
    }
  };

  const handleRequestChanges = async () => {
    if (!currentAssignment || !actionComment.trim()) {
      alert("Please provide the correction instructions.");
      return;
    }
    await requestChangesMutation.mutateAsync({
      assignmentId: currentAssignment.id,
      comment: actionComment.trim(),
    });
  };

  const handleReject = async () => {
    if (!currentAssignment || !actionComment.trim()) {
      alert("Please provide the rejection reason.");
      return;
    }
    await rejectMutation.mutateAsync({
      assignmentId: currentAssignment.id,
      comment: actionComment.trim(),
    });
  };

  const handleSendComment = async () => {
    if (!currentAssignment || !replyMessage.trim()) return;
    await addCommentMutation.mutateAsync({
      questionId: currentAssignment.questionId,
      assignmentId: currentAssignment.id,
      message: replyMessage.trim(),
    });
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="rounded-xl gap-1 text-xs"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back to Dashboard
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-base font-bold tracking-tight">Reviewer Desk</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-semibold">
            <button
              onClick={() => { setActiveTab("assigned"); setSelectedAssignmentId(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "assigned"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Assigned Reviews ({assignedList?.length || 0})
            </button>
            <button
              onClick={() => { setActiveTab("history"); setSelectedAssignmentId(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Review History ({historyList?.length || 0})
            </button>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Main Workspace (Split View) */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10">
        {isAssignedLoading || isHistoryLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Spinner className="size-8" />
          </div>
        ) : !currentList || currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-3xl p-16 text-center space-y-3">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-10 text-muted-foreground/40" />
            <h3 className="text-base font-bold">
              {activeTab === "assigned" ? "All Caught Up!" : "No Review History"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeTab === "assigned"
                ? "There are currently no review assignments waiting in your queue."
                : "Completed and closed reviews will be archived here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Queue List */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                {activeTab === "assigned" ? "Review Queue" : "Archived Reviews"}
              </h2>

              <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
                {currentList.map((a) => {
                  const isSelected = (currentAssignment?.id === a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAssignmentId(a.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/5 shadow-sm ring-1 ring-blue-500/30"
                          : "border-border/40 bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                          v{a.version?.version || 1}
                        </code>
                        <Badge
                          variant="outline"
                          className={`text-2xs font-bold uppercase ${
                            a.status === "IN_REVIEW"
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              : a.status === "COMPLETED"
                              ? "bg-green-500/10 text-green-500 border-green-500/30"
                              : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          }`}
                        >
                          {a.status}
                        </Badge>
                      </div>

                      <h4 className="font-bold text-sm text-foreground mt-2 line-clamp-1">
                        {a.version?.title || "Question Snapshot"}
                      </h4>

                      <div className="text-2xs text-muted-foreground mt-1 flex items-center justify-between">
                        <span>By {(a as any).assignedBy?.name || (a as any).assignedBy?.email || "Creator"}</span>
                        <span className="uppercase font-mono">{a.question?.questionType}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Question Snapshot Details & Action Panel */}
            {currentAssignment && (
              <div className="lg:col-span-8 rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
                {/* Header with actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="uppercase text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                        {currentAssignment.question?.questionType}
                      </span>
                      <code className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                        Version {currentAssignment.version?.version}
                      </code>
                      <Badge
                        variant="outline"
                        className={`text-2xs font-bold uppercase ${
                          currentAssignment.status === "IN_REVIEW"
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                            : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                        }`}
                      >
                        {currentAssignment.status}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-black text-foreground mt-2">
                      {currentAssignment.version?.title}
                    </h2>
                  </div>

                  {/* Actions for reviewer */}
                  {currentAssignment.status === "PENDING" && (
                    <Button
                      onClick={() => handlePickUp(currentAssignment.id)}
                      disabled={pickUpMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold gap-1 shadow-sm"
                    >
                      {pickUpMutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={Task01Icon} className="size-4" />}
                      Pick Up For Review
                    </Button>
                  )}

                  {currentAssignment.status === "IN_REVIEW" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(currentAssignment.id)}
                        disabled={approveMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold gap-1"
                      >
                        {approveMutation.isPending ? <Spinner className="size-3" /> : <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsChangesModalOpen(true)}
                        className="rounded-xl text-xs font-semibold text-amber-500 border-amber-500/30 hover:bg-amber-500/10 gap-1"
                      >
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
                        Request Changes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsRejectModalOpen(true)}
                        className="rounded-xl text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Question Description */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Description & Specifications
                  </h4>
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/30 text-sm whitespace-pre-wrap leading-relaxed">
                    {versionDescription}
                  </div>
                </div>

                {/* Optional Hint & Score */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-muted/15 border border-border/20 space-y-1">
                    <span className="font-bold text-muted-foreground uppercase text-2xs">Hint</span>
                    <p className="text-foreground">{versionHint}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/15 border border-border/20 space-y-1">
                    <span className="font-bold text-muted-foreground uppercase text-2xs">Score</span>
                    <p className="text-foreground font-bold">{versionScore} Points</p>
                  </div>
                </div>

                {/* MCQ Options */}
                {Boolean(currentAssignment.version?.options) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      MCQ Options
                    </h4>
                    <div className="space-y-2">
                      {(currentAssignment.version.options as any[]).map((opt, idx) => {
                        const isCorrect = opt.id === (currentAssignment.version?.correctOptionId as string | undefined);
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium ${
                              isCorrect
                                ? "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400"
                                : "bg-muted/10 border-border/30 text-foreground"
                            }`}
                          >
                            <span>{opt.text}</span>
                            {isCorrect && (
                              <span className="text-2xs font-bold uppercase px-2 py-0.5 rounded bg-green-500/20 text-green-500">
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Test Cases for Code Question */}
                {Boolean(currentAssignment.version?.testCases) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Configured Test Cases ({((currentAssignment.version.testCases as any[]) || []).length})
                    </h4>
                    <div className="space-y-2">
                      {(currentAssignment.version.testCases as any[]).map((tc, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/30 text-xs space-y-1">
                          <div className="flex items-center justify-between text-2xs font-bold text-muted-foreground">
                            <span>Test Case #{idx + 1}</span>
                            {tc.isSample && (
                              <Badge variant="outline" className="text-2xs bg-purple-500/10 text-purple-500 border-purple-500/30">
                                Sample (Student Visible)
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-2xs">
                            <div>Input: <span className="text-foreground font-semibold">{tc.input}</span></div>
                            <div>Expected: <span className="text-foreground font-semibold">{tc.expectedOutput}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Request Changes Modal */}
      <Dialog open={isChangesModalOpen} onOpenChange={setIsChangesModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Request Corrections from Creator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Provide feedback to the creator. The question will return to <strong>CHANGES REQUESTED</strong> status for their revision.
            </p>
            <Textarea
              placeholder="e.g. Please add edge test cases for empty strings and fix the hint wording..."
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={4}
              className="rounded-xl resize-none text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsChangesModalOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={requestChangesMutation.isPending || !actionComment.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold"
            >
              {requestChangesMutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />}
              Send Changes Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">Reject Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Provide the reason for rejecting this question.
            </p>
            <Textarea
              placeholder="e.g. Duplicate question already exists in question bank..."
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={4}
              className="rounded-xl resize-none text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !actionComment.trim()}
              className="rounded-xl text-xs font-semibold"
            >
              {rejectMutation.isPending ? <Spinner className="size-4" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ReviewDeskPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <Spinner className="size-8 text-neutral-400" />
        </div>
      }
    >
      <ReviewDeskContent />
    </Suspense>
  );
}
