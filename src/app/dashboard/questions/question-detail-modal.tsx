"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";
import { getUserRoles } from "@/lib/get-user-roles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { QuestionStatusBadge } from "@/components/questions/question-status-badge";
import { ReviewDiscussionThread } from "@/components/questions/review-discussion-thread";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  SentIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  CodeIcon,
  HourglassIcon,
  ViewIcon,
  Cancel01Icon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface QuestionDetailModalProps {
  questionId: string | null;
  open: boolean;
  onClose: () => void;
  onSubmitForReview?: (questionId: string) => void;
  onEditDraft?: (question: any) => void;
}

export function QuestionDetailModal({
  questionId,
  open,
  onClose,
  onSubmitForReview,
  onEditDraft,
}: QuestionDetailModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const roles = getUserRoles(session?.user);
  const isAdmin = roles.includes("admin");

  const [viewMode, setViewMode] = useState<"split" | "spec" | "review">("split");
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [adminComment, setAdminComment] = useState("");

  // Admin lifecycle dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreComment, setRestoreComment] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);

  const directApproveMutation = useMutation(
    trpc.questionBank.directApproveDraft.mutationOptions({
      onSuccess: () => {
        toast.success("Question approved and published to Question Bank!");
        queryClient.invalidateQueries(trpc.questionBank.listMyQuestions.pathFilter());
        queryClient.invalidateQueries(trpc.questionBank.listQuestionBank.pathFilter());
        setConfirmApproveOpen(false);
        setAdminComment("");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to directly approve question.");
      },
    })
  );

  const adminRejectMutation = useMutation(
    trpc.questionBank.adminReject.mutationOptions({
      onSuccess: () => {
        toast.success("Question has been rejected.");
        queryClient.invalidateQueries(trpc.questionBank.listMyQuestions.pathFilter());
        queryClient.invalidateQueries(trpc.questionBank.listQuestionBank.pathFilter());
        setRejectDialogOpen(false);
        setRejectReason("");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to reject question.");
      },
    })
  );

  const adminRestoreMutation = useMutation(
    trpc.questionBank.adminRestoreToDraft.mutationOptions({
      onSuccess: () => {
        toast.success("Question restored to DRAFT. Creator can now edit and resubmit.");
        queryClient.invalidateQueries(trpc.questionBank.listMyQuestions.pathFilter());
        setRestoreDialogOpen(false);
        setRestoreComment("");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to restore question.");
      },
    })
  );

  const archiveMutation = useMutation(
    trpc.questionBank.archiveQuestion.mutationOptions({
      onSuccess: () => {
        toast.success("Question archived and hidden from future contests.");
        queryClient.invalidateQueries(trpc.questionBank.listMyQuestions.pathFilter());
        queryClient.invalidateQueries(trpc.questionBank.listQuestionBank.pathFilter());
        setArchiveDialogOpen(false);
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to archive question.");
      },
    })
  );

  const unarchiveMutation = useMutation(
    trpc.questionBank.unarchiveQuestion.mutationOptions({
      onSuccess: () => {
        toast.success("Question unarchived and returned to active Question Bank!");
        queryClient.invalidateQueries(trpc.questionBank.listMyQuestions.pathFilter());
        queryClient.invalidateQueries(trpc.questionBank.listQuestionBank.pathFilter());
        setUnarchiveDialogOpen(false);
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to unarchive question.");
      },
    })
  );

  const { data: q, isLoading, refetch } = useQuery(
    trpc.questionBank.getQuestion.queryOptions(
      { id: questionId! },
      { enabled: Boolean(questionId) && open }
    )
  );

  if (!open || !questionId) return null;

  // Active or latest assignment
  const latestAssignment = q?.assignments?.[0];
  const commentCount =
    q?.assignments?.reduce((acc, a) => acc + (a.comments?.length || 0), 0) || 0;

  const draft = (q?.currentDraft as any) || {};
  const currentVersion = q?.currentVersion;
  const displayTitle = currentVersion?.title || draft?.title || "Untitled Question";
  const displayDescription = currentVersion?.description || draft?.description || "";
  const displayHint = currentVersion?.hint || draft?.hint;
  const displayScore = currentVersion?.questionScore || draft?.questionScore || 10;
  const displayOptions = currentVersion?.options || draft?.options;
  const displayCorrectOption = currentVersion?.correctOptionId || draft?.correctOptionId;
  const displayTestCases = currentVersion?.testCases || draft?.testCases;
  const timeLimit = currentVersion?.timeLimit ?? draft?.timeLimit ?? 5;
  const memoryLimit = currentVersion?.memoryLimit ?? draft?.memoryLimit ?? 128000;

  // Sub-component: Question Specification Panel
  const renderQuestionSpec = () => (
    <div className="space-y-6">
      {/* Description with Markdown & Images */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Description & Problem Statement
        </h4>
        <div className="rounded-2xl border border-border/30 bg-muted/15 p-5 shadow-2xs">
          {displayDescription ? (
            <MarkdownRenderer content={displayDescription} />
          ) : (
            <p className="text-xs italic text-muted-foreground">No description provided.</p>
          )}
        </div>
      </div>

      {/* Coding Constraints & Test Cases */}
      {q?.questionType === "code" && (
        <div className="space-y-4">
          <div className="flex gap-6 text-xs text-muted-foreground bg-muted/20 p-4 rounded-2xl border border-border/30">
            <div>
              <span className="font-bold text-foreground">Time Limit:</span> {timeLimit}s
            </div>
            <div>
              <span className="font-bold text-foreground">Memory Limit:</span> {Math.round(memoryLimit / 1000)} MB
            </div>
          </div>

          {/* Starter Code */}
          {draft?.starterCode && draft.starterCode["71"] && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={CodeIcon} className="size-3.5 text-primary" />
                Starter Code (Python 3)
              </h4>
              <pre className="p-4 rounded-2xl bg-muted/30 border border-border/30 font-mono text-xs overflow-x-auto text-foreground/90">
                {draft.starterCode["71"]}
              </pre>
            </div>
          )}

          {/* Test cases */}
          {displayTestCases && displayTestCases.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Configured Test Cases ({displayTestCases.length})
              </h4>
              <div className="space-y-2.5">
                {displayTestCases.map((tc: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-xl bg-muted/20 border border-border/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-2xs font-bold text-muted-foreground">
                      <span>Test Case #{i + 1}</span>
                      {tc.isSample && (
                        <Badge variant="outline" className="text-3xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                          Sample (Visible to Contestant)
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-2xs">
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground font-bold">Input:</span>
                        <pre className="p-2 rounded-lg bg-background/60 border border-border/20 overflow-x-auto max-h-24">{tc.input || "<empty>"}</pre>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground font-bold">Expected Output:</span>
                        <pre className="p-2 rounded-lg bg-background/60 border border-border/20 overflow-x-auto max-h-24">{tc.expectedOutput}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MCQ Options */}
      {q?.questionType === "mcq" && displayOptions && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            MCQ Options
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {displayOptions.map((opt: any, idx: number) => {
              const isCorrect = opt.id === displayCorrectOption;
              return (
                <div
                  key={opt.id || idx}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium ${
                    isCorrect
                      ? "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400 font-semibold"
                      : "bg-muted/15 border-border/30 text-foreground"
                  }`}
                >
                  <span>{opt.text}</span>
                  {isCorrect && (
                    <span className="text-3xs font-bold uppercase px-2 py-0.5 rounded bg-green-500/20 text-green-500">
                      Correct Answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Numerical / Short Answer */}
      {q?.questionType === "text" && displayCorrectOption && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Correct Answer
          </h4>
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-xs font-mono font-bold text-green-400">
            {displayCorrectOption}
          </div>
        </div>
      )}

      {/* Hint */}
      {displayHint && (
        <div className="space-y-1 p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs">
          <span className="font-bold text-purple-400 text-2xs uppercase">Hint</span>
          <p className="text-muted-foreground italic">{displayHint}</p>
        </div>
      )}
    </div>
  );

  // Sub-component: Review & Conversation Panel
  const renderReviewThread = () => (
    <ReviewDiscussionThread
      questionId={questionId}
      assignmentId={latestAssignment?.id}
      creatorId={q?.createdById}
      questionStatus={q?.status}
      assignmentStatus={latestAssignment?.status}
      onCommentAdded={() => refetch()}
      onSubmitForReview={
        onSubmitForReview
          ? (id) => {
              onClose();
              onSubmitForReview(id);
            }
          : undefined
      }
      onEditDraft={
        onEditDraft && q
          ? () => {
              onClose();
              onEditDraft(q);
            }
          : undefined
      }
      isAdmin={isAdmin}
      onDirectApprove={() => setConfirmApproveOpen(true)}
      isDirectApproving={directApproveMutation.isPending}
    />
  );

  const canDirectApprove =
    isAdmin &&
    Boolean(
      q?.status &&
        ["DRAFT", "CHANGES_REQUESTED", "SUBMITTED_FOR_REVIEW", "UNDER_REVIEW"].includes(
          q.status
        )
    );

  const handleConfirmDirectApprove = () => {
    if (!questionId) return;
    directApproveMutation.mutate({
      questionId,
      comment: adminComment.trim() || undefined,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!w-[96vw] !max-w-[1550px] sm:!max-w-[1550px] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-background border border-border/50 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/40 bg-card/60 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="uppercase text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                  {q?.questionType || "question"}
                </span>
                <QuestionStatusBadge status={q?.status} />
                {q?.currentVersion && (
                  <code className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                    v{q.currentVersion.version}
                  </code>
                )}
                {q?.difficulty && (
                  <span className="capitalize text-2xs font-semibold text-muted-foreground">
                    • {q.difficulty}
                  </span>
                )}
                {q?.category?.name && (
                  <span className="text-2xs text-muted-foreground">
                    • {q.category.name}
                  </span>
                )}
                <span className="text-2xs font-bold text-muted-foreground">
                  • {displayScore} pts
                </span>
              </div>
              <DialogTitle className="text-xl font-bold text-foreground line-clamp-1">
                {displayTitle}
              </DialogTitle>
            </div>

            {/* View Mode Switcher and Admin Actions */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              {/* Creator Edit Draft Button */}
              {(q?.status === "DRAFT" || q?.status === "CHANGES_REQUESTED") &&
                (q?.createdById === session?.user?.id || isAdmin) &&
                onEditDraft && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onEditDraft(q);
                    }}
                    className="rounded-xl gap-1.5 text-amber-500 hover:bg-amber-500/10 border-amber-500/30 text-xs font-semibold"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
                    Edit Draft
                  </Button>
                )}

              {canDirectApprove && (
                <Button
                  size="sm"
                  onClick={() => setConfirmApproveOpen(true)}
                  disabled={directApproveMutation.isPending}
                  className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                >
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                  Approve to Question Bank
                </Button>
              )}

              {/* Admin Reject Button */}
              {isAdmin &&
                Boolean(
                  q?.status &&
                    ["DRAFT", "CHANGES_REQUESTED", "SUBMITTED_FOR_REVIEW", "UNDER_REVIEW", "APPROVED"].includes(
                      q.status
                    )
                ) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectReason("");
                      setRejectDialogOpen(true);
                    }}
                    className="rounded-xl gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30 text-xs font-semibold"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                    Reject
                  </Button>
                )}

              {/* Admin Restore to Draft Button */}
              {isAdmin && q?.status === "REJECTED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRestoreComment("");
                    setRestoreDialogOpen(true);
                  }}
                  className="rounded-xl gap-1.5 text-amber-500 hover:bg-amber-500/10 border-amber-500/30 text-xs font-semibold"
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
                  Restore to Draft
                </Button>
              )}

              {/* Admin Archive Button */}
              {isAdmin && q?.status === "APPROVED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setArchiveDialogOpen(true)}
                  className="rounded-xl gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-500/10 border-zinc-500/30 text-xs font-semibold"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  Archive
                </Button>
              )}

              {/* Admin Unarchive Button */}
              {isAdmin && q?.status === "ARCHIVED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUnarchiveDialogOpen(true)}
                  className="rounded-xl gap-1.5 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/30 text-xs font-semibold"
                >
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                  Unarchive to Bank
                </Button>
              )}

              <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`hidden lg:flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "split"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
                Split View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("review")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "review"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={Comment01Icon} className="size-3.5 text-purple-500" />
                Review & Feedback
                {commentCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-3xs font-mono bg-purple-500/20 text-purple-400">
                    {commentCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("spec")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "spec"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
                Question Details
              </button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden p-6">
            {/* ─── SPLIT VIEW (DEFAULT ON WIDESCREEN) ─── */}
            {viewMode === "split" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0 overflow-hidden">
                {/* Left: Question Specifications (7 Columns) */}
                <div className="lg:col-span-7 h-full overflow-y-auto pr-3 space-y-6">
                  {renderQuestionSpec()}
                </div>

                {/* Right: Review Conversation Thread & Actions (5 Columns) */}
                <div className="lg:col-span-5 h-full overflow-y-auto pl-4 border-t lg:border-t-0 lg:border-l border-border/40 space-y-6">
                  {renderReviewThread()}
                </div>
              </div>
            )}

            {/* ─── REVIEW ONLY ─── */}
            {viewMode === "review" && (
              <div className="max-w-4xl mx-auto h-full overflow-y-auto px-4">
                {renderReviewThread()}
              </div>
            )}

            {/* ─── QUESTION SPEC ONLY ─── */}
            {viewMode === "spec" && (
              <div className="max-w-4xl mx-auto h-full overflow-y-auto px-4">
                {renderQuestionSpec()}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Direct Approval Confirmation Dialog */}
    <AlertDialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
      <AlertDialogContent className="rounded-3xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground font-bold">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-emerald-500" />
            Approve to Question Bank?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed pt-2">
            This will approve the current draft and create an immutable question version. Any active peer-review assignment will be cancelled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            Optional Admin Review Note
          </label>
          <Textarea
            placeholder="e.g., Reviewed and verified by Admin. Ready for contest."
            value={adminComment}
            onChange={(e) => setAdminComment(e.target.value)}
            className="rounded-xl text-xs bg-muted/20 resize-none h-20"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={directApproveMutation.isPending}
            className="rounded-xl text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDirectApprove}
            disabled={directApproveMutation.isPending}
            className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {directApproveMutation.isPending ? "Approving..." : "Confirm & Approve"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Admin Reject Dialog */}
    <AlertDialog
      open={rejectDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setRejectDialogOpen(false);
          setRejectReason("");
        }
      }}
    >
      <AlertDialogContent className="rounded-3xl border border-destructive/30 max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
            <AlertDialogTitle>Reject Question</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
            Rejecting this question cancels any active peer-reviews and marks it as REJECTED. It will not appear in the Question Bank for future contests. As an admin, you can later restore it to DRAFT for creator revisions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-2xs font-semibold text-foreground uppercase tracking-wider">
            Reason for Rejection <span className="text-destructive">*</span>
          </label>
          <Textarea
            placeholder="Specify why this question is being rejected (e.g., ambiguous problem statement, incorrect test cases)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="rounded-xl text-xs bg-muted/20 resize-none h-24"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={adminRejectMutation.isPending}
            className="rounded-xl text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!questionId || !rejectReason.trim()) {
                toast.error("Please provide a rejection reason.");
                return;
              }
              adminRejectMutation.mutate({
                questionId,
                reason: rejectReason.trim(),
              });
            }}
            disabled={adminRejectMutation.isPending || !rejectReason.trim()}
            className="rounded-xl text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
          >
            {adminRejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Admin Restore to Draft Dialog */}
    <AlertDialog
      open={restoreDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setRestoreDialogOpen(false);
          setRestoreComment("");
        }
      }}
    >
      <AlertDialogContent className="rounded-3xl border border-amber-500/30 max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-5" />
            <AlertDialogTitle>Restore Question to Draft</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
            This will move the question from REJECTED back to DRAFT. The author can edit the problem statement, test cases, and options in Question Studio and re-submit for review.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            Revision Guidance Note (Optional)
          </label>
          <Textarea
            placeholder="e.g., Creator please clarify the expected output format for sample test case 1..."
            value={restoreComment}
            onChange={(e) => setRestoreComment(e.target.value)}
            className="rounded-xl text-xs bg-muted/20 resize-none h-20"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={adminRestoreMutation.isPending}
            className="rounded-xl text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!questionId) return;
              adminRestoreMutation.mutate({
                questionId,
                comment: restoreComment.trim() || undefined,
              });
            }}
            disabled={adminRestoreMutation.isPending}
            className="rounded-xl text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            {adminRestoreMutation.isPending ? "Restoring..." : "Restore to Draft"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Admin Archive Dialog */}
    <AlertDialog
      open={archiveDialogOpen}
      onOpenChange={(open) => {
        if (!open) setArchiveDialogOpen(false);
      }}
    >
      <AlertDialogContent className="rounded-3xl border border-border/50 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <HugeiconsIcon icon={Delete02Icon} className="size-5" />
            <AlertDialogTitle>Archive Question</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
            Archiving hides this question from future contest creation in the Question Bank without deleting it. Existing contests using this question will remain unaffected. You can unarchive it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={archiveMutation.isPending}
            className="rounded-xl text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!questionId) return;
              archiveMutation.mutate({ questionId });
            }}
            disabled={archiveMutation.isPending}
            className="rounded-xl text-xs bg-zinc-700 hover:bg-zinc-800 text-white font-semibold"
          >
            {archiveMutation.isPending ? "Archiving..." : "Archive Question"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Admin Unarchive Dialog */}
    <AlertDialog
      open={unarchiveDialogOpen}
      onOpenChange={(open) => {
        if (!open) setUnarchiveDialogOpen(false);
      }}
    >
      <AlertDialogContent className="rounded-3xl border border-emerald-500/30 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-emerald-500">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
            <AlertDialogTitle>Unarchive to Question Bank</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
            This will restore the question directly to APPROVED status in the Question Bank. It will immediately be available for selection in contests.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={unarchiveMutation.isPending}
            className="rounded-xl text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!questionId) return;
              unarchiveMutation.mutate({ questionId });
            }}
            disabled={unarchiveMutation.isPending}
            className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {unarchiveMutation.isPending ? "Restoring..." : "Confirm & Unarchive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
