"use client";

import { Badge } from "@/components/ui/badge";

interface QuestionStatusBadgeProps {
  status?: string | null;
  className?: string;
}

export function QuestionStatusBadge({ status, className }: QuestionStatusBadgeProps) {
  switch (status) {
    case "APPROVED":
      return (
        <Badge
          variant="outline"
          className={`bg-green-500/10 text-green-500 border-green-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-green-500" />
          Approved
        </Badge>
      );
    case "CHANGES_REQUESTED":
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-500 border-amber-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          Changes Requested
        </Badge>
      );
    case "UNDER_REVIEW":
      return (
        <Badge
          variant="outline"
          className={`bg-blue-500/10 text-blue-500 border-blue-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
          Under Review
        </Badge>
      );
    case "SUBMITTED_FOR_REVIEW":
      return (
        <Badge
          variant="outline"
          className={`bg-purple-500/10 text-purple-500 border-purple-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-purple-500" />
          Submitted
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge
          variant="outline"
          className={`bg-red-500/10 text-red-500 border-red-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-red-500" />
          Rejected
        </Badge>
      );
    case "IN_REVIEW":
      return (
        <Badge
          variant="outline"
          className={`bg-blue-500/10 text-blue-500 border-blue-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
          In Review
        </Badge>
      );
    case "PENDING":
      return (
        <Badge
          variant="outline"
          className={`bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-2xs font-bold uppercase gap-1 ${
            className || ""
          }`}
        >
          <span className="size-1.5 rounded-full bg-yellow-500" />
          Pending Pickup
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge
          variant="outline"
          className={`bg-muted text-muted-foreground text-2xs font-bold uppercase ${
            className || ""
          }`}
        >
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-muted text-muted-foreground text-2xs font-bold uppercase ${
            className || ""
          }`}
        >
          {status ? status.replace(/_/g, " ") : "Draft"}
        </Badge>
      );
  }
}

interface ReviewAssignmentStatusBadgeProps {
  assignment: {
    status: string;
    question?: { status?: string | null } | null;
  };
  tab?: "assigned" | "history";
  className?: string;
}

export function ReviewAssignmentStatusBadge({
  assignment,
  tab,
  className,
}: ReviewAssignmentStatusBadgeProps) {
  if (
    tab === "history" ||
    assignment.status === "COMPLETED" ||
    assignment.status === "CANCELLED"
  ) {
    return (
      <QuestionStatusBadge
        status={assignment.question?.status || assignment.status}
        className={className}
      />
    );
  }
  return <QuestionStatusBadge status={assignment.status} className={className} />;
}
