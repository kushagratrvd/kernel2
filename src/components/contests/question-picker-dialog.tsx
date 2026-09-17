"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SearchIcon,
  AddCircleIcon,
  CheckmarkCircle02Icon,
  FileQuestionMarkIcon,
  CodeIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";

interface QuestionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  existingQuestionIds: string[];
  onQuestionAdded: () => void;
}

export function QuestionPickerDialog({
  open,
  onOpenChange,
  contestId,
  existingQuestionIds,
  onQuestionAdded,
}: QuestionPickerDialogProps) {
  const trpc = useTRPC();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [customMarks, setCustomMarks] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Load approved questions from Question Bank
  const { data: questions, isLoading } = useQuery({
    ...trpc.questionBank.listQuestionBank.queryOptions({
      status: "APPROVED",
      categoryId: selectedCategory === "ALL" ? undefined : selectedCategory,
      questionType: selectedType === "ALL" ? undefined : (selectedType as any),
      search: searchTerm.trim() || undefined,
    }),
    enabled: open,
  });

  // Load categories for filter
  const { data: categories } = useQuery({
    ...trpc.taxonomy.listCategories.queryOptions(),
    enabled: open,
  });

  // Add question mutation
  const addQuestionMutation = useMutation(
    trpc.contest.addQuestion.mutationOptions({
      onSuccess: () => {
        onQuestionAdded();
      },
    })
  );

  const handleAddQuestion = async (questionId: string, defaultScore: number) => {
    const marks = customMarks[questionId] ?? defaultScore;
    setAddingId(questionId);
    try {
      await addQuestionMutation.mutateAsync({
        contestId,
        questionId,
        marks: Number(marks),
      });
      setAddedIds((prev) => new Set([...prev, questionId]));
    } catch (err) {
      console.error("Failed to add question to contest:", err);
    } finally {
      setAddingId(null);
    }
  };

  const isQuestionInContest = (qId: string) => {
    return existingQuestionIds.includes(qId) || addedIds.has(qId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <HugeiconsIcon icon={AddCircleIcon} className="size-5 text-primary" />
            Add Questions from Question Bank
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Browse approved question snapshots and attach them to this contest.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="space-y-3 pt-2 pb-1">
          <div className="relative">
            <HugeiconsIcon
              icon={SearchIcon}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            />
            <Input
              placeholder="Search approved questions by title, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-2xl bg-input/40 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Type Filters */}
            <div className="flex items-center rounded-xl bg-muted/40 p-1 border border-border/40 gap-1">
              <button
                type="button"
                onClick={() => setSelectedType("ALL")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
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
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
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
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
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
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
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
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[250px] max-h-[420px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <Spinner className="size-6 text-primary" />
              <p className="text-xs text-muted-foreground">Loading approved questions...</p>
            </div>
          ) : !questions || questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/60 rounded-3xl p-6 space-y-3 bg-muted/10">
              <HugeiconsIcon icon={FileQuestionMarkIcon} className="size-10 text-muted-foreground/60" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">No approved questions found</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {searchTerm || selectedCategory !== "ALL" || selectedType !== "ALL"
                    ? "Try adjusting your search or filters."
                    : "Only APPROVED questions from the Question Bank can be added to contests."}
                </p>
              </div>
              <Link
                href="/dashboard/questions?action=new"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                Create and submit new question
              </Link>
            </div>
          ) : (
            questions.map((q) => {
              const inContest = isQuestionInContest(q.id);
              const defaultScore = q.currentVersion?.questionScore || 100;
              const currentScore = customMarks[q.id] ?? defaultScore;
              const isAdding = addingId === q.id;

              return (
                <div
                  key={q.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all gap-3 ${
                    inContest
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                      : "border-border/50 bg-card hover:border-border"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${
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
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${
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
                        <span className="text-2xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                          {q.category.name}
                          {q.topic ? ` • ${q.topic.name}` : ""}
                        </span>
                      )}

                      <span className="text-2xs text-muted-foreground">
                        v{q.currentVersion?.version || 1}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-foreground line-clamp-1">
                      {q.currentVersion?.title || "Untitled Question"}
                    </h4>

                    {q.currentVersion?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {q.currentVersion.description}
                      </p>
                    )}
                  </div>

                  {/* Actions & Marks */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`marks-${q.id}`} className="text-2xs text-muted-foreground">Marks:</label>
                      <Input
                        id={`marks-${q.id}`}
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
                        className="w-16 h-8 text-xs font-bold text-center rounded-xl bg-input/40"
                      />
                    </div>

                    {inContest ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                        Added
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isAdding}
                        onClick={() => handleAddQuestion(q.id, defaultScore)}
                        className="rounded-xl h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isAdding ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <>
                            <HugeiconsIcon icon={AddCircleIcon} className="size-3.5" />
                            Add
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

        {/* Footer info */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Approved snapshots guarantee question content remains locked for the contest.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-8 px-4"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
