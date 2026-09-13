"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AddCircleIcon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  FileQuestionMarkIcon,
  SentIcon,
  Delete02Icon,
  Comment01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";

type QuestionType = "mcq" | "text" | "code";
type Difficulty = "easy" | "medium" | "hard";

interface MCQOption {
  id: string;
  text: string;
}

interface TestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
}

function QuestionsStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  const [activeStatusTab, setActiveStatusTab] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(searchParams?.get("action") === "new");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedQuestionForSubmit, setSelectedQuestionForSubmit] = useState<string | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [submitComment, setSubmitComment] = useState<string>("");

  // Editor form state
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hint, setHint] = useState("");
  const [questionScore, setQuestionScore] = useState(100);
  const [categoryId, setCategoryId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");

  // MCQ state
  const [options, setOptions] = useState<MCQOption[]>([
    { id: "opt_a", text: "Option A" },
    { id: "opt_b", text: "Option B" },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState("opt_a");

  // Code state
  const [timeLimit, setTimeLimit] = useState(5);
  const [memoryLimit, setMemoryLimit] = useState(128000);
  const [starterPython, setStarterPython] = useState("# Write your solution\n");
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "1 2", expectedOutput: "3", isSample: true },
  ]);

  // Queries
  const { data: myQuestions, isLoading, refetch } = useQuery(
    trpc.questionBank.listMyQuestions.queryOptions({
      status: activeStatusTab === "ALL" ? undefined : activeStatusTab,
    })
  );

  const { data: categories } = useQuery(trpc.taxonomy.listCategories.queryOptions());
  const { data: reviewers } = useQuery(trpc.questionBank.listReviewers.queryOptions());

  // Mutations
  const createMutation = useMutation(
    trpc.questionBank.create.mutationOptions({
      onSuccess: () => {
        setIsCreateOpen(false);
        resetForm();
        refetch();
      },
    })
  );

  const submitMutation = useMutation(
    trpc.questionBank.submitForReview.mutationOptions({
      onSuccess: () => {
        setIsSubmitOpen(false);
        setSelectedQuestionForSubmit(null);
        setSelectedReviewerId("");
        setSubmitComment("");
        refetch();
      },
    })
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setHint("");
    setQuestionScore(100);
    setOptions([
      { id: "opt_a", text: "Option A" },
      { id: "opt_b", text: "Option B" },
    ]);
    setCorrectOptionId("opt_a");
    setTestCases([{ input: "1 2", expectedOutput: "3", isSample: true }]);
    setStarterPython("# Write your solution\n");
  };

  const handleCreateQuestion = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Please provide both a title and description.");
      return;
    }

    const draftPayload: any = {
      title: title.trim(),
      description: description.trim(),
      hint: hint.trim() || null,
      questionScore,
      timeLimit,
      memoryLimit,
    };

    if (questionType === "mcq") {
      draftPayload.options = options;
      draftPayload.correctOptionId = correctOptionId;
    } else if (questionType === "text") {
      draftPayload.correctOptionId = correctOptionId;
    } else if (questionType === "code") {
      draftPayload.allowedLanguages = [71]; // Python 3
      draftPayload.starterCode = { "71": starterPython };
      draftPayload.testCases = testCases;
    }

    await createMutation.mutateAsync({
      questionType,
      difficulty,
      categoryId: categoryId || null,
      topicId: topicId || null,
      draft: draftPayload,
    });
  };

  const handleOpenSubmit = (qId: string) => {
    setSelectedQuestionForSubmit(qId);
    setIsSubmitOpen(true);
  };

  const handleSubmitForReview = async () => {
    if (!selectedQuestionForSubmit || !selectedReviewerId) {
      alert("Please select a reviewer.");
      return;
    }

    await submitMutation.mutateAsync({
      questionId: selectedQuestionForSubmit,
      reviewerId: selectedReviewerId,
      comment: submitComment.trim() || undefined,
    });
  };

  const handleAddOption = () => {
    const newId = `opt_${Date.now().toString(36)}`;
    setOptions([...options, { id: newId, text: `Option ${options.length + 1}` }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return;
    const remaining = options.filter((o) => o.id !== id);
    setOptions(remaining);
    if (correctOptionId === id) {
      setCorrectOptionId(remaining[0]?.id || "");
    }
  };

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: "", expectedOutput: "", isSample: false }]);
  };

  const handleRemoveTestCase = (index: number) => {
    if (testCases.length <= 1) return;
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const filteredTopics = categories?.find((c) => c.id === categoryId)?.topics || [];

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
          <span className="text-base font-bold tracking-tight">
            Creator Question Studio
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-sm text-xs font-semibold"
          >
            <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
            New Question Draft
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Question Bank Repository</h1>
            <p className="text-xs text-muted-foreground">
              Create, edit, and submit verified questions for contests
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-semibold overflow-x-auto">
            {["ALL", "DRAFT", "SUBMITTED_FOR_REVIEW", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveStatusTab(tab)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeStatusTab === tab
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Question List */}
        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Spinner className="size-8" />
          </div>
        ) : myQuestions && myQuestions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myQuestions.map((q) => {
              const draft = q.currentDraft as any;
              return (
                <div
                  key={q.id}
                  className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-sm backdrop-blur-md space-y-4 hover:border-purple-500/40 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="uppercase text-2xs font-mono font-bold px-2 py-0.5 rounded bg-muted">
                        {q.questionType}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-2xs font-bold uppercase ${
                          q.status === "APPROVED"
                            ? "bg-green-500/10 text-green-500 border-green-500/30"
                            : q.status === "DRAFT"
                            ? "bg-muted text-muted-foreground"
                            : q.status === "CHANGES_REQUESTED"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                        }`}
                      >
                        {q.status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-base text-foreground line-clamp-1">
                      {draft?.title || "Untitled Question"}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {draft?.description || "No description provided."}
                    </p>

                    <div className="flex items-center gap-2 text-2xs text-muted-foreground font-semibold pt-1">
                      <span>{q.category?.name || "General"}</span>
                      {q.topic?.name && <span>• {q.topic.name}</span>}
                      <span>• {draft?.questionScore || 100} pts</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                    <span className="text-2xs font-mono text-muted-foreground">
                      {q.currentVersionId ? "Snapshot Minted" : "Working Draft"}
                    </span>

                    <div className="flex items-center gap-2">
                      {(q.status === "DRAFT" || q.status === "CHANGES_REQUESTED") && (
                        <Button
                          size="xs"
                          onClick={() => handleOpenSubmit(q.id)}
                          className="rounded-xl gap-1 bg-purple-600 hover:bg-purple-700 text-white text-2xs font-semibold"
                        >
                          <HugeiconsIcon icon={SentIcon} className="size-3" />
                          Submit to Reviewer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center border border-dashed border-border/50 rounded-3xl p-16 text-center space-y-4">
            <HugeiconsIcon icon={FileQuestionMarkIcon} className="size-10 text-muted-foreground/40" />
            <div>
              <h3 className="text-base font-bold">No questions found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {activeStatusTab === "ALL"
                  ? "Start by creating your first question draft."
                  : `No questions currently in ${activeStatusTab.replace(/_/g, " ")} status.`}
              </p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              + Create Question Draft
            </Button>
          </div>
        )}
      </main>

      {/* Create Question Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Question Draft</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Type & Difficulty Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Question Type</Label>
                <Select
                  value={questionType}
                  onValueChange={(val) => {
                    if (val) setQuestionType(val as QuestionType);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                    <SelectItem value="text">Short Answer (Text)</SelectItem>
                    <SelectItem value="code">Coding (Judge0/Codebox)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Difficulty Level</Label>
                <Select
                  value={difficulty}
                  onValueChange={(val) => {
                    if (val) setDifficulty(val as Difficulty);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Question Title</Label>
              <Input
                placeholder="e.g. QuickSort Worst-Case Time Complexity"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description / Problem Statement</Label>
              <Textarea
                placeholder="Describe the question problem, requirements, or code specification..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="rounded-xl resize-none"
              />
            </div>

            {/* Hint & Score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Optional Hint</Label>
                <Input
                  placeholder="e.g. Consider an array already sorted"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Question Score (pts)</Label>
                <Input
                  type="number"
                  min={1}
                  value={questionScore}
                  onChange={(e) => setQuestionScore(Number(e.target.value) || 100)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Taxonomy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={categoryId} onValueChange={(val) => { setCategoryId(val ?? ""); setTopicId(""); }}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Topic</Label>
                <Select value={topicId} onValueChange={(val) => setTopicId(val ?? "")} disabled={!categoryId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={categoryId ? "Select Topic" : "Pick Category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTopics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Type Specific Fields */}
            {questionType === "mcq" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider">Multiple Choice Options</Label>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleAddOption}
                    className="rounded-xl text-xs"
                  >
                    + Add Option
                  </Button>
                </div>

                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOption"
                        checked={correctOptionId === opt.id}
                        onChange={() => setCorrectOptionId(opt.id)}
                        className="size-4 accent-purple-600"
                        title="Mark as correct answer"
                      />
                      <Input
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[idx]!.text = e.target.value;
                          setOptions(updated);
                        }}
                        className="rounded-xl flex-1 text-xs"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={options.length <= 2}
                        onClick={() => handleRemoveOption(opt.id)}
                        className="rounded-xl text-muted-foreground hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-2xs text-muted-foreground">Select the radio button next to the correct answer choice.</p>
              </div>
            )}

            {questionType === "text" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Correct Answer (Exact Match)</Label>
                <Input
                  placeholder="e.g. cin"
                  value={correctOptionId}
                  onChange={(e) => setCorrectOptionId(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            {questionType === "code" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Starter Code (Python 3)</Label>
                  <Textarea
                    value={starterPython}
                    onChange={(e) => setStarterPython(e.target.value)}
                    rows={4}
                    className="font-mono text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider">Test Cases</Label>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={handleAddTestCase}
                      className="rounded-xl text-xs"
                    >
                      + Add Test Case
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="p-3 border border-border/40 rounded-2xl bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between text-2xs font-bold">
                          <span>Case #{idx + 1}</span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 font-normal cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tc.isSample}
                                onChange={(e) => {
                                  const updated = [...testCases];
                                  updated[idx]!.isSample = e.target.checked;
                                  setTestCases(updated);
                                }}
                                className="size-3.5 accent-purple-600 rounded"
                              />
                              Sample Case (Visible to Students)
                            </label>
                            <button
                              type="button"
                              disabled={testCases.length <= 1}
                              onClick={() => handleRemoveTestCase(idx)}
                              className="text-muted-foreground hover:text-destructive text-xs"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Input (stdin)"
                            value={tc.input}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[idx]!.input = e.target.value;
                              setTestCases(updated);
                            }}
                            className="text-xs font-mono rounded-xl"
                          />
                          <Input
                            placeholder="Expected Output (stdout)"
                            value={tc.expectedOutput}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[idx]!.expectedOutput = e.target.value;
                              setTestCases(updated);
                            }}
                            className="text-xs font-mono rounded-xl"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreateQuestion}
              disabled={createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2 font-semibold"
            >
              {createMutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={AddCircleIcon} className="size-4" />}
              Save Working Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Review Modal */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Submit to Reviewer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Submitting creates an immutable version snapshot of this draft and assigns it to a verified reviewer.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Reviewer</Label>
              <Select value={selectedReviewerId} onValueChange={(val) => setSelectedReviewerId(val ?? "")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a reviewer" />
                </SelectTrigger>
                <SelectContent>
                  {reviewers?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message for Reviewer (Optional)</Label>
              <Textarea
                placeholder="e.g. Please verify edge cases on the code question..."
                value={submitComment}
                onChange={(e) => setSubmitComment(e.target.value)}
                rows={3}
                className="rounded-xl resize-none text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSubmitOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitForReview}
              disabled={submitMutation.isPending || !selectedReviewerId}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2 font-semibold"
            >
              {submitMutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={SentIcon} className="size-4" />}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function QuestionsStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <Spinner className="size-8 text-neutral-400" />
        </div>
      }
    >
      <QuestionsStudioContent />
    </Suspense>
  );
}
