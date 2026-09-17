"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";
import { getUserRoles } from "@/lib/get-user-roles";

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
