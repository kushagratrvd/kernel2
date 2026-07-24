"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, KeyIcon, Logout01Icon } from "@hugeicons/core-free-icons";

import { ModeToggle } from "@/components/ui/mode-toggle";

export default function ContestPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { data: session } = authClient.useSession();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    router.push(`/contest/${code.trim().toUpperCase()}`);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/signin");
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-secondary/15" />
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-chart-1/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-chart-3/10 blur-3xl" />

      {/* Header bar */}
      <header className="absolute top-0 flex w-full justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/95 text-primary-foreground shadow-sm">
            <span className="text-sm font-bold">K</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Kernel
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
            <HugeiconsIcon icon={Logout01Icon} className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      {/* Code Entry Card */}
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/40 bg-card/60 p-8 shadow-xl backdrop-blur-xl dark:bg-card/40">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Enter Contest Code</h2>
          <p className="text-sm text-muted-foreground">
            {session?.user?.name ? `Welcome back, ${session.user.name}. ` : ""}
            Please enter your contest code to proceed.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="sr-only">
              Contest Code
            </Label>
            <div className="relative">
              <HugeiconsIcon
                icon={KeyIcon}
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Input
                id="code"
                placeholder="e.g. KRN101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="pl-10 text-center text-lg font-mono tracking-wider uppercase"
                autoFocus
                maxLength={10}
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="group w-full gap-2" disabled={!code.trim()}>
            Join Contest
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 transition-transform group-hover/button:translate-x-0.5"
              strokeWidth={2}
            />
          </Button>
        </form>
      </div>
    </div>
  );
}
