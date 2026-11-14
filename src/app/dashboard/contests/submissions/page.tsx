"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  RefreshIcon,
  FilterIcon,
  Search01Icon,
  CodeSquareIcon,
  EyeIcon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  Clock01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { StudentSubmissionsDrawer } from "@/components/contests/student-submissions-drawer";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { getLanguageInfo } from "@/lib/language-map";
import { formatDistanceToNow, format } from "date-fns";

export default function GlobalSubmissionsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Filters
  const [selectedContestId, setSelectedContestId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLivePolling, setIsLivePolling] = useState<boolean>(true);

  // Submissions State (managed locally to support live prepending and history appending)
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

  // Drawer Inspection State
  const [inspectingUser, setInspectingUser] = useState<{
    userId: string;
    contestId: string;
    contestQuestionId?: string;
  } | null>(null);

  // Load contest list for filter dropdown
  const { data: contests = [] } = useQuery(trpc.contest.listAll.queryOptions());

  // Initial load query (fetches latest 50 submissions)
  const {
    data: initialData,
    isLoading: isInitialLoading,
    refetch: refetchInitial,
  } = useQuery(
    trpc.contest.adminGetSubmissions.queryOptions(
      {
        contestId: selectedContestId !== "ALL" ? selectedContestId : undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        limit: 50,
      },
      {
        // Don't auto-poll full query; we use cursor polling for incremental updates
        refetchOnWindowFocus: false,
      }
    )
  );

  // Sync initial query results into local state
  useEffect(() => {
    if (initialData) {
      setSubmissions(initialData);
      setHasMoreOlder(initialData.length >= 50);
    }
  }, [initialData]);

  // Track newest timestamp for cursor polling
  const newestTimestampRef = useRef<Date | null>(null);
  useEffect(() => {
    if (submissions.length > 0) {
      newestTimestampRef.current = new Date(submissions[0].createdAt);
    } else {
      newestTimestampRef.current = null;
    }
  }, [submissions]);

  // Live incremental poll (every 4 seconds)
  useEffect(() => {
    if (!isLivePolling) return;

    const interval = setInterval(async () => {
      if (!newestTimestampRef.current) return;

      try {
        const newArrivals = await queryClient.fetchQuery(
          trpc.contest.adminGetSubmissions.queryOptions({
            contestId: selectedContestId !== "ALL" ? selectedContestId : undefined,
            status: selectedStatus !== "ALL" ? selectedStatus : undefined,
            afterCursor: newestTimestampRef.current,
            limit: 20,
          })
        );

        if (newArrivals && newArrivals.length > 0) {
          setSubmissions((prev) => {
            // Deduplicate by ID
            const existingIds = new Set(prev.map((s) => s.id));
            const freshItems = newArrivals.filter((item: any) => !existingIds.has(item.id));
            if (freshItems.length === 0) return prev;
            return [...freshItems, ...prev];
          });
        }
      } catch (err) {
        console.error("Live submissions poll failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isLivePolling, selectedContestId, selectedStatus, trpc, queryClient]);

  // Load older submissions (pagination downwards)
  const handleLoadOlder = async () => {
    if (submissions.length === 0 || isLoadingOlder) return;
    setIsLoadingOlder(true);

    const oldestTimestamp = new Date(submissions[submissions.length - 1].createdAt);

    try {
      const olderSubmissions = await queryClient.fetchQuery(
        trpc.contest.adminGetSubmissions.queryOptions({
          contestId: selectedContestId !== "ALL" ? selectedContestId : undefined,
          status: selectedStatus !== "ALL" ? selectedStatus : undefined,
          beforeCursor: oldestTimestamp,
          limit: 30,
        })
      );

      if (olderSubmissions && olderSubmissions.length > 0) {
        setSubmissions((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const uniqueOlder = olderSubmissions.filter((item: any) => !existingIds.has(item.id));
          return [...prev, ...uniqueOlder];
        });
        setHasMoreOlder(olderSubmissions.length >= 30);
      } else {
        setHasMoreOlder(false);
      }
    } catch (err) {
      console.error("Failed to load older submissions:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Client-side search filtering by student name/email
  const filteredSubmissions = submissions.filter((sub) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = sub.user?.name?.toLowerCase().includes(q);
    const emailMatch = sub.user?.email?.toLowerCase().includes(q);
    const problemMatch = sub.contestQuestion?.version?.title?.toLowerCase().includes(q);
    return nameMatch || emailMatch || problemMatch;
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push("/dashboard")}
            variant="ghost"
            size="sm"
            className="gap-1 rounded-xl"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Dashboard
          </Button>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-foreground">
              Live Code Submissions
            </span>
            {isLivePolling && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={isLivePolling ? "default" : "outline"}
            className="h-8 text-xs rounded-xl gap-1.5"
            onClick={() => setIsLivePolling(!isLivePolling)}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isLivePolling ? "animate-spin" : ""}`}
            />
            {isLivePolling ? "Live Polling (4s)" : "Resume Live"}
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* Workspace */}
      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Filter Controls Bar */}
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Contest Filter */}
            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Contest
              </label>
              <Select
                value={selectedContestId}
                onValueChange={(val) => setSelectedContestId(val ?? "ALL")}
              >
                <SelectTrigger className="w-full h-9 rounded-xl border border-border/50 bg-background px-3 text-xs focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="All Contests" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border/50 bg-popover shadow-xl p-1 max-h-72">
                  <SelectItem value="ALL">All Contests</SelectItem>
                  {contests?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="truncate">{c.title}</span>
                      <span className="ml-1.5 font-mono text-2xs text-muted-foreground">({c.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Verdict Status
              </label>
              <Select
                value={selectedStatus}
                onValueChange={(val) => setSelectedStatus(val ?? "ALL")}
              >
                <SelectTrigger className="w-full h-9 rounded-xl border border-border/50 bg-background px-3 text-xs focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border/50 bg-popover shadow-xl p-1">
                  <SelectItem value="ALL">
                    <span className="inline-block size-2 rounded-full bg-zinc-400 mr-2" />
                    All Statuses
                  </SelectItem>
                  <SelectItem value="Accepted">
                    <span className="inline-block size-2 rounded-full bg-emerald-500 mr-2" />
                    Accepted
                  </SelectItem>
                  <SelectItem value="Wrong Answer">
                    <span className="inline-block size-2 rounded-full bg-rose-500 mr-2" />
                    Wrong Answer
                  </SelectItem>
                  <SelectItem value="Time Limit Exceeded">
                    <span className="inline-block size-2 rounded-full bg-amber-500 mr-2" />
                    Time Limit Exceeded
                  </SelectItem>
                  <SelectItem value="Compilation Error">
                    <span className="inline-block size-2 rounded-full bg-orange-500 mr-2" />
                    Compilation Error
                  </SelectItem>
                  <SelectItem value="Runtime Error">
                    <span className="inline-block size-2 rounded-full bg-purple-500 mr-2" />
                    Runtime Error
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="sm:col-span-2">
              <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Search Student or Problem
              </label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="size-4 text-muted-foreground absolute left-3 top-2.5"
                />
                <input
                  type="text"
                  placeholder="Filter by student name, email, or problem title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submissions Table with Horizontal Slider */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1000px]">
              <thead className="bg-muted/40 border-b border-border/40 text-2xs uppercase tracking-wider font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Contest</th>
                  <th className="py-3 px-4">Problem</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {isInitialLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <Spinner className="size-7 mx-auto" />
                      <p className="text-xs text-muted-foreground mt-2">Loading submissions feed...</p>
                    </td>
                  </tr>
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center space-y-2">
                      <HugeiconsIcon icon={CodeSquareIcon} className="size-8 text-muted-foreground mx-auto opacity-40" />
                      <p className="font-semibold text-sm text-foreground">No submissions found</p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery ? "Try adjusting your search query or filters." : "Incoming code submissions will appear here in real-time."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const langInfo = getLanguageInfo(sub.languageId);
                    const isAccepted = sub.status === "Accepted";
                    const maxMarks = sub.contestQuestion?.marks ?? 100;

                    return (
                      <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                        {/* Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                          <span title={format(new Date(sub.createdAt), "PPpp")}>
                            {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                          </span>
                        </td>

                        {/* Student */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xs shrink-0">
                              {sub.user?.name ? sub.user.name.charAt(0).toUpperCase() : <HugeiconsIcon icon={UserIcon} className="size-3" />}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground text-xs leading-none">
                                {sub.user?.name || "Student"}
                              </div>
                              <div className="text-2xs text-muted-foreground mt-0.5">
                                {sub.user?.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contest */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-foreground text-xs leading-none">
                            {sub.contest?.title || "Contest"}
                          </div>
                          <code className="text-2xs text-muted-foreground font-mono mt-0.5 block">
                            {sub.contest?.code}
                          </code>
                        </td>

                        {/* Problem */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-foreground">
                            #{sub.contestQuestion?.questionOrder}:{" "}
                            {sub.contestQuestion?.version?.title || "Coding Problem"}
                          </span>
                        </td>

                        {/* Language */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-foreground text-2xs font-mono font-medium">
                            {langInfo.name}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold border ${
                              isAccepted
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : sub.status === "Wrong Answer"
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                : sub.status === "Time Limit Exceeded"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                            }`}
                          >
                            <HugeiconsIcon
                              icon={isAccepted ? CheckmarkCircle01Icon : AlertCircleIcon}
                              className="size-3 shrink-0"
                            />
                            {sub.status}
                          </span>
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-foreground">
                          {sub.scoreObtained} / {maxMarks}
                        </td>

                        {/* Action: Inspect Drawer */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-xl gap-1 px-2.5"
                            onClick={() =>
                              setInspectingUser({
                                userId: sub.userId,
                                contestId: sub.contestId,
                                contestQuestionId: sub.contestQuestionId,
                              })
                            }
                          >
                            <HugeiconsIcon icon={EyeIcon} className="size-3.5" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Historical Submissions */}
          {hasMoreOlder && submissions.length > 0 && (
            <div className="p-4 border-t border-border/40 text-center bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5"
                onClick={handleLoadOlder}
                disabled={isLoadingOlder}
              >
                {isLoadingOlder ? <Spinner className="size-3.5" /> : <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />}
                {isLoadingOlder ? "Loading older submissions..." : "Load Older Submissions"}
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Per-Student Inspection Drawer */}
      <StudentSubmissionsDrawer
        isOpen={!!inspectingUser}
        onOpenChange={(open) => !open && setInspectingUser(null)}
        contestId={inspectingUser?.contestId ?? ""}
        userId={inspectingUser?.userId ?? null}
        initialContestQuestionId={inspectingUser?.contestQuestionId}
      />
    </div>
  );
}
