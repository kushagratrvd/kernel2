"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
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
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  SentIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  CodeIcon,
  HourglassIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface QuestionDetailModalProps {
  questionId: string | null;
  open: boolean;
  onClose: () => void;
  onSubmitForReview?: (questionId: string) => void;
}

export function QuestionDetailModal({
  questionId,
  open,
  onClose,
  onSubmitForReview,
}: QuestionDetailModalProps) {
  const trpc = useTRPC();
  const [viewMode, setViewMode] = useState<"split" | "spec" | "review">("split");
  const [replyMessage, setReplyMessage] = useState("");

  const { data: q, isLoading, refetch } = useQuery(
    trpc.questionBank.getQuestion.queryOptions(
      { id: questionId! },
      { enabled: Boolean(questionId) && open }
    )
  );

  // Add Comment Mutation
  const addCommentMutation = useMutation(
    trpc.questionBank.addComment.mutationOptions({
      onSuccess: () => {
        setReplyMessage("");
        toast.success("Reply posted to review thread.");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  if (!open || !questionId) return null;

  // Active or latest assignment
  const latestAssignment = q?.assignments?.[0];
  const allComments = q?.assignments?.flatMap((a) =>
    (a.comments || []).map((c) => ({
      ...c,
      assignmentStatus: a.status,
      reviewerId: a.reviewerId,
    }))
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) || [];

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

  const handleSendReply = async () => {
    if (!latestAssignment || !replyMessage.trim()) return;
    await addCommentMutation.mutateAsync({
      questionId,
      assignmentId: latestAssignment.id,
      message: replyMessage.trim(),
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-2xs font-bold uppercase">Approved</Badge>;
      case "CHANGES_REQUESTED":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-2xs font-bold uppercase">Changes Requested</Badge>;
      case "UNDER_REVIEW":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-2xs font-bold uppercase">Under Review</Badge>;
      case "SUBMITTED_FOR_REVIEW":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-2xs font-bold uppercase">Submitted</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-2xs font-bold uppercase">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground text-2xs font-bold uppercase">Draft</Badge>;
    }
  };

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
    <div className="space-y-5">
      {/* State Guidance Banner */}
      {q?.status === "CHANGES_REQUESTED" && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            Changes Requested by Reviewer
          </div>
          <p className="text-xs text-amber-400/90 leading-relaxed">
            The reviewer requested adjustments before this question can be approved.
            Read the comments below and re-submit when updated.
          </p>
          {onSubmitForReview && (
            <div className="pt-1.5">
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onSubmitForReview(questionId);
                }}
                className="rounded-xl gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                <HugeiconsIcon icon={SentIcon} className="size-3.5" />
                Re-submit Question to Reviewer
              </Button>
            </div>
          )}
        </div>
      )}

      {q?.status === "APPROVED" && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-green-500 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-green-400">Question Approved</h4>
            <p className="text-xs text-green-400/80">
              Verified and approved by the reviewer. Live in the Question Bank for contests.
            </p>
          </div>
        </div>
      )}

      {q?.status === "UNDER_REVIEW" && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-center gap-3">
          <HugeiconsIcon icon={HourglassIcon} className="size-5 text-blue-500 shrink-0 animate-pulse" />
          <div>
            <h4 className="text-sm font-bold text-blue-400">Currently Under Review</h4>
            <p className="text-xs text-blue-400/80">
              {latestAssignment?.reviewer?.name || latestAssignment?.reviewer?.email || "A reviewer"} is reviewing this question.
            </p>
          </div>
        </div>
      )}

      {q?.status === "SUBMITTED_FOR_REVIEW" && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 flex items-center gap-3">
          <HugeiconsIcon icon={HourglassIcon} className="size-5 text-purple-500 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-purple-400">Submitted for Review</h4>
            <p className="text-xs text-purple-400/80">
              Assigned to {latestAssignment?.reviewer?.name || latestAssignment?.reviewer?.email || "reviewer"}. Waiting for pickup.
            </p>
          </div>
        </div>
      )}

      {q?.status === "DRAFT" && (
        <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">Working Draft</h4>
            <p className="text-xs text-muted-foreground">
              Not yet submitted for review.
            </p>
          </div>
          {onSubmitForReview && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onSubmitForReview(questionId);
              }}
              className="rounded-xl gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <HugeiconsIcon icon={SentIcon} className="size-3.5" />
              Submit for Review
            </Button>
          )}
        </div>
      )}

      {/* Reviewer Assignment Meta */}
      {latestAssignment && (
        <div className="rounded-2xl border border-border/30 bg-muted/15 p-3.5 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="text-3xs uppercase font-bold text-muted-foreground tracking-wider">Reviewer</span>
            <p className="font-semibold text-foreground">
              {latestAssignment.reviewer?.name || latestAssignment.reviewer?.email || "Unassigned"}
            </p>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-3xs uppercase font-bold text-muted-foreground tracking-wider">Status</span>
            <p className="font-mono font-semibold text-foreground">{latestAssignment.status}</p>
          </div>
        </div>
      )}

      {/* Conversation Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <HugeiconsIcon icon={Comment01Icon} className="size-4" />
          Review Discussion ({allComments.length})
        </h4>

        {allComments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">No comments in this thread yet.</p>
            <p className="text-3xs">Reviewer notes, requested changes, and answers will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {allComments.map((c, idx) => {
              const isCreator = c.user?.id === q?.createdById;
              const formattedDate = new Date(c.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={c.id || idx}
                  className={`rounded-2xl p-4 border transition-all ${
                    isCreator
                      ? "bg-muted/20 border-border/40 ml-4"
                      : "bg-purple-500/5 border-purple-500/20 mr-4"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">
                        {c.user?.name || c.user?.email || "Unknown User"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-3xs px-1.5 py-0 font-bold ${
                          isCreator
                            ? "bg-muted text-muted-foreground"
                            : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        {isCreator ? "Creator" : "Reviewer"}
                      </Badge>
                    </div>
                    <span className="text-3xs font-mono text-muted-foreground">
                      {formattedDate}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {c.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply Form */}
      {latestAssignment && (
        <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3 shadow-xs">
          <span className="text-xs font-semibold text-foreground">Reply to Reviewer</span>
          <Textarea
            placeholder="Type your reply or explanation for the reviewer..."
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            rows={3}
            className="rounded-xl resize-none text-xs"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={addCommentMutation.isPending || !replyMessage.trim()}
              onClick={handleSendReply}
              className="rounded-xl gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {addCommentMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : (
                <HugeiconsIcon icon={SentIcon} className="size-3.5" />
              )}
              Send Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
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
                {getStatusBadge(q?.status)}
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

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40 self-start sm:self-auto shrink-0">
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
                {allComments.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-3xs font-mono bg-purple-500/20 text-purple-400">
                    {allComments.length}
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
  );
}
