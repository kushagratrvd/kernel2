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

  const [defaultTeacherMarks, setDefaultTeacherMarks] = useState<number>(10);

  const handleAddQuestion = async (questionId: string) => {
    const marks = customMarks[questionId] !== undefined ? customMarks[questionId] : defaultTeacherMarks;
    setAddingId(questionId);
    try {
      await addQuestionMutation.mutateAsync({
        contestId,
        questionId,
        marks: Number(marks) > 0 ? Number(marks) : 10,
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
      <DialogContent className="w-[96vw] max-w-[1500px] sm:max-w-none md:max-w-none lg:max-w-[1500px] h-[75vh] max-h-[720px] min-h-[480px] flex flex-col p-6 md:p-8 overflow-hidden rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="text-2xl font-black flex items-center gap-2.5">
            <HugeiconsIcon icon={AddCircleIcon} className="size-6 text-primary" />
            Add Questions from Question Bank
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select approved questions from the Question Bank and specify the marks for each question in this contest.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="space-y-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <HugeiconsIcon
              icon={SearchIcon}
              className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
            />
            <Input
              placeholder="Search approved questions by title, description, keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-12 rounded-2xl bg-input/40 text-sm md:text-base"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Filters */}
              <div className="flex items-center rounded-xl bg-muted/40 p-1 border border-border/40 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedType("ALL")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    selectedType === "ALL"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Types
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("code")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    selectedType === "code"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Coding
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("mcq")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    selectedType === "mcq"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  MCQ
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType("text")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    selectedType === "text"
                      ? "bg-background text-foreground shadow-xs font-semibold"
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
                  className="h-9 rounded-xl border border-border/40 bg-muted/40 px-3 text-xs md:text-sm text-foreground focus:outline-none"
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

            {/* Quick default marks for teacher */}
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
              <span className="text-xs text-muted-foreground font-semibold">Default Marks for New:</span>
              <Input
                type="number"
                min={1}
                value={defaultTeacherMarks}
                onChange={(e) => setDefaultTeacherMarks(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 h-7 text-xs md:text-sm text-center font-bold rounded-lg bg-background p-0"
              />
            </div>
          </div>
        </div>

        {/* Questions List (Flexes to fill remaining height) */}
        <div className="flex-1 overflow-y-auto pr-2 min-h-0 py-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
              <Spinner className="size-8 text-primary" />
              <p className="text-sm text-muted-foreground">Loading approved questions...</p>
            </div>
          ) : !questions || questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/60 rounded-3xl p-8 space-y-3 bg-muted/10">
              <HugeiconsIcon icon={FileQuestionMarkIcon} className="size-12 text-muted-foreground/60" />
              <div className="space-y-1">
                <h4 className="text-base font-bold">No approved questions found</h4>
                <p className="text-xs md:text-sm text-muted-foreground max-w-md">
                  {searchTerm || selectedCategory !== "ALL" || selectedType !== "ALL"
                    ? "Try adjusting your search or filters to find questions."
                    : "Only APPROVED questions from the Question Bank can be added to contests."}
                </p>
              </div>
              <Link
                href="/dashboard/questions?action=new"
                className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-primary hover:underline mt-2"
              >
                <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                Create and submit new question
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions.map((q) => {
                const inContest = isQuestionInContest(q.id);
                const questionMarks = customMarks[q.id] !== undefined ? customMarks[q.id] : defaultTeacherMarks;
                const isAdding = addingId === q.id;

                return (
                  <div
                    key={q.id}
                    className={`flex flex-col justify-between p-5 rounded-3xl border transition-all gap-4 ${
                      inContest
                        ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10 shadow-xs"
                        : "border-border/40 bg-card hover:border-border/80 shadow-xs"
                    }`}
                  >
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            q.questionType === "code"
                              ? "bg-blue-500/10 text-blue-500"
                              : q.questionType === "mcq"
                              ? "bg-purple-500/10 text-purple-500"
                              : "bg-orange-500/10 text-orange-500"
                          }`}
                        >
                          {q.questionType === "code" ? (
                            <HugeiconsIcon icon={CodeIcon} className="size-3.5" />
                          ) : null}
                          {q.questionType.toUpperCase()}
                        </span>

                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
                          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-lg">
                            {q.category.name}
                            {q.topic ? ` • ${q.topic.name}` : ""}
                          </span>
                        )}

                        <span className="text-xs text-muted-foreground/80 font-mono">
                          v{q.currentVersion?.version || 1}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-foreground leading-snug">
                        {q.currentVersion?.title || "Untitled Question"}
                      </h4>

                      {q.currentVersion?.description && (
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                          {q.currentVersion.description}
                        </p>
                      )}
                    </div>

                    {/* Actions & Teacher Assigned Marks */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/30">
                      <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-2xl border border-border/30">
                        <label htmlFor={`marks-${q.id}`} className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Marks:
                        </label>
                        <Input
                          id={`marks-${q.id}`}
                          type="number"
                          min={1}
                          disabled={inContest}
                          value={questionMarks}
                          onChange={(e) =>
                            setCustomMarks((prev) => ({
                              ...prev,
                              [q.id]: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="w-16 h-8 text-sm font-bold text-center rounded-xl bg-background"
                        />
                      </div>

                      {inContest ? (
                        <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-2xl">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                          In Contest
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isAdding}
                          onClick={() => handleAddQuestion(q.id)}
                          className="rounded-2xl h-10 px-5 text-xs md:text-sm font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <p className="hidden sm:block">
            Questions added are locked to approved snapshots. Teacher marks apply to this contest.
          </p>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-9 px-6 ml-auto text-xs font-semibold"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
