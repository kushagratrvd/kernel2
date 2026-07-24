"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  AddCircleIcon,
  Delete02Icon,
  SaveIcon,
  CodeIcon,
} from "@hugeicons/core-free-icons";

// Default starter codes from codebox.ts
const DEFAULT_STARTER_CODES = {
  "71": `import sys\n\ndef main():\n    # Read input from stdin\n    # Print result to stdout\n    line = sys.stdin.read().strip()\n    if line:\n        # Modify this to solve the challenge\n        print(f"Hello, {line}!")\n\nif __name__ == "__main__":\n    main()`,
  "63": `const readline = require('readline');\n\nconst rl = readline.createInterface({\n    input: process.stdin,\n    output: process.stdout\n});\n\nrl.on('line', (line) => {\n    // Modify this to solve the challenge\n    console.log(\`Hello, \${line}!\`);\n    process.exit(0);\n});`,
  "54": `#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    // Modify this to solve the challenge\n    string name;\n    if (cin >> name) {\n        cout << "Hello, " << name << "!" << endl;\n    }\n    return 0;\n}`,
  "50": `#include <stdio.h>\n\nint main() {\n    // Modify this to solve the challenge\n    char name[100];\n    if (scanf("%99s", name) == 1) {\n        printf("Hello, %s!\\n", name);\n    }\n    return 0;\n}`,
  "62": `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Modify this to solve the challenge\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNext()) {\n            String name = scanner.next();\n            System.out.println("Hello, " + name + "!");\n        }\n        scanner.close();\n    }\n}`
};

import { ModeToggle } from "@/components/ui/mode-toggle";

