"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  AddCircleIcon,
  SearchIcon,
  CheckmarkCircle02Icon,
  CodeIcon,
  FileQuestionMarkIcon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";
import Link from "next/link";

export default function AddContestQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [customMarks, setCustomMarks] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  // Contest query
  const { data: contestData, refetch: refetchContest } = useQuery(
    trpc.contest.getForEdit.queryOptions({ id: contestId })
  );

  // Approved questions from Question Bank
  const { data: questions, isLoading } = useQuery(
    trpc.questionBank.listQuestionBank.queryOptions({
      status: "APPROVED",
      categoryId: selectedCategory === "ALL" ? undefined : selectedCategory,
      questionType: selectedType === "ALL" ? undefined : (selectedType as any),
      search: searchTerm.trim() || undefined,
    })
  );

  // Categories query
  const { data: categories } = useQuery(
    trpc.taxonomy.listCategories.queryOptions()
  );

  // Add question mutation
  const addQuestionMutation = useMutation(
    trpc.contest.addQuestion.mutationOptions({
      onSuccess: () => {
        refetchContest();
      },
    })
  );

  const existingQuestionIds =
    contestData?.questions?.map((q) => q.questionId || q.id) || [];

  const handleAddQuestion = async (questionId: string, defaultScore: number) => {
    const marks = customMarks[questionId] ?? defaultScore;
    setAddingId(questionId);
    try {
      await addQuestionMutation.mutateAsync({
        contestId,
        questionId,
        marks: Number(marks),
      });
    } catch (err) {
      console.error("Failed to add question to contest:", err);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(`/dashboard/contests/${contestId}`)}
            variant="ghost"
            size="sm"
            className="gap-1 rounded-xl"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back to Contest
          </Button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Add Questions from Question Bank
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(`/dashboard/contests/${contestId}`)}
            className="rounded-xl text-xs font-semibold"
            size="sm"
          >
            Done
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-6">
        {/* Contest overview info */}
        {contestData && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-border/40 bg-card shadow-xs backdrop-blur-md">
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Target Contest
              </span>
              <h2 className="text-xl font-black text-foreground">{contestData.title}</h2>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="rounded-2xl bg-muted/40 px-3.5 py-2 border border-border/40 text-center">
                <p className="text-muted-foreground font-semibold">Questions</p>
                <p className="text-sm font-bold text-foreground">
                  {contestData.questions?.length || 0}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/40 px-3.5 py-2 border border-border/40 text-center">
                <p className="text-muted-foreground font-semibold">Total Score</p>
                <p className="text-sm font-bold text-foreground">
                  {contestData.totalScore || 0} pts
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="p-5 rounded-3xl border border-border/40 bg-card shadow-xs space-y-4 backdrop-blur-md">
          <div className="relative">
            <HugeiconsIcon
              icon={SearchIcon}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            />
            <Input
              placeholder="Search approved questions by title, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-2xl bg-input/40"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filters */}
              <div className="flex items-center rounded-xl bg-muted/40 p-1 border border-border/40 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedType("ALL")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    selectedType === "ALL"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Types
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("mcq")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    selectedType === "mcq"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  MCQ
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("code")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    selectedType === "code"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Coding
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("text")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    selectedType === "text"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Text
                </button>
              </div>

              {/* Category Filter */}
              {categories && categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 rounded-xl border border-border/40 bg-muted/40 px-3 text-xs text-foreground focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Link
              href="/dashboard/questions?action=new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
              Create Question in Bank
            </Link>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
              <Spinner className="size-7 text-primary" />
              <p className="text-xs text-muted-foreground">Loading approved questions...</p>
            </div>
          ) : !questions || questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/60 rounded-3xl p-8 space-y-3 bg-card/50">
              <HugeiconsIcon icon={FileQuestionMarkIcon} className="size-12 text-muted-foreground/60" />
              <div className="space-y-1">
                <h4 className="text-base font-bold">No approved questions found</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {searchTerm || selectedCategory !== "ALL" || selectedType !== "ALL"
                    ? "Try adjusting your search or filters."
                    : "Questions must be created and APPROVED by a reviewer in the Question Bank before they can be added to contests."}
                </p>
              </div>
              <Link
                href="/dashboard/questions?action=new"
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl"
              >
                <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                Create New Question in Question Bank
              </Link>
            </div>
          ) : (
            questions.map((q) => {
              const inContest = existingQuestionIds.includes(q.id);
              const defaultScore = q.currentVersion?.questionScore || 100;
              const currentScore = customMarks[q.id] ?? defaultScore;
              const isAdding = addingId === q.id;

              return (
                <div
                  key={q.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-3xl border transition-all gap-4 ${
                    inContest
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                      : "border-border/40 bg-card hover:border-border/80 shadow-xs"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                          q.questionType === "code"
                            ? "bg-blue-500/10 text-blue-500"
                            : q.questionType === "mcq"
                            ? "bg-purple-500/10 text-purple-500"
                            : "bg-orange-500/10 text-orange-500"
                        }`}
                      >
                        {q.questionType === "code" ? (
                          <HugeiconsIcon icon={CodeIcon} className="size-3" />
                        ) : null}
                        {q.questionType.toUpperCase()}
                      </span>

                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                          q.difficulty === "easy"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : q.difficulty === "medium"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {q.difficulty}
                      </span>

                      {q.category && (
                        <span className="text-2xs font-medium text-muted-foreground bg-muted/50 px-2.5 py-0.5 rounded-md">
                          {q.category.name}
                          {q.topic ? ` • ${q.topic.name}` : ""}
                        </span>
                      )}

                      <span className="text-2xs text-muted-foreground">
                        v{q.currentVersion?.version || 1}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground">
                      {q.currentVersion?.title || "Untitled Question"}
                    </h3>

                    {q.currentVersion?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {q.currentVersion.description}
                      </p>
                    )}
                  </div>

                  {/* Marks & Add Button */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`input-marks-${q.id}`} className="text-xs text-muted-foreground">Marks:</label>
                      <Input
                        id={`input-marks-${q.id}`}
                        type="number"
                        min={1}
                        disabled={inContest}
                        value={currentScore}
                        onChange={(e) =>
                          setCustomMarks((prev) => ({
                            ...prev,
                            [q.id]: Number(e.target.value),
                          }))
                        }
                        className="w-20 h-9 text-xs font-bold text-center rounded-xl bg-input/40"
                      />
                    </div>

                    {inContest ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-2xl">
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                        In Contest
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isAdding}
                        onClick={() => handleAddQuestion(q.id, defaultScore)}
                        className="rounded-2xl h-9 px-4 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isAdding ? (
                          <Spinner className="size-4" />
                        ) : (
                          <>
                            <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                            Add to Contest
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
