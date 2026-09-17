"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import { ModeToggle } from "@/components/ui/mode-toggle";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  AddCircleIcon,
  Delete02Icon,
  SparklesIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  ArrowReloadHorizontalIcon,
  FloppyDiskIcon,
  ViewIcon,
  ViewOffIcon,
  CodeIcon,
  Key01Icon,
  ChevronDownIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type QuestionStatus = "GENERATED" | "EDITED" | "SAVED" | "VALIDATION_WARNING";

interface GeneratedQuestion {
  draft: Record<string, unknown>;
  canonicalSolution?: string;
  validationErrors: string[];
  testValidation?: Array<{
    input: string;
    expectedOutput: string;
    stdout?: string;
    passed: boolean;
    error?: string;
  }>;
  status: QuestionStatus;
  localEdits?: {
    title?: string;
    description?: string;
  };
}

// ─── Prompt Suggestions ────────────────────────────────────────────────────────

const PROMPT_SUGGESTIONS = {
  mcq: [
    "JavaScript async/await and Promise chaining",
    "Big O time complexity analysis",
    "React hooks and component lifecycle",
    "SQL JOIN types and when to use them",
  ],
  code: [
    "Dynamic programming — knapsack problem",
    "Graph traversal — BFS shortest path",
    "Binary search and its variants",
    "Two pointer technique for array problems",
  ],
  text: [
    "Time complexity of binary search",
    "Number of trailing zeros in N factorial",
    "Maximum sum of a subarray (Kadane's algorithm output)",
    "Fibonacci number at position N",
  ],
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function AddKeyModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const trpc = useTRPC();
  const [provider, setProvider] = useState<"gemini" | "groq">("gemini");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const addKeyMutation = useMutation(
    trpc.ai.addKey.mutationOptions({
      onSuccess: () => {
        toast.success("API key verified and saved.");
        setName("");
        setApiKey("");
        onAdded();
        onClose();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-bold">
            <HugeiconsIcon icon={Key01Icon} className="size-5 text-purple-500" />
            Add AI Provider API Key
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Your key is encrypted with AES-256-GCM before being stored.
            It&apos;s validated live before saving.
          </p>

          {/* Provider Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Provider</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-2xl border border-border/40">
              <button
                type="button"
                onClick={() => {
                  setProvider("gemini");
                  if (!name || name === "My Groq Key") setName("My Gemini Key");
                }}
                className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  provider === "gemini"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => {
                  setProvider("groq");
                  if (!name || name === "My Gemini Key") setName("My Groq Key");
                }}
                className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  provider === "groq"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Groq (Fast LPU)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nickname</Label>
            <Input
              placeholder={provider === "gemini" ? "e.g. My Personal Gemini Key" : "e.g. My Groq Key"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {provider === "gemini" ? "Gemini API Key" : "Groq API Key"}
            </Label>
            <div className="relative">
              <HugeiconsIcon
                icon={Key01Icon}
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder={provider === "gemini" ? "AIzaSy..." : "gsk_..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={addKeyMutation.isPending}
                className="pl-10 pr-10 rounded-xl text-sm font-mono"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={showKey ? ViewOffIcon : ViewIcon}
                  className="size-4"
                  strokeWidth={1.5}
                />
              </button>
            </div>
            {provider === "gemini" ? (
              <p className="text-2xs text-muted-foreground">
                Get your key at{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-foreground font-semibold"
                >
                  aistudio.google.com
                </a>
                . If using website restrictions, add <code>http://localhost:3000/*</code> to allowed referrers.
              </p>
            ) : (
              <p className="text-2xs text-muted-foreground">
                Get your free Groq API key at{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-foreground font-semibold"
                >
                  console.groq.com/keys
                </a>
                . Groq provides ultra-fast inference on Llama 3.3 and DeepSeek R1.
              </p>
            )}
          </div>

          {addKeyMutation.isError && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
                <span>Verification Failed</span>
              </div>
              <p className="text-2xs leading-relaxed text-destructive/90 whitespace-pre-wrap break-words">
                {addKeyMutation.error?.message}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={() =>
              addKeyMutation.mutate({ name, provider, apiKey })
            }
            disabled={!name.trim() || !apiKey.trim() || addKeyMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 font-semibold shadow-sm"
          >
            {addKeyMutation.isPending ? (
              <>
                <Spinner className="size-4" />
                Validating...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                Validate & Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionCard({
  question,
  index,
  questionType,
  categoryId,
  topicId,
  difficulty,
  isRunningCode,
  onRunCode,
  onRegenerate,
  onSave,
  onEdit,
}: {
  question: GeneratedQuestion;
  index: number;
  questionType: "mcq" | "code" | "text";
  categoryId: string;
  topicId: string;
  difficulty: "easy" | "medium" | "hard";
  isRunningCode?: boolean;
  onRunCode?: (index: number) => void;
  onRegenerate: (index: number) => void;
  onSave: (index: number) => void;
  onEdit: (index: number, field: "title" | "description", value: string) => void;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const [showTestCases, setShowTestCases] = useState(false);
  const [editing, setEditing] = useState(false);

  // Automatically expand test cases section when validation results arrive
  useEffect(() => {
    if (question.testValidation && question.testValidation.length > 0) {
      setShowTestCases(true);
    }
  }, [question.testValidation]);

  const draft = question.draft as any;
  const title = question.localEdits?.title ?? draft?.title ?? "";
  const description = question.localEdits?.description ?? draft?.description ?? "";
  const hasValidationErrors = question.validationErrors.length > 0;
  const testValidationFailed = question.testValidation?.some((t) => !t.passed);
  const testValidationPassed =
    question.testValidation &&
    question.testValidation.length > 0 &&
    !testValidationFailed;

  const statusColor = {
    GENERATED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    EDITED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    SAVED: "bg-green-500/10 text-green-400 border-green-500/30",
    VALIDATION_WARNING: "bg-red-500/10 text-red-400 border-red-500/30",
  }[question.status];

  return (
    <div className="rounded-3xl border border-border/40 bg-card overflow-hidden shadow-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
          <Badge variant="outline" className={`text-2xs font-bold uppercase ${statusColor}`}>
            {question.status.replace(/_/g, " ")}
          </Badge>
          {hasValidationErrors && (
            <Badge variant="outline" className="text-2xs font-bold uppercase bg-red-500/10 text-red-400 border-red-500/30">
              Validation Error
            </Badge>
          )}
          {!hasValidationErrors && testValidationFailed && (
            <Badge variant="outline" className="text-2xs font-bold uppercase bg-amber-500/10 text-amber-400 border-amber-500/30">
              Test Warning
            </Badge>
          )}
          {!hasValidationErrors && testValidationPassed && (
            <Badge variant="outline" className="text-2xs font-bold uppercase bg-green-500/10 text-green-400 border-green-500/30">
              Tests Passed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {questionType === "code" && question.canonicalSolution && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onRunCode?.(index)}
              disabled={isRunningCode}
              className="rounded-xl gap-1 text-2xs font-semibold"
            >
              {isRunningCode ? (
                <>
                  <Spinner className="size-3" />
                  Running...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={PlayIcon} className="size-3 text-primary" />
                  Run Code
                </>
              )}
            </Button>
          )}
          {question.status !== "SAVED" && (
            <>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setEditing((v) => !v)}
                className="rounded-xl gap-1 text-2xs"
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => onRegenerate(index)}
                className="rounded-xl gap-1 text-2xs"
              >
                <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3" />
                Regenerate
              </Button>
              <Button
                size="xs"
                onClick={() => onSave(index)}
                disabled={hasValidationErrors}
                className="rounded-xl gap-1 bg-primary text-primary-foreground hover:bg-primary/90 text-2xs font-semibold shadow-sm"
              >
                <HugeiconsIcon icon={FloppyDiskIcon} className="size-3" />
                Save Draft
              </Button>
            </>
          )}
          {question.status === "SAVED" && (
            <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
              Saved to Question Bank
            </span>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {hasValidationErrors && (
        <div className="px-6 py-3 bg-red-500/5 border-b border-red-500/20">
          <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1.5">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
            Validation failed — please regenerate
          </p>
          <ul className="text-xs text-red-400/80 list-disc list-inside space-y-0.5">
            {question.validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Card Body */}
      <div className="px-6 py-5 space-y-4">
        {/* Title */}
        {editing ? (
          <div className="space-y-1">
            <Label className="text-2xs font-semibold text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => onEdit(index, "title", e.target.value)}
              className="rounded-xl text-sm font-semibold"
            />
          </div>
        ) : (
          <h3 className="font-bold text-base">{title || "Untitled"}</h3>
        )}

        {/* Description */}
        {editing ? (
          <div className="space-y-1">
            <Label className="text-2xs font-semibold text-muted-foreground">
              Description (supports Markdown and images: ![alt](url))
            </Label>
            <Textarea
              value={description}
              onChange={(e) => onEdit(index, "description", e.target.value)}
              className="rounded-xl text-sm resize-none"
              rows={5}
            />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto pr-1">
            <MarkdownRenderer content={description} className="text-sm" />
          </div>
        )}

        {/* MCQ Options */}
        {questionType === "mcq" && draft?.options && (
          <div className="space-y-2">
            <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wide">Options</p>
            <div className="grid grid-cols-2 gap-2">
              {(draft.options as any[]).map((opt: any) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs border ${
                    opt.id === draft.correctOptionId
                      ? "bg-green-500/10 border-green-500/30 text-green-400 font-semibold"
                      : "border-border/40 text-muted-foreground"
                  }`}
                >
                  <span className="uppercase font-bold">{opt.id}.</span>
                  <span>{opt.text}</span>
                  {opt.id === draft.correctOptionId && (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3 ml-auto shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Numerical Answer */}
        {questionType === "text" && draft?.correctOptionId && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="text-xs font-semibold text-green-400">
              Answer: <span className="font-mono ml-1">{draft.correctOptionId}</span>
            </p>
          </div>
        )}

        {/* Coding: Test Cases */}
        {questionType === "code" && draft?.testCases && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowTestCases((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <HugeiconsIcon
                  icon={ChevronDownIcon}
                  className={`size-3.5 transition-transform ${showTestCases ? "rotate-180" : ""}`}
                />
                Test Cases ({(draft.testCases as any[]).length})
                {question.testValidation && (
                  <span
                    className={`ml-2 text-2xs px-2 py-0.5 rounded-md font-mono ${
                      question.testValidation.every((t) => t.passed)
                        ? "bg-green-500/10 text-green-400 border border-green-500/30"
                        : "bg-red-500/10 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {question.testValidation.filter((t) => t.passed).length}/
                    {question.testValidation.length} passed
                  </span>
                )}
              </button>
              {question.canonicalSolution && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => onRunCode?.(index)}
                  disabled={isRunningCode}
                  className="rounded-xl gap-1 text-2xs h-7 font-semibold"
                >
                  {isRunningCode ? (
                    <>
                      <Spinner className="size-3" />
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={PlayIcon} className="size-3 text-primary" />
                      Run Code
                    </>
                  )}
                </Button>
              )}
            </div>
            {showTestCases && (
              <div className="space-y-2 mt-2">
                {(draft.testCases as any[]).map((tc: any, i: number) => {
                  const tvResult = question.testValidation?.[i];
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 space-y-1.5 text-xs font-mono ${
                        tvResult
                          ? tvResult.passed
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-red-500/30 bg-red-500/5"
                          : "border-border/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-sans font-bold text-muted-foreground uppercase">
                          Test {i + 1} {tc.isSample ? "(Sample)" : "(Hidden)"}
                        </span>
                        {tvResult && (
                          <span className={tvResult.passed ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                            {tvResult.passed ? "✓ Pass" : "✗ Fail"}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="text-foreground font-semibold">Input:</span>{" "}
                        <span className="whitespace-pre-wrap">{tc.input || "(empty)"}</span>
                      </div>
                      <div className="text-muted-foreground">
                        <span className="text-foreground font-semibold">Expected:</span>{" "}
                        <span className="whitespace-pre-wrap">{tc.expectedOutput}</span>
                      </div>
                      {tvResult && tvResult.stdout !== undefined && !tvResult.passed && (
                        <div className="text-muted-foreground">
                          <span className="text-foreground font-semibold">Actual:</span>{" "}
                          <span className="whitespace-pre-wrap">{tvResult.stdout || "(none)"}</span>
                        </div>
                      )}
                      {tvResult?.error && (
                        <div className="text-red-400 text-2xs bg-red-500/10 p-2 rounded-lg border border-red-500/20 whitespace-pre-wrap">
                          {tvResult.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Coding: Canonical Solution */}
        {questionType === "code" && question.canonicalSolution && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSolution((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={CodeIcon} className="size-3.5" />
              <HugeiconsIcon
                icon={ChevronDownIcon}
                className={`size-3.5 transition-transform ${showSolution ? "rotate-180" : ""}`}
              />
              Canonical Solution (not saved to bank)
            </button>
            {showSolution && (
              <pre className="text-xs font-mono bg-muted/40 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap text-foreground/80 border border-border/30">
                {question.canonicalSolution}
              </pre>
            )}
          </div>
        )}

        {/* Hint */}
        {draft?.hint && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-purple-500/30 pl-3">
            Hint: {draft.hint}
          </p>
        )}

        {/* Score */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold">{draft?.questionScore ?? 10} pts</span>
          <span>•</span>
          <span className="capitalize">{difficulty}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIQuestionGeneratorPage() {
  const router = useRouter();
  const trpc = useTRPC();

  // Config state
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.6-flash");
  const [categoryId, setCategoryId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [questionType, setQuestionType] = useState<"mcq" | "code" | "text">("mcq");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(3);
  const [testCaseCount, setTestCaseCount] = useState(5);
  const [optionCount, setOptionCount] = useState(4);
  const [prompt, setPrompt] = useState("");

  // UI state
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [runningCodeIndices, setRunningCodeIndices] = useState<Set<number>>(new Set());
  const [isRunningAllCode, setIsRunningAllCode] = useState(false);

  // Data fetches
  const { data: keys, refetch: refetchKeys } = useQuery(trpc.ai.listKeys.queryOptions());
  const { data: models } = useQuery(trpc.ai.listModels.queryOptions());
  const { data: categories } = useQuery(trpc.taxonomy.listCategories.queryOptions());

  const activeKey = keys?.find((k) => k.id === selectedKeyId);
  const availableModels = (models ?? []).filter((m) => !activeKey || m.provider === activeKey.provider);

  // Auto-switch selected model when active key's provider changes
  useEffect(() => {
    if (!activeKey || !models || models.length === 0) return;
    const currentModel = models.find((m) => m.id === selectedModel);
    if (!currentModel || currentModel.provider !== activeKey.provider) {
      const firstValid = models.find((m) => m.provider === activeKey.provider);
      if (firstValid) {
        setSelectedModel(firstValid.id);
      }
    }
  }, [selectedKeyId, activeKey, models, selectedModel]);

  const filteredTopics = categories?.find((c) => c.id === categoryId)?.topics ?? [];

  // Generate mutation
  const generateMutation = useMutation(
    trpc.ai.generateQuestions.mutationOptions({
      onSuccess: (data) => {
        const questions: GeneratedQuestion[] = data.questions.map((q) => ({
          ...q,
          status: q.validationErrors.length > 0 ? "VALIDATION_WARNING" : "GENERATED",
        }));
        setGeneratedQuestions(questions);
        const valid = questions.filter((q) => q.status === "GENERATED").length;
        toast.success(`Generated ${questions.length} question(s). ${valid} passed validation.`);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Regenerate single
  const regenerateMutation = useMutation(
    trpc.ai.regenerateQuestion.mutationOptions({
      onSuccess: (data, variables) => {
        if (!data) return;
        setGeneratedQuestions((prev) => {
          const next = [...prev];
          const idx = (variables as any)._index as number;
          next[idx] = {
            ...data,
            status: data.validationErrors.length > 0 ? "VALIDATION_WARNING" : "GENERATED",
          };
          return next;
        });
        setRegeneratingIndex(null);
        toast.success("Question regenerated.");
      },
      onError: (err) => {
        setRegeneratingIndex(null);
        toast.error(err.message);
      },
    })
  );

  // Run Code mutation
  const runCodeMutation = useMutation(
    trpc.ai.runCode.mutationOptions({
      onError: (err) => toast.error(`Code execution error: ${err.message}`),
    })
  );

  // Save mutation
  const saveMutation = useMutation(
    trpc.ai.saveGeneratedQuestions.mutationOptions({
      onSuccess: (data) => {
        toast.success(`${data.savedIds.length} question(s) saved to Question Bank.`);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const handleGenerate = () => {
    if (!selectedKeyId) return toast.error("Please select an API key.");
    if (!prompt.trim()) return toast.error("Please enter a prompt.");
    generateMutation.mutate({
      keyId: selectedKeyId,
      model: selectedModel,
      prompt,
      categoryId: categoryId || null,
      topicId: topicId || null,
      questionType,
      difficulty,
      count,
      testCaseCount,
      optionCount,
    });
  };

  const handleRegenerate = (index: number) => {
    if (!selectedKeyId) return;
    setRegeneratingIndex(index);
    regenerateMutation.mutate({
      keyId: selectedKeyId,
      model: selectedModel,
      prompt,
      questionType,
      difficulty,
      testCaseCount,
      optionCount,
      _index: index,
    } as any);
  };

  const handleRunCode = async (index: number) => {
    const q = generatedQuestions[index];
    if (!q) return;
    const draft = q.draft as any;
    const testCases = draft?.testCases as Array<{ input: string; expectedOutput: string; isSample?: boolean }>;
    const canonicalSolution = q.canonicalSolution;

    if (!canonicalSolution || !testCases || testCases.length === 0) {
      toast.error("No test cases or canonical solution available to run.");
      return;
    }

    setRunningCodeIndices((prev) => new Set(prev).add(index));
    try {
      const results = await runCodeMutation.mutateAsync({
        sourceCode: canonicalSolution,
        languageId: 71,
        testCases: testCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample ?? false,
        })),
        timeLimit: draft.timeLimit ?? 5,
        memoryLimit: draft.memoryLimit ?? 128000,
      });

      setGeneratedQuestions((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          testValidation: results,
        };
        return next;
      });

      const passed = results.filter((r) => r.passed).length;
      const total = results.length;
      if (passed === total) {
        toast.success(`Question #${index + 1}: All ${total} test cases passed on Codebox!`);
      } else {
        toast.warning(`Question #${index + 1}: ${passed}/${total} test cases passed on Codebox.`);
      }
    } catch (err: any) {
      toast.error(`Code execution failed for Question #${index + 1}: ${err.message}`);
    } finally {
      setRunningCodeIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleRunAllCode = async () => {
    const codeIndices: number[] = [];
    generatedQuestions.forEach((q, idx) => {
      const draft = q.draft as any;
      if (q.canonicalSolution && draft?.testCases && draft.testCases.length > 0) {
        codeIndices.push(idx);
      }
    });

    if (codeIndices.length === 0) {
      toast.error("No code questions with test cases available to run.");
      return;
    }

    setIsRunningAllCode(true);
    setRunningCodeIndices(new Set(codeIndices));

    let totalPassedQuestions = 0;
    const totalQuestionsTested = codeIndices.length;

    try {
      await Promise.all(
        codeIndices.map(async (idx) => {
          const q = generatedQuestions[idx];
          const draft = q.draft as any;
          try {
            const results = await runCodeMutation.mutateAsync({
              sourceCode: q.canonicalSolution!,
              languageId: 71,
              testCases: draft.testCases.map((tc: any) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample ?? false,
              })),
              timeLimit: draft.timeLimit ?? 5,
              memoryLimit: draft.memoryLimit ?? 128000,
            });

            setGeneratedQuestions((prev) => {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                testValidation: results,
              };
              return next;
            });

            if (results.every((r) => r.passed)) {
              totalPassedQuestions++;
            }
          } catch {
            // Handled gracefully per question
          } finally {
            setRunningCodeIndices((prev) => {
              const next = new Set(prev);
              next.delete(idx);
              return next;
            });
          }
        })
      );

      if (totalPassedQuestions === totalQuestionsTested) {
        toast.success(`All ${totalQuestionsTested} code question(s) passed all test cases!`);
      } else {
        toast.warning(
          `Run complete: ${totalPassedQuestions}/${totalQuestionsTested} code questions passed all test cases.`
        );
      }
    } finally {
      setIsRunningAllCode(false);
      setRunningCodeIndices(new Set());
    }
  };

  const handleSaveOne = async (index: number) => {
    const q = generatedQuestions[index];
    if (!q || q.validationErrors.length > 0) return;
    const draft = { ...q.draft } as any;
    if (q.localEdits?.title) draft.title = q.localEdits.title;
    if (q.localEdits?.description) draft.description = q.localEdits.description;
    delete draft.canonicalSolution;
    delete draft._canonicalSolution;

    await saveMutation.mutateAsync({
      questions: [{
        questionType,
        categoryId: categoryId || null,
        topicId: topicId || null,
        difficulty,
        draft,
      }],
    });

    setGeneratedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: "SAVED" };
      return next;
    });
  };

  const handleSaveAll = async () => {
    const toSave = generatedQuestions.filter(
      (q) => q.status !== "SAVED" && q.validationErrors.length === 0
    );
    if (toSave.length === 0) return toast.error("No valid questions to save.");

    await saveMutation.mutateAsync({
      questions: toSave.map((q) => {
        const draft = { ...q.draft } as any;
        if (q.localEdits?.title) draft.title = q.localEdits.title;
        if (q.localEdits?.description) draft.description = q.localEdits.description;
        delete draft.canonicalSolution;
        delete draft._canonicalSolution;
        return { questionType, categoryId: categoryId || null, topicId: topicId || null, difficulty, draft };
      }),
    });

    setGeneratedQuestions((prev) =>
      prev.map((q) => (q.status !== "SAVED" && q.validationErrors.length === 0 ? { ...q, status: "SAVED" } : q))
    );
  };

  const handleEdit = (index: number, field: "title" | "description", value: string) => {
    setGeneratedQuestions((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        localEdits: { ...next[index].localEdits, [field]: value },
        status: next[index].status === "SAVED" ? "SAVED" : "EDITED",
      };
      return next;
    });
  };

  const unsavedCount = generatedQuestions.filter(
    (q) => q.status !== "SAVED" && q.validationErrors.length === 0
  ).length;

  const hasCodeQuestions = generatedQuestions.some(
    (q) => q.canonicalSolution && (q.draft as any)?.testCases?.length > 0
  );

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/questions")}
            className="rounded-xl gap-1 text-xs"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Question Studio
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={SparklesIcon} className="size-4 text-purple-500" />
            <span className="text-base font-bold tracking-tight">AI Question Generator</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasCodeQuestions && (
            <Button
              onClick={handleRunAllCode}
              disabled={isRunningAllCode || runningCodeIndices.size > 0}
              variant="outline"
              className="gap-2 rounded-2xl text-xs font-semibold"
            >
              {isRunningAllCode ? (
                <>
                  <Spinner className="size-4" />
                  Running All Tests...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={PlayIcon} className="size-4 text-primary" />
                  Run All Test Cases
                </>
              )}
            </Button>
          )}
          {generatedQuestions.length > 0 && unsavedCount > 0 && (
            <Button
              onClick={handleSaveAll}
              disabled={saveMutation.isPending}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-sm text-xs font-semibold"
            >
              {saveMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <HugeiconsIcon icon={FloppyDiskIcon} className="size-4" />
              )}
              Save All ({unsavedCount})
            </Button>
          )}
          <ModeToggle />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Config Panel ─────────────────────────────────────────── */}
        <aside className="w-80 shrink-0 border-r border-border/40 flex flex-col gap-0 overflow-y-auto bg-muted/10">
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold mb-1">Configuration</h2>
              <p className="text-2xs text-muted-foreground">Set up your generation parameters</p>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">API Key</Label>
              <div className="flex gap-2">
                <Select value={selectedKeyId} onValueChange={(v) => setSelectedKeyId(v ?? "")}>
                  <SelectTrigger className="rounded-xl text-xs flex-1">
                    <SelectValue placeholder="Select a key...">
                      {() => {
                        const selected = keys?.find((k) => k.id === selectedKeyId);
                        if (!selected) return null;
                        return (
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold">{selected.name}</span>
                            <span className="text-3xs uppercase font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
                              {selected.provider}
                            </span>
                            <span className="text-muted-foreground font-mono text-2xs">
                              ({selected.maskedKey})
                            </span>
                          </span>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {keys?.map((key) => (
                      <SelectItem
                        key={key.id}
                        value={key.id}
                        label={`${key.name} (${key.maskedKey})`}
                        className="text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{key.name}</span>
                            <span className="text-3xs uppercase font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
                              {key.provider}
                            </span>
                          </div>
                          <span className="text-muted-foreground font-mono text-2xs">
                            {key.maskedKey}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setAddKeyOpen(true)}
                  className="rounded-xl shrink-0"
                  title="Add new API key"
                >
                  <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                </Button>
              </div>
              {keys && keys.length === 0 && (
                <p className="text-2xs text-amber-400">
                  No keys saved yet.{" "}
                  <button
                    onClick={() => setAddKeyOpen(true)}
                    className="underline"
                  >
                    Add one
                  </button>
                </p>
              )}
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Model</Label>
                {activeKey && (
                  <span className="text-3xs uppercase font-mono text-muted-foreground">
                    Provider: {activeKey.provider}
                  </span>
                )}
              </div>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v ?? "")}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue>
                    {() => availableModels.find((m) => m.id === selectedModel)?.label ?? selectedModel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} label={m.label} className="text-xs">
                      <div className="flex flex-col py-0.5 text-left">
                        <span className="font-medium">{m.label}</span>
                        {m.description && (
                          <span className="text-2xs text-muted-foreground leading-tight">{m.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Question Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Question Type</Label>
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40">
                {(["mcq", "code", "text"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setQuestionType(t)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      questionType === t
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "text" ? "Numerical" : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Difficulty</Label>
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-all ${
                      difficulty === d
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Category & Topic */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v ?? ""); setTopicId(""); }}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Any category">
                    {() => categories?.find((c) => c.id === categoryId)?.name ?? "Any category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="" label="Any category" className="text-xs">Any category</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredTopics.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Topic</Label>
                <Select value={topicId} onValueChange={(v) => setTopicId(v ?? "")}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue placeholder="Any topic">
                      {() => filteredTopics.find((t) => t.id === topicId)?.name ?? "Any topic"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="" label="Any topic" className="text-xs">Any topic</SelectItem>
                    {filteredTopics.map((t) => (
                      <SelectItem key={t.id} value={t.id} label={t.name} className="text-xs">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Count */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Number of Questions</Label>
              <Input
                type="number"
                min={1}
                value={count}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setCount(Math.max(1, val));
                }}
                className="rounded-xl text-xs h-9"
                placeholder="e.g. 5, 10, 20..."
              />
            </div>

            {questionType === "code" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Test Cases per Question (2-10)</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={testCaseCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setTestCaseCount(Math.min(10, Math.max(2, val)));
                  }}
                  className="rounded-xl text-xs h-9"
                />
              </div>
            )}

            {questionType === "mcq" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Options per Question (2-6)</Label>
                <Input
                  type="number"
                  min={2}
                  max={6}
                  value={optionCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setOptionCount(Math.min(6, Math.max(2, val)));
                  }}
                  className="rounded-xl text-xs h-9"
                />
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Panel ───────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {/* Prompt Box */}
          <div className="border-b border-border/40 p-6 space-y-3 bg-muted/5">
            <Label className="text-xs font-semibold">Prompt / Topic Description</Label>
            <Textarea
              id="ai-prompt"
              placeholder={`Describe what you want to generate...\ne.g. "${PROMPT_SUGGESTIONS[questionType][0]}"`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="rounded-xl resize-none text-sm"
            />
            {/* Suggestions */}
            <div className="flex flex-wrap gap-2">
              <span className="text-2xs text-muted-foreground font-semibold">Suggestions:</span>
              {PROMPT_SUGGESTIONS[questionType].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-2xs px-2 py-1 rounded-lg bg-muted/60 border border-border/40 hover:border-foreground/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
            <Button
              id="generate-questions-btn"
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedKeyId || !prompt.trim()}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-sm font-semibold text-xs h-9 px-4 w-auto self-start"
            >
              {generateMutation.isPending ? (
                <>
                  <Spinner className="size-4" />
                  Generating {count} question{count > 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={SparklesIcon} className="size-4" />
                  Generate {count} Question{count > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>

          {/* Results Area */}
          <div className="flex-1 p-6">
            {generateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
                <div className="relative">
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <HugeiconsIcon icon={SparklesIcon} className="size-8 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold">Generating your questions...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Calling Gemini, formatting questions and test cases...
                  </p>
                </div>
              </div>
            ) : generateMutation.isError ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center max-w-md mx-auto p-6 rounded-3xl border border-destructive/40 bg-destructive/10">
                <div className="size-14 rounded-full bg-destructive/20 text-destructive flex items-center justify-center">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-destructive">Question Generation Failed</h3>
                  <p className="text-xs text-destructive/90 whitespace-pre-wrap leading-relaxed">
                    {generateMutation.error?.message}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  className="rounded-xl text-xs mt-2"
                >
                  Try Again
                </Button>
              </div>
            ) : generatedQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
                <div className="size-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <HugeiconsIcon icon={SparklesIcon} className="size-10 text-purple-400/60" />
                </div>
                <div>
                  <p className="font-bold text-lg">AI Question Workspace</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Configure your settings on the left, write a prompt, and hit Generate.
                    Questions will appear here for review before saving.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold">
                      Generated Questions ({generatedQuestions.length})
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {generatedQuestions.filter((q) => q.status === "SAVED").length} saved •{" "}
                      {generatedQuestions.filter((q) => q.validationErrors.length > 0).length} failed
                    </span>
                  </div>
                  {hasCodeQuestions && (
                    <Button
                      size="xs"
                      onClick={handleRunAllCode}
                      disabled={isRunningAllCode || runningCodeIndices.size > 0}
                      className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm text-xs font-semibold h-8"
                    >
                      {isRunningAllCode ? (
                        <>
                          <Spinner className="size-3.5" />
                          Running All Tests...
                        </>
                      ) : (
                        <>
                          <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                          Run All Test Cases
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {generatedQuestions.map((q, i) => (
                  <div key={i} className="relative">
                    {regeneratingIndex === i && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/80 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Spinner className="size-5 text-purple-500" />
                          Regenerating...
                        </div>
                      </div>
                    )}
                    <QuestionCard
                      question={q}
                      index={i}
                      questionType={questionType}
                      categoryId={categoryId}
                      topicId={topicId}
                      difficulty={difficulty}
                      isRunningCode={runningCodeIndices.has(i)}
                      onRunCode={handleRunCode}
                      onRegenerate={handleRegenerate}
                      onSave={handleSaveOne}
                      onEdit={handleEdit}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Key Modal */}
      <AddKeyModal
        open={addKeyOpen}
        onClose={() => setAddKeyOpen(false)}
        onAdded={refetchKeys}
      />
    </div>
  );
}
