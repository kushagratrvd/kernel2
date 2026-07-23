"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Edit01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";

export default function EditContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;

  // Query contest details
  const { data: contestData, isLoading, error } = useQuery(
    trpc.contest.getForEdit.queryOptions({ id: contestId }),
  );

  // Form State
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [totalTime, setTotalTime] = useState(60);
  const [isActive, setIsActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load existing contest data
  useEffect(() => {
    if (contestData) {
      setTitle(contestData.title);
      setCode(contestData.code);
      setDescription(contestData.description || "");
      setCoverImageUrl(contestData.coverImageUrl || "");
      
      // format Date objects to YYYY-MM-DDTHH:mm for datetime-local input
      const formatDateTime = (dateVal: Date | string | number) => {
        const d = new Date(dateVal);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setStartTime(formatDateTime(contestData.startTime));
      setEndTime(formatDateTime(contestData.endTime));
      setTotalTime(contestData.totalTime);
      setIsActive(contestData.isActive);
    }
  }, [contestData]);

  // Automatically calculate duration (totalTime) when startTime or endTime changes
  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        const diffMinutes = Math.max(0, Math.round((end - start) / (1000 * 60)));
        setTotalTime(diffMinutes);
      }
    }
  }, [startTime, endTime]);

  const updateContestMutation = useMutation(trpc.contest.update.mutationOptions());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title || !code || !startTime || !endTime || !totalTime) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    try {
      await updateContestMutation.mutateAsync({
        id: contestId,
        title,
        code: code.trim().toUpperCase(),
        description: description || null,
        coverImageUrl: coverImageUrl || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        totalTime: Number(totalTime),
        isActive,
      });

      router.push(`/dashboard/contests/${contestId}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update contest. Ensure the code is unique.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !contestData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <HugeiconsIcon icon={AlertCircleIcon} className="size-12 text-destructive animate-bounce" />
        <h2 className="text-xl font-bold mt-4">Contest Not Found</h2>
        <Button onClick={() => router.push("/dashboard")} className="mt-4 rounded-xl">
          Back to Dashboard
        </Button>
      </div>
    );
  }

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
            Back
          </Button>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Edit Contest Settings
          </span>
        </div>
      </header>

      {/* Form Container */}
      <main className="flex-1 p-6 lg:p-10 max-w-3xl mx-auto w-full">
        <div className="rounded-3xl border border-border/40 bg-card p-6 lg:p-8 shadow-sm backdrop-blur-md space-y-6">
          <div>
            <h1 className="text-2xl font-black">Edit Contest</h1>
            <p className="text-sm text-muted-foreground">Modify the properties, duration, scheduling and status of the contest.</p>
          </div>

          <Separator />

          {errorMsg && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-semibold text-sm">Contest Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Summer Coding Hackathon"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="rounded-2xl bg-input/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="font-semibold text-sm">Contest Code (Unique Identifier) *</Label>
                <Input
                  id="code"
                  placeholder="e.g., ALGO2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="rounded-2xl bg-input/50 uppercase font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold text-sm">Description</Label>
              <Textarea
                id="description"
                placeholder="Give a short summary of topics, rules, and restrictions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-2xl bg-input/50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImageUrl" className="font-semibold text-sm">Cover Image URL (Optional)</Label>
              <Input
                id="coverImageUrl"
                placeholder="https://example.com/cover.png"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="rounded-2xl bg-input/50"
              />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="font-semibold text-sm">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="rounded-2xl bg-input/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime" className="font-semibold text-sm">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="rounded-2xl bg-input/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalTime" className="font-semibold text-sm">Duration (Minutes) *</Label>
                <Input
                  id="totalTime"
                  type="number"
                  min={1}
                  value={totalTime}
                  onChange={(e) => setTotalTime(Number(e.target.value))}
                  required
                  className="rounded-2xl bg-input/50 font-bold"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-2xl border border-border/30 bg-muted/20 p-4">
              <div className="space-y-1">
                <Label htmlFor="isActive" className="font-bold text-sm">Active & Published</Label>
                <p className="text-xs text-muted-foreground">If active, registered students will be able to see and join the contest.</p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

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
                disabled={updateContestMutation.isPending}
                className="rounded-2xl bg-primary text-primary-foreground px-6 gap-2"
              >
                {updateContestMutation.isPending ? <Spinner className="size-4" /> : (
                  <>
                    <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                    Save Changes
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
