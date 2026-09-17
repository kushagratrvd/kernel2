"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  UserGroupIcon,
  AddCircleIcon,
  SearchIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Shield01Icon,
  Edit01Icon,
  Cancel01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { ModeToggle } from "@/components/ui/mode-toggle";

const AVAILABLE_ROLES = [
  {
    id: "creator" as const,
    label: "Creator",
    description: "Create and draft questions, design contests, and submit for verification.",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  {
    id: "reviewer" as const,
    label: "Reviewer",
    description: "Review submitted questions, suggest improvements, and approve into Question Bank.",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  {
    id: "admin" as const,
    label: "Admin",
    description: "Full platform governance: user & role management, platform audits, all reviews.",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  {
    id: "student" as const,
    label: "Student",
    description: "Participate in contests, take coding assessments, and view results.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedNewRoles, setSelectedNewRoles] = useState<("admin" | "creator" | "reviewer" | "student")[]>([
    "creator",
  ]);
  const [createError, setCreateError] = useState("");

  // Role Edit Modal State
  const [managingUser, setManagingUser] = useState<any | null>(null);

  // Queries
  const { data: users, isLoading, refetch } = useQuery(
    trpc.admin.listUsers.queryOptions({
      search: searchTerm.trim() || undefined,
      role: selectedRoleFilter === "ALL" ? undefined : selectedRoleFilter,
      status: selectedStatusFilter === "ALL" ? undefined : (selectedStatusFilter as any),
    })
  );

  // Mutations
  const createUserMutation = useMutation(
    trpc.admin.createUser.mutationOptions({
      onSuccess: () => {
        setIsCreateModalOpen(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setSelectedNewRoles(["creator"]);
        setCreateError("");
        refetch();
      },
      onError: (err: any) => {
        setCreateError(err.message || "Failed to create user.");
      },
    })
  );

  const addRoleMutation = useMutation(
    trpc.admin.addRole.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const removeRoleMutation = useMutation(
    trpc.admin.removeRole.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const setStatusMutation = useMutation(
    trpc.admin.setUserStatus.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newName || !newEmail || !newPassword) {
      setCreateError("Please fill in all fields.");
      return;
    }

    if (selectedNewRoles.length === 0) {
      setCreateError("Please select at least one role.");
      return;
    }

    await createUserMutation.mutateAsync({
      name: newName,
      email: newEmail,
      password: newPassword,
      roles: selectedNewRoles,
    });
  };

  const toggleRoleOnUser = async (targetUser: any, role: "admin" | "creator" | "reviewer" | "student") => {
    const hasRole = targetUser.roles.includes(role);
    if (hasRole) {
      if (targetUser.roles.length <= 1) {
        alert("A user must have at least one role.");
        return;
      }
      if (confirm(`Remove ${role.toUpperCase()} role from ${targetUser.name}?`)) {
        await removeRoleMutation.mutateAsync({ userId: targetUser.id, role });
      }
    } else {
      await addRoleMutation.mutateAsync({ userId: targetUser.id, role });
    }
  };

  const toggleUserStatus = async (targetUser: any) => {
    const nextStatus = targetUser.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (targetUser.id === session?.user?.id && nextStatus === "INACTIVE") {
      alert("You cannot deactivate your own account.");
      return;
    }
    if (confirm(`Are you sure you want to mark ${targetUser.name} as ${nextStatus}?`)) {
      await setStatusMutation.mutateAsync({
        userId: targetUser.id,
        status: nextStatus,
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-secondary/10" />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="rounded-xl gap-1 text-xs"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Back to Dashboard
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Shield01Icon} className="size-5 text-primary" />
            <span className="text-base font-bold tracking-tight">User & Role Management</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-2xl gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-4 h-9 shadow-sm"
          >
            <HugeiconsIcon icon={AddCircleIcon} className="size-4" />
            Add User / Role
          </Button>
          <ModeToggle />
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 space-y-6">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl border border-border/40 bg-card shadow-xs backdrop-blur-md">
          <div>
            <h1 className="text-2xl font-black text-foreground">User & Role Administration</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add creators and reviewers, assign or revoke permissions, and govern platform privileges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-muted/40 px-3.5 py-2 rounded-2xl border border-border/40 text-xs">
              <HugeiconsIcon icon={UserGroupIcon} className="size-4 text-primary" />
              <span className="font-semibold text-muted-foreground">Total Users:</span>
              <span className="font-bold text-foreground">{users?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 rounded-3xl border border-border/40 bg-card shadow-xs backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <HugeiconsIcon
              icon={SearchIcon}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            />
            <Input
              placeholder="Search by name or email address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-2xl bg-input/40 text-sm h-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto text-xs">
            {/* Role Filter */}
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/40 bg-muted/40 px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="creator">Creators</option>
              <option value="reviewer">Reviewers</option>
              <option value="admin">Admins</option>
              <option value="student">Students</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/40 bg-muted/40 px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        <div className="rounded-3xl border border-border/40 bg-card shadow-xs overflow-hidden backdrop-blur-md">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Spinner className="size-8 text-primary" />
              <p className="text-xs text-muted-foreground">Loading users...</p>
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 p-6">
              <HugeiconsIcon icon={UserGroupIcon} className="size-12 text-muted-foreground/40" />
              <h3 className="text-base font-bold">No Users Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Try adjusting your search criteria or add a new user to the platform.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 overflow-x-auto">
              {users.map((u) => {
                const isCurrentUser = u.id === session?.user?.id;
                const rolesList = u.roles || [];

                return (
                  <div
                    key={u.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                  >
                    {/* User Info */}
                    <div className="space-y-1 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{u.name}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-3xs bg-primary/10 text-primary border-primary/30">
                            You
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-3xs font-bold uppercase ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                          }`}
                        >
                          {u.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>

                    {/* Assigned Roles (Interactive Click-to-Manage) */}
                    <div className="flex-1 min-w-[260px] space-y-1.5">
                      <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">
                        Assigned Roles:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {AVAILABLE_ROLES.map((roleDef) => {
                          const hasRole = rolesList.includes(roleDef.id);
                          return (
                            <button
                              key={roleDef.id}
                              type="button"
                              onClick={() => toggleRoleOnUser(u, roleDef.id)}
                              title={
                                hasRole
                                  ? `Click to revoke ${roleDef.label} role`
                                  : `Click to grant ${roleDef.label} role`
                              }
                              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold border transition-all ${
                                hasRole
                                  ? `${roleDef.color} shadow-xs hover:opacity-80`
                                  : "bg-muted/20 text-muted-foreground/50 border-border/30 hover:border-border/80 hover:text-foreground"
                              }`}
                            >
                              {hasRole ? (
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
                              ) : (
                                <span className="text-2xs font-mono">+</span>
                              )}
                              {roleDef.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleUserStatus(u)}
                        disabled={isCurrentUser && u.status === "ACTIVE"}
                        className={`rounded-xl text-xs h-8 px-3 ${
                          u.status === "ACTIVE"
                            ? "text-muted-foreground hover:text-destructive"
                            : "text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add New User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <HugeiconsIcon icon={AddCircleIcon} className="size-5 text-primary" />
              Provision New User
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create an account with initial login credentials and assign platform roles.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="newName" className="text-xs font-semibold">
                Full Name *
              </Label>
              <Input
                id="newName"
                placeholder="e.g. Jane Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="rounded-xl bg-input/40 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newEmail" className="text-xs font-semibold">
                Email Address *
              </Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="e.g. jane.doe@school.edu"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="rounded-xl bg-input/40 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs font-semibold">
                Temporary Password *
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="rounded-xl bg-input/40 text-sm"
              />
            </div>

            <Separator className="my-2" />

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Assign Roles *</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_ROLES.map((roleDef) => {
                  const isChecked = selectedNewRoles.includes(roleDef.id);
                  return (
                    <button
                      type="button"
                      key={roleDef.id}
                      onClick={() => {
                        setSelectedNewRoles((prev) =>
                          isChecked
                            ? prev.filter((r) => r !== roleDef.id)
                            : [...prev, roleDef.id]
                        );
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isChecked
                          ? `${roleDef.color} shadow-xs font-bold ring-1 ring-primary/40`
                          : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{roleDef.label}</span>
                        {isChecked && (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                        )}
                      </div>
                      <p className="text-3xs text-muted-foreground mt-1 line-clamp-2">
                        {roleDef.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="rounded-xl text-xs bg-primary text-primary-foreground font-semibold px-5"
              >
                {createUserMutation.isPending ? <Spinner className="size-4" /> : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
