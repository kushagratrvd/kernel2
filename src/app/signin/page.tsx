"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  LockPasswordIcon,
  ViewIcon,
  ViewOffIcon,
  ArrowRight01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Invalid email or password.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full">
      {/* Left panel — decorative hero */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-chart-1/20 to-chart-3/30 dark:from-primary/10 dark:via-chart-1/8 dark:to-chart-3/15" />
        <div className="animate-hero-blob absolute -top-32 -left-32 h-96 w-96 rounded-full bg-chart-1/20 blur-3xl dark:bg-chart-1/10" />
        <div className="animate-hero-blob-delayed absolute -right-24 bottom-24 h-80 w-80 rounded-full bg-chart-3/25 blur-3xl dark:bg-chart-3/10" />
        <div className="animate-hero-blob-slow absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-2/15 blur-3xl dark:bg-chart-2/8" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          {/* Logo / brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-lg">
              <span className="text-lg font-bold tracking-tight">K</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Kernel
            </span>
          </div>

          {/* Hero text */}
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground">
              Welcome back to
              <br />
              <span className="bg-gradient-to-r from-chart-1 to-chart-3 bg-clip-text text-transparent">
                Kernel Platform
              </span>
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Sign in to access your contests, track progress, and compete with
              the best.
            </p>
          </div>

          {/* Footer quote */}
          <div className="space-y-3">
            <Separator className="opacity-20" />
            <p className="text-sm text-muted-foreground/70">
              &ldquo;The only way to do great work is to love what you
              do.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-lg">
            <span className="text-lg font-bold tracking-tight">K</span>
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">
            Kernel
          </span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive dark:border-destructive/20 dark:bg-destructive/10">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={2}
              />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-5">
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Mail01Icon}
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={LockPasswordIcon}
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <HugeiconsIcon
                    icon={showPassword ? ViewOffIcon : ViewIcon}
                    className="size-4"
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="group w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Spinner className="size-4" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 transition-transform group-hover/button:translate-x-0.5"
                    strokeWidth={2}
                  />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}