"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  SentIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  HourglassIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface ReviewDiscussionThreadProps {
  questionId: string;
  assignmentId?: string | null;
  creatorId?: string | null;
  questionStatus?: string | null;
  assignmentStatus?: string | null;
  onCommentAdded?: () => void;
  onSubmitForReview?: (questionId: string) => void;
  onEditDraft?: (questionId: string) => void;
  isAdmin?: boolean;
  onDirectApprove?: () => void;
  isDirectApproving?: boolean;
  showBanner?: boolean;
  className?: string;
}

export function ReviewDiscussionThread({
  questionId,
  assignmentId,
  creatorId,
  questionStatus,
  assignmentStatus,
  onCommentAdded,
  onSubmitForReview,
  onEditDraft,
  isAdmin,
  onDirectApprove,
  isDirectApproving,
  showBanner = true,
  className = "",
}: ReviewDiscussionThreadProps) {
  const trpc = useTRPC();
  const [replyMessage, setReplyMessage] = useState("");

  const {
    data: reviewThread,
    isLoading: isThreadLoading,
    refetch: refetchThread,
  } = useQuery(
    trpc.questionBank.getReviewThread.queryOptions(
      { questionId },
      { enabled: Boolean(questionId) }
    )
  );

  const addCommentMutation = useMutation(
    trpc.questionBank.addComment.mutationOptions({
      onSuccess: () => {
        setReplyMessage("");
        toast.success("Reply sent to review discussion.");
        refetchThread();
        onCommentAdded?.();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const handleSendReply = async () => {
    if (!assignmentId || !replyMessage.trim()) return;
    await addCommentMutation.mutateAsync({
      questionId,
      assignmentId,
      message: replyMessage.trim(),
    });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Guidance Banner */}
      {showBanner && (
        <div className="p-4 border-b border-border/20 bg-muted/20">
          {questionStatus === "CHANGES_REQUESTED" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
                Changes Requested from Creator
              </div>
              <p className="text-2xs text-amber-400/90 leading-relaxed">
                Adjustments were requested according to the feedback messages below.
              </p>
              {(onEditDraft || onSubmitForReview) && (
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  {onEditDraft && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onEditDraft(questionId)}
                      className="rounded-xl gap-1 text-2xs font-semibold text-amber-500 hover:bg-amber-500/10 border-amber-500/30"
                    >
                      <HugeiconsIcon icon={PencilEdit02Icon} className="size-3" />
                      Edit Draft
                    </Button>
                  )}
                  {onSubmitForReview && (
                    <Button
                      size="xs"
                      onClick={() => onSubmitForReview(questionId)}
                      className="rounded-xl gap-1 text-2xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                    >
                      <HugeiconsIcon icon={SentIcon} className="size-3" />
                      Re-submit to Reviewer
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {questionStatus === "APPROVED" && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 flex items-center gap-2.5">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                className="size-4 text-green-500 shrink-0"
              />
              <div>
                <h5 className="text-xs font-bold text-green-400">Question Approved</h5>
                <p className="text-2xs text-green-400/80">
                  Approved into the question bank and available for contest builders.
                </p>
              </div>
            </div>
          )}

          {questionStatus === "REJECTED" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2.5">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-red-500 shrink-0" />
              <div>
                <h5 className="text-xs font-bold text-red-400">Question Rejected</h5>
                <p className="text-2xs text-red-400/80">
                  This question submission was rejected by the reviewer.
                </p>
              </div>
            </div>
          )}

          {questionStatus !== "CHANGES_REQUESTED" &&
            questionStatus !== "APPROVED" &&
            questionStatus !== "REJECTED" &&
            assignmentStatus === "IN_REVIEW" && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 flex items-center gap-2.5">
                <HugeiconsIcon
                  icon={HourglassIcon}
                  className="size-4 text-blue-500 shrink-0 animate-pulse"
                />
                <div>
                  <h5 className="text-xs font-bold text-blue-400">Under Review</h5>
                  <p className="text-2xs text-blue-400/80">
                    Review in progress. Check notes or finalize decision.
                  </p>
                </div>
              </div>
            )}

          {questionStatus !== "CHANGES_REQUESTED" &&
            questionStatus !== "APPROVED" &&
            questionStatus !== "REJECTED" &&
            assignmentStatus === "PENDING" && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 flex items-center gap-2.5">
                <HugeiconsIcon icon={HourglassIcon} className="size-4 text-yellow-500 shrink-0" />
                <div>
                  <h5 className="text-xs font-bold text-yellow-400">Waiting for Pickup</h5>
                  <p className="text-2xs text-yellow-400/80">
                    A reviewer has been assigned and will pick up this question.
                  </p>
                </div>
              </div>
            )}

          {/* Admin Direct Approval Option */}
          {isAdmin &&
            onDirectApprove &&
            questionStatus &&
            ["DRAFT", "CHANGES_REQUESTED", "SUBMITTED_FOR_REVIEW", "UNDER_REVIEW"].includes(
              questionStatus
            ) && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2 mt-2">
                <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
                  Admin Direct Approval Available
                </div>
                <p className="text-2xs text-emerald-400/90 leading-relaxed">
                  As an administrator, you can bypass peer review and approve this draft directly into the Question Bank.
                </p>
                <div className="pt-1">
                  <Button
                    size="xs"
                    onClick={onDirectApprove}
                    disabled={isDirectApproving}
                    className="rounded-xl gap-1 text-2xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
                    Approve to Question Bank
                  </Button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <HugeiconsIcon icon={Comment01Icon} className="size-3.5" />
            Review Discussion ({reviewThread?.length || 0})
          </span>
        </div>

        {isThreadLoading ? (
          <div className="flex py-12 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : !reviewThread || reviewThread.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">No comments in this thread yet.</p>
            <p className="text-3xs">
              Reviewer notes, requested changes, and creator replies will appear here.
            </p>
          </div>
        ) : (
          reviewThread.map((c) => {
            const isCreator = creatorId ? c.user?.id === creatorId : false;
            const formattedDate = new Date(c.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={c.id}
                className={`rounded-2xl p-3.5 border transition-all text-left ${
                  isCreator
                    ? "bg-muted/30 border-border/40 ml-2"
                    : "bg-purple-500/5 border-purple-500/20 mr-2"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
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
          })
        )}
      </div>

      {/* Reply Input Form */}
      {assignmentId && (
        <div className="p-4 border-t border-border/30 bg-background/80 backdrop-blur-md space-y-2.5">
          <span className="text-xs font-semibold text-foreground">
            Reply or Send Review Note
          </span>
          <Textarea
            placeholder="Type your response or clarification..."
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            rows={2}
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
}