export default function NewQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;

  // General state
  const [questionText, setQuestionText] = useState("");
  const [questionScore, setQuestionScore] = useState(100);
  const [questionType, setQuestionType] = useState<"mcq" | "text" | "code">("mcq");
  const [errorMsg, setErrorMsg] = useState("");

  // MCQ state
  const [options, setOptions] = useState<string[]>(["Option A", "Option B"]);
  const [correctOption, setCorrectOption] = useState("Option A");

  // Text state
  const [textCorrectAnswer, setTextCorrectAnswer] = useState("");

  // Code state
  const [timeLimit, setTimeLimit] = useState(5);
  const [memoryLimit, setMemoryLimit] = useState(128000);
  const [starterCodes, setStarterCodes] = useState<Record<string, string>>(DEFAULT_STARTER_CODES);
  const [testCases, setTestCases] = useState<Array<{ input: string; expectedOutput: string; isSample: boolean }>>([
    { input: "Chai", expectedOutput: "Hello, Chai!", isSample: true },
  ]);

  const addQuestionMutation = useMutation(trpc.contest.addQuestion.mutationOptions());

  // MCQ options helpers
  const handleAddOption = () => {
    setOptions([...options, `Option ${String.fromCharCode(65 + options.length)}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (!newOptions.includes(correctOption)) {
      setCorrectOption(newOptions[0]);
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options];
    const oldVal = newOptions[index];
    newOptions[index] = val;
    setOptions(newOptions);
    if (correctOption === oldVal) {
      setCorrectOption(val);
    }
  };

  // Test cases helpers
  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: "", expectedOutput: "", isSample: false }]);
  };

  const handleRemoveTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const handleTestCaseChange = (index: number, field: "input" | "expectedOutput" | "isSample", val: any) => {
    const newTestCases = [...testCases];
    newTestCases[index] = { ...newTestCases[index], [field]: val };
    setTestCases(newTestCases);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!questionText) {
      setErrorMsg("Question text is required.");
      return;
    }

    try {
      const payload: any = {
        contestId,
        questionText,
        questionType,
        questionScore: Number(questionScore),
      };

      if (questionType === "mcq") {
        payload.options = options.map(o => o.trim());
        payload.correctOption = correctOption.trim();
      } else if (questionType === "text") {
        payload.correctOption = textCorrectAnswer.trim();
      } else if (questionType === "code") {
        payload.timeLimit = Number(timeLimit);
        payload.memoryLimit = Number(memoryLimit);
        payload.starterCode = starterCodes;
        payload.allowedLanguages = [50, 54, 62, 63, 71];
        payload.testCases = testCases.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
        }));

        if (payload.testCases.length === 0) {
          setErrorMsg("Please add at least one test case for coding questions.");
          return;
        }
      }

      await addQuestionMutation.mutateAsync(payload);
      router.push(`/dashboard/contests/${contestId}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to create question.");
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
            Create Question
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle />
        </div>
      </header>

      {/* Form Workspace */}
      <main className="flex-1 p-6 lg:p-10 max-w-4xl mx-auto w-full">
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
          <div>
            <h1 className="text-2xl font-black">Configure Question</h1>
            <p className="text-sm text-muted-foreground">Select a problem type and specify correct answers or test cases.</p>
          </div>

          <Separator />

          {errorMsg && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question Type Selection */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Question Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {(["mcq", "text", "code"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setQuestionType(type)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-sm font-semibold transition-all outline-none ${
                      questionType === type
                        ? "border-primary bg-primary/5 ring-1 ring-primary text-primary"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <span className="uppercase text-xs tracking-wider">{type === "mcq" ? "MCQ" : type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* General Fields */}
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-3 space-y-2">
                <Label htmlFor="questionText" className="font-semibold text-sm">Question prompt *</Label>
                <Input
                  id="questionText"
                  placeholder="e.g. Write a function that returns the sum of two integers."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  required
                  className="rounded-2xl bg-input/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="questionScore" className="font-semibold text-sm">Points *</Label>
                <Input
                  id="questionScore"
                  type="number"
                  min={1}
                  value={questionScore}
                  onChange={(e) => setQuestionScore(Number(e.target.value))}
                  required
                  className="rounded-2xl bg-input/50 font-bold"
                />
              </div>
            </div>

            <Separator />

            {/* MCQ SECTION */}
            {questionType === "mcq" && (
              <div className="space-y-4">
                <h3 className="font-bold text-base">Configure MCQ Options</h3>
                <div className="space-y-3">
                  {options.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        required
                        className="rounded-2xl bg-input/50"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={options.length <= 2}
                        onClick={() => handleRemoveOption(idx)}
                        className="rounded-xl text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddOption}
                    size="sm"
                    className="rounded-xl gap-1.5"
                  >
                    <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                    Add Option
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correctOption" className="font-semibold text-sm">Correct Option</Label>
                  <select
                    id="correctOption"
                    value={correctOption}
                    onChange={(e) => setCorrectOption(e.target.value)}
                    className="flex h-10 w-full rounded-2xl border border-border/50 bg-input/50 px-3 py-2 text-sm outline-none"
                  >
                    {options.map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TEXT SECTION */}
            {questionType === "text" && (
              <div className="space-y-4">
                <h3 className="font-bold text-base">Configure Text Answer</h3>
                <div className="space-y-2">
                  <Label htmlFor="textAnswer" className="font-semibold text-sm">Correct Answer (Exact Match, Case Insensitive) *</Label>
                  <Input
                    id="textAnswer"
                    placeholder="e.g. cin"
                    value={textCorrectAnswer}
                    onChange={(e) => setTextCorrectAnswer(e.target.value)}
                    required={questionType === "text"}
                    className="rounded-2xl bg-input/50 font-mono"
                  />
                </div>
              </div>
            )}

            {/* CODE SECTION */}
            {questionType === "code" && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-base">Execution Constraints</h3>
                  <p className="text-xs text-muted-foreground">Adjust sandbox constraints for execution runs.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit" className="font-semibold text-sm">Execution Timeout Limit (Seconds)</Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      min={1}
                      max={15}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      className="rounded-2xl bg-input/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="memoryLimit" className="font-semibold text-sm">Memory Limit (KB)</Label>
                    <Input
                      id="memoryLimit"
                      type="number"
                      min={1000}
                      max={512000}
                      value={memoryLimit}
                      onChange={(e) => setMemoryLimit(Number(e.target.value))}
                      className="rounded-2xl bg-input/50"
                    />
                  </div>
                </div>

                <Separator />

                {/* Test Cases Builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">Test Cases</h3>
                      <p className="text-xs text-muted-foreground">Add input and expected output pairs. Samples are shown to students.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTestCase}
                      className="rounded-xl gap-1.5"
                    >
                      <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
                      Add Test Case
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="p-4 rounded-2xl border border-border/40 bg-muted/10 space-y-3 relative group">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-muted-foreground">Test Case #{idx + 1}</span>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                              <Switch
                                size="sm"
                                checked={tc.isSample}
                                onCheckedChange={(val) => handleTestCaseChange(idx, "isSample", val)}
                              />
                              Sample Case
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTestCase(idx)}
                              className="rounded-xl text-destructive hover:bg-destructive/10 h-7 px-2"
                            >
                              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Input stdin</Label>
                            <Textarea
                              value={tc.input}
                              onChange={(e) => handleTestCaseChange(idx, "input", e.target.value)}
                              rows={2}
                              className="font-mono text-xs rounded-xl bg-input/50"
                              placeholder="Input values..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Expected stdout</Label>
                            <Textarea
                              value={tc.expectedOutput}
                              onChange={(e) => handleTestCaseChange(idx, "expectedOutput", e.target.value)}
                              rows={2}
                              className="font-mono text-xs rounded-xl bg-input/50"
                              placeholder="Expected stdout values..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Boilerplate Starter Codes */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-base">Custom Boilerplate Starter Code</h3>
                    <p className="text-xs text-muted-foreground">Customize template code rendered when a student loads this coding task.</p>
                  </div>

                  <Tabs defaultValue="71" className="w-full">
                    <TabsList className="bg-muted/40 rounded-xl p-1 gap-1">
                      <TabsTrigger value="71" className="rounded-lg text-xs">Python</TabsTrigger>
                      <TabsTrigger value="63" className="rounded-lg text-xs">NodeJS</TabsTrigger>
                      <TabsTrigger value="54" className="rounded-lg text-xs">C++</TabsTrigger>
                      <TabsTrigger value="50" className="rounded-lg text-xs">C</TabsTrigger>
                      <TabsTrigger value="62" className="rounded-lg text-xs">Java</TabsTrigger>
                    </TabsList>
                    
                    {Object.keys(DEFAULT_STARTER_CODES).map((langId) => (
                      <TabsContent key={langId} value={langId} className="pt-2">
                        <Textarea
                          value={starterCodes[langId] || ""}
                          onChange={(e) => setStarterCodes({ ...starterCodes, [langId]: e.target.value })}
                          rows={10}
                          className="font-mono text-xs rounded-2xl bg-input/50 resize-none"
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </div>
            )}

            <Separator />

            {/* Form actions */}
            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push(`/dashboard/contests/${contestId}`)}
                className="rounded-2xl px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={addQuestionMutation.isPending}
                className="rounded-2xl bg-primary text-primary-foreground px-6 gap-2"
              >
                {addQuestionMutation.isPending ? <Spinner className="size-4" /> : (
                  <>
                    <HugeiconsIcon icon={SaveIcon} className="size-4" />
                    Save Question
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
