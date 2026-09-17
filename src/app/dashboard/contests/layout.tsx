"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

function getUserRoles(user: any): string[] {
  if (Array.isArray(user?.roles)) return user.roles;
  if (typeof user?.roles === "string") {
    try {
      const parsed = JSON.parse(user.roles);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [user.roles];
    }
  }
  if (user?.role && typeof user.role === "string") return [user.role];
  return ["student"];
}

export default function ContestsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const roles = getUserRoles(session?.user);
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (!isPending && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isPending, isAdmin, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
