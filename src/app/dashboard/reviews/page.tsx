"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  HourglassIcon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  QuestionStatusBadge,
  ReviewAssignmentStatusBadge,
} from "@/components/questions/question-status-badge";
import { ReviewDiscussionThread } from "@/components/questions/review-discussion-thread";
import { toast } from "sonner";

function ReviewDeskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  const [activeTab, setActiveTab] = useState<"assigned" | "history">("assigned");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Selected assignment for the inspection & discussion modal
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    searchParams?.get("assignmentId") || null
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(
    Boolean(searchParams?.get("assignmentId"))
  );
  const [modalViewMode, setModalViewMode] = useState<"split" | "spec" | "chat">("split");

  // Action modals
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [actionComment, setActionComment] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const userRoles = ((session?.user as any)?.roles as string[]) || [];
  const userRole = (session?.user as any)?.role as string;
  const isAdmin = userRoles.includes("admin") || userRole === "admin";

  // Queries
  const {
    data: assignedList,
    isLoading: isAssignedLoading,
    refetch: refetchAssigned,
  } = useQuery(trpc.questionBank.listAssigned.queryOptions({}));

  const {
    data: historyList,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery(trpc.questionBank.listHistory.queryOptions());

  // Find active assignment
  const currentList = activeTab === "assigned" ? assignedList : historyList;
  const allAssignments = useMemo(() => {
    return [...(assignedList || []), ...(historyList || [])];
  }, [assignedList, historyList]);

  const activeAssignment = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return allAssignments.find((a) => a.id === selectedAssignmentId) || null;
  }, [selectedAssignmentId, allAssignments]);

  // Thread query for the selected question
  const {
    data: reviewThread,
    isLoading: isThreadLoading,
    refetch: refetchThread,
  } = useQuery(
    trpc.questionBank.getReviewThread.queryOptions(
      { questionId: activeAssignment?.questionId! },
      { enabled: Boolean(activeAssignment?.questionId && isDetailModalOpen) }
    )
  );

  // Mutations
  const pickUpMutation = useMutation(
    trpc.questionBank.pickUpForReview.mutationOptions({
      onSuccess: () => {
        toast.success("Question picked up for review.");
        refetchAssigned();
        refetchHistory();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const approveMutation = useMutation(
    trpc.questionBank.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Question approved and added to official Question Bank!");
        refetchAssigned();
        refetchHistory();
        refetchThread();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const requestChangesMutation = useMutation(
    trpc.questionBank.requestChanges.mutationOptions({
      onSuccess: () => {
        toast.success("Changes requested. Question moved to Review History.");
        setIsChangesModalOpen(false);
        setActionComment("");
        refetchAssigned();
        refetchHistory();
        refetchThread();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const rejectMutation = useMutation(
    trpc.questionBank.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Question rejected.");
        setIsRejectModalOpen(false);
        setActionComment("");
        refetchAssigned();
        refetchHistory();
        refetchThread();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const addCommentMutation = useMutation(
    trpc.questionBank.addComment.mutationOptions({
      onSuccess: () => {
        setReplyMessage("");
        toast.success("Reply sent to review discussion.");
        refetchThread();
        refetchAssigned();
        refetchHistory();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Filtered list for current tab
  const filteredList = useMemo(() => {
    if (!currentList) return [];
    let items = currentList;

    if (typeFilter !== "all") {
      items = items.filter((a) => a.question?.questionType === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((a) => {
        const title = (a.version?.title || "").toLowerCase();
        const desc = (a.version?.description || "").toLowerCase();
        const cat = (a.question?.category?.name || "").toLowerCase();
        const top = (a.question?.topic?.name || "").toLowerCase();
        const creator = (
          (a as any).assignedBy?.name ||
          (a as any).assignedBy?.email ||
          ""
        ).toLowerCase();
        const reviewer = (
          (a as any).reviewer?.name ||
          (a as any).reviewer?.email ||
          ""
        ).toLowerCase();
        return (
          title.includes(q) ||
          desc.includes(q) ||
          cat.includes(q) ||
          top.includes(q) ||
          creator.includes(q) ||
          reviewer.includes(q)
        );
      });
    }

    return items;
  }, [currentList, searchQuery, typeFilter]);

  // Handlers
  const handleOpenDetail = (assignment: any) => {
    setSelectedAssignmentId(assignment.id);
    setIsDetailModalOpen(true);
  };

  const handlePickUp = async (assignmentId: string) => {
    await pickUpMutation.mutateAsync({ assignmentId });
  };

  const handleApprove = async (assignmentId: string) => {
    if (confirm("Are you sure you want to APPROVE this question into the official question bank?")) {
      await approveMutation.mutateAsync({ assignmentId });
    }
  };

  const handleRequestChanges = async () => {
    if (!activeAssignment || !actionComment.trim()) {
      toast.error("Please provide instructions on what changes are required.");
      return;
    }
    await requestChangesMutation.mutateAsync({
      assignmentId: activeAssignment.id,
      comment: actionComment.trim(),
    });
  };

  const handleReject = async () => {
    if (!activeAssignment || !actionComment.trim()) {
      toast.error("Please provide the rejection reason.");
      return;
    }
    await rejectMutation.mutateAsync({
      assignmentId: activeAssignment.id,
      comment: actionComment.trim(),
    });
  };

  const isCurrentLoading = activeTab === "assigned" ? isAssignedLoading : isHistoryLoading;

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
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
          {isAdmin && (
            <Badge
              variant="outline"
              className="text-2xs bg-purple-500/10 text-purple-500 border-purple-500/30 font-bold px-2 py-0.5 ml-2"
            >
              Admin Oversight (All Reviewers)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab("assigned");
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "assigned"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Assigned Reviews ({assignedList?.length || 0})
            </button>
            <button
              onClick={() => {
                setActiveTab("history");
              }}
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

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 space-y-6">
        {/* Desk Header & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {activeTab === "assigned" ? "Assigned Review Queue" : "Review History & Decisions"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {activeTab === "assigned"
                ? "Inspect questions submitted by creators, provide feedback, request changes, or approve for contests."
                : "Historical log of questions reviewed by you or your review team."}
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-2.5">
            <Input
              placeholder="Search by title, creator, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-60 rounded-xl text-xs bg-muted/30"
            />
            <div className="flex items-center bg-muted/30 rounded-xl border border-border/40 p-0.5 text-xs">
              {(["all", "mcq", "code", "text"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-2xs font-bold uppercase transition-all ${
                    typeFilter === t
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isCurrentLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Spinner className="size-8" />
          </div>
        ) : !filteredList || filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-3xl p-16 text-center space-y-3">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-10 text-muted-foreground/40"
            />
            <h3 className="text-base font-bold">
              {searchQuery || typeFilter !== "all"
                ? "No matching questions found"
                : activeTab === "assigned"
                ? "All Caught Up!"
                : "No Review History Yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery || typeFilter !== "all"
                ? "Try adjusting your search terms or type filter to find questions."
                : activeTab === "assigned"
                ? "There are currently no review assignments waiting in your queue."
                : "Questions with requested changes, approvals, or rejections will be cataloged here."}
            </p>
          </div>
        ) : (
          /* Structured Table Form (Just like Dashboard) */
          <div className="overflow-hidden rounded-2xl border border-border/30 bg-card shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30 font-semibold text-muted-foreground text-xs">
                  <th className="p-4">Question Title</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Version</th>
                  <th className="p-4">Category / Topic</th>
                  <th className="p-4">Creator</th>
                  {isAdmin && <th className="p-4">Reviewer</th>}
                  <th className="p-4">
                    {activeTab === "assigned" ? "Assigned Date" : "Reviewed Date"}
                  </th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredList.map((a) => {
                  const commentCount = (a as any).comments?.length || 0;
                  const formattedDate = new Date(
                    activeTab === "history" && a.completedAt ? a.completedAt : a.assignedAt
                  ).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={a.id}
                      onClick={() => handleOpenDetail(a)}
                      className="hover:bg-muted/15 transition-colors cursor-pointer group"
                    >
                      {/* Question Title */}
                      <td className="p-4 font-semibold text-foreground">
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {a.version?.title || "Untitled Question"}
                          </span>
                          {a.version?.hint && (
                            <span className="text-3xs text-muted-foreground line-clamp-1 italic">
                              Hint: {a.version.hint}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-4">
                        <span className="uppercase text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                          {a.question?.questionType}
                        </span>
                      </td>

                      {/* Version */}
                      <td className="p-4">
                        <code className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          v{a.version?.version || 1}
                        </code>
                      </td>

                      {/* Category / Topic */}
                      <td className="p-4 text-xs text-muted-foreground">
                        {a.question?.category?.name || "General"}
                        {a.question?.topic?.name ? ` • ${a.question.topic.name}` : ""}
                      </td>

                      {/* Creator */}
                      <td className="p-4 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {(a as any).assignedBy?.name || "Creator"}
                          </p>
                          <p className="text-3xs text-muted-foreground truncate max-w-[140px]">
                            {(a as any).assignedBy?.email || ""}
                          </p>
                        </div>
                      </td>

                      {/* Admin Oversight Reviewer */}
                      {isAdmin && (
                        <td className="p-4 text-xs text-muted-foreground">
                          {(a as any).reviewer?.name || (a as any).reviewer?.email || "Reviewer"}
                        </td>
                      )}

                      {/* Date */}
                      <td className="p-4 text-xs text-muted-foreground font-mono">
                        {formattedDate}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <ReviewAssignmentStatusBadge assignment={a} tab={activeTab} />
                      </td>

                      {/* Action */}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {activeTab === "assigned" && a.status === "PENDING" && (
                            <Button
                              size="xs"
                              onClick={() => handlePickUp(a.id)}
                              disabled={pickUpMutation.isPending}
                              className="rounded-xl text-2xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1"
                            >
                              {pickUpMutation.isPending ? (
                                <Spinner className="size-3" />
                              ) : (
                                <HugeiconsIcon icon={Task01Icon} className="size-3" />
                              )}
                              Pick Up
                            </Button>
                          )}

                          {activeTab === "assigned" && a.status === "IN_REVIEW" && (
                            <Button
                              size="xs"
                              onClick={() => handleOpenDetail(a)}
                              className="rounded-xl text-2xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                            >
                              <HugeiconsIcon icon={ViewIcon} className="size-3" />
                              Review Question
                            </Button>
                          )}

                          {activeTab === "history" && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleOpenDetail(a)}
                              className="rounded-xl text-2xs font-semibold gap-1.5 hover:border-foreground/30"
                            >
                              <HugeiconsIcon icon={Comment01Icon} className="size-3 text-purple-500" />
                              View Review & Chat
                              {commentCount > 0 && (
                                <span className="bg-purple-500/10 text-purple-400 font-bold px-1.5 py-0.2 rounded-full text-3xs">
                                  {commentCount}
                                </span>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ─── Interactive Question Inspection & Review Discussion Modal ─── */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-[1550px] w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl">
          {activeAssignment && (
            <>
              {/* Modal Header */}
              <DialogHeader className="p-6 border-b border-border/30 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1.5 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="uppercase text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                      {activeAssignment.question?.questionType}
                    </span>
                    <code className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Version {activeAssignment.version?.version || 1}
                    </code>
                    <ReviewAssignmentStatusBadge
                      assignment={activeAssignment}
                      tab={activeTab}
                    />
                  </div>
                  <DialogTitle className="text-xl font-black text-foreground">
                    {activeAssignment.version?.title || "Question Snapshot"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Submitted by{" "}
                    <span className="font-semibold text-foreground">
                      {(activeAssignment as any).assignedBy?.name ||
                        (activeAssignment as any).assignedBy?.email ||
                        "Creator"}
                    </span>{" "}
                    • Assigned to{" "}
                    <span className="font-semibold text-foreground">
                      {(activeAssignment as any).reviewer?.name ||
                        (activeAssignment as any).reviewer?.email ||
                        "Reviewer"}
                    </span>
                  </p>
                </div>

                {/* Top Action Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/40 text-xs mr-2">
                    <button
                      onClick={() => setModalViewMode("split")}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all ${
                        modalViewMode === "split"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Split View
                    </button>
                    <button
                      onClick={() => setModalViewMode("spec")}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all ${
                        modalViewMode === "spec"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Spec Only
                    </button>
                    <button
                      onClick={() => setModalViewMode("chat")}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all ${
                        modalViewMode === "chat"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Chat ({reviewThread?.length || 0})
                    </button>
                  </div>

                  {/* Review Actions if IN_REVIEW */}
                  {activeAssignment.status === "IN_REVIEW" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(activeAssignment.id)}
                        disabled={approveMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-sm"
                      >
                        {approveMutation.isPending ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsChangesModalOpen(true)}
                        className="rounded-xl text-xs font-semibold text-amber-500 border-amber-500/30 hover:bg-amber-500/10 gap-1.5"
                      >
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
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

                  {activeAssignment.status === "PENDING" && (
                    <Button
                      size="sm"
                      onClick={() => handlePickUp(activeAssignment.id)}
                      disabled={pickUpMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-sm"
                    >
                      {pickUpMutation.isPending ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <HugeiconsIcon icon={Task01Icon} className="size-3.5" />
                      )}
                      Pick Up For Review
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border/30">
                {/* Left Column: Question Specifications */}
                {(modalViewMode === "split" || modalViewMode === "spec") && (
                  <div
                    className={`${
                      modalViewMode === "spec" ? "lg:col-span-12" : "lg:col-span-7"
                    } h-full overflow-y-auto p-6 space-y-6 text-left`}
                  >
                    {/* Problem Description with MarkdownRenderer */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Description & Problem Statement
                      </h4>
                      <div className="p-5 rounded-2xl bg-muted/15 border border-border/30 text-sm leading-relaxed">
                        <MarkdownRenderer
                          content={String(activeAssignment.version?.description || "No description provided.")}
                        />
                      </div>
                    </div>

                    {/* Hint & Score */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-xl bg-muted/15 border border-border/20 space-y-1">
                        <span className="font-bold text-muted-foreground uppercase text-2xs">Hint</span>
                        <p className="text-foreground">
                          {activeAssignment.version?.hint || "None provided"}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-muted/15 border border-border/20 space-y-1">
                        <span className="font-bold text-muted-foreground uppercase text-2xs">Score</span>
                        <p className="text-foreground font-bold">
                          {activeAssignment.version?.questionScore || 0} Points
                        </p>
                      </div>
                    </div>

                    {/* MCQ Options */}
                    {Boolean(activeAssignment.version?.options) && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Multiple Choice Options
                        </h4>
                        <div className="space-y-2">
                          {(activeAssignment.version.options as any[]).map((opt, idx) => {
                            const isCorrect =
                              opt.id ===
                              (activeAssignment.version?.correctOptionId as string | undefined);
                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
                                  isCorrect
                                    ? "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400"
                                    : "bg-muted/15 border-border/30 text-foreground"
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

                    {/* Coding Constraints & Test Cases */}
                    {activeAssignment.question?.questionType === "code" && (
                      <div className="space-y-4">
                        <div className="flex gap-6 text-xs text-muted-foreground bg-muted/20 p-4 rounded-2xl border border-border/30">
                          <div>
                            <span className="font-bold text-foreground">Time Limit:</span>{" "}
                            {activeAssignment.version?.timeLimit ?? 5}s
                          </div>
                          <div>
                            <span className="font-bold text-foreground">Memory Limit:</span>{" "}
                            {Math.round((activeAssignment.version?.memoryLimit ?? 128000) / 1000)} MB
                          </div>
                        </div>

                        {Boolean(activeAssignment.version?.testCases) && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Configured Test Cases (
                              {((activeAssignment.version.testCases as any[]) || []).length})
                            </h4>
                            <div className="space-y-2.5">
                              {(activeAssignment.version.testCases as any[]).map((tc, idx) => (
                                <div
                                  key={idx}
                                  className="p-3.5 rounded-xl bg-muted/20 border border-border/30 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-2xs font-bold text-muted-foreground">
                                    <span>Test Case #{idx + 1}</span>
                                    {tc.isSample && (
                                      <Badge
                                        variant="outline"
                                        className="text-3xs bg-purple-500/10 text-purple-400 border-purple-500/30"
                                      >
                                        Sample (Student Visible)
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-2xs">
                                    <div>
                                      Input:{" "}
                                      <span className="text-foreground font-semibold">
                                        {tc.input}
                                      </span>
                                    </div>
                                    <div>
                                      Expected:{" "}
                                      <span className="text-foreground font-semibold">
                                        {tc.expectedOutput}
                                      </span>
                                    </div>
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

                {/* Right Column: Review Discussion & Interactive Chat */}
                {(modalViewMode === "split" || modalViewMode === "chat") && (
                  <div
                    className={`${
                      modalViewMode === "chat" ? "lg:col-span-12" : "lg:col-span-5"
                    } h-full flex flex-col bg-muted/5`}
                  >
                    <ReviewDiscussionThread
                      questionId={activeAssignment.questionId}
                      assignmentId={activeAssignment.id}
                      creatorId={activeAssignment.question?.createdById}
                      questionStatus={activeAssignment.question?.status}
                      assignmentStatus={activeAssignment.status}
                      onCommentAdded={() => {
                        refetchAssigned();
                        refetchHistory();
                        refetchThread();
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Request Changes Modal ─── */}
      <Dialog open={isChangesModalOpen} onOpenChange={setIsChangesModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Request Corrections from Creator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-left">
            <p className="text-xs text-muted-foreground">
              Provide specific feedback to the creator. The question will return to{" "}
              <strong>CHANGES REQUESTED</strong> status for their revision and appear in your Review
              History.
            </p>
            <Textarea
              placeholder="e.g. Please add edge test cases for empty inputs and improve problem constraint explanations..."
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={4}
              className="rounded-xl resize-none text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsChangesModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={requestChangesMutation.isPending || !actionComment.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold"
            >
              {requestChangesMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
              )}
              Send Changes Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Modal ─── */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">
              Reject Question
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-left">
            <p className="text-xs text-muted-foreground">
              Provide the reason for rejecting this question. This will be saved in the review
              discussion.
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
            <Button
              variant="outline"
              onClick={() => setIsRejectModalOpen(false)}
              className="rounded-xl"
            >
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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Spinner className="size-8 text-neutral-400" />
        </div>
      }
    >
      <ReviewDeskContent />
    </Suspense>
  );
}
