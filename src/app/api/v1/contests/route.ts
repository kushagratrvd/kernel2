import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { contest } from "@/server/db/contest-schema";
import { sql, desc } from "drizzle-orm";
import { authenticateApiKey } from "@/server/api-key-auth";

/**
 * GET /api/v1/contests
 *
 * Exposes a listing of contests for external integrations (e.g. CareerForge).
 * Protected by X-Kernel-Api-Key.
 *
 * Query Parameters:
 * - status: "all" | "live" | "past" | "upcoming" (default: "all")
 * - limit: number (default: 50)
 */
export async function GET(request: NextRequest) {
  const auth = authenticateApiKey(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status")?.toLowerCase() || "all";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);

    // Fetch contests with authoritative DB clock expressions
    const contests = await db
      .select({
        id: contest.id,
        code: contest.code,
        title: contest.title,
        description: contest.description,
        coverImageUrl: contest.coverImageUrl,
        startTime: contest.startTime,
        endTime: contest.endTime,
        totalQuestions: contest.totalQuestions,
        totalTime: contest.totalTime,
        totalScore: contest.totalScore,
        duration: contest.duration,
        isActive: contest.isActive,
        isEnded: sql<boolean>`NOW() >= ${contest.endTime}`,
        isLive: sql<boolean>`NOW() >= ${contest.startTime} AND NOW() < ${contest.endTime}`,
        isUpcoming: sql<boolean>`NOW() < ${contest.startTime}`,
      })
      .from(contest)
      .orderBy(desc(contest.startTime))
      .limit(limit);

    const projectedContests = contests
      .map((c) => {
        let status: "UPCOMING" | "LIVE" | "CONCLUDED" = "UPCOMING";
        if (c.isEnded) {
          status = "CONCLUDED";
        } else if (c.isLive) {
          status = "LIVE";
        }

        return {
          id: c.id,
          code: c.code,
          title: c.title,
          description: c.description,
          coverImageUrl: c.coverImageUrl,
          startTime: c.startTime,
          endTime: c.endTime,
          totalQuestions: c.totalQuestions,
          totalTime: c.totalTime,
          totalScore: c.totalScore,
          duration: c.duration,
          status,
          isLive: Boolean(c.isLive),
          isEnded: Boolean(c.isEnded),
          isUpcoming: Boolean(c.isUpcoming),
        };
      })
      .filter((c) => {
        if (filterStatus === "live") return c.status === "LIVE";
        if (filterStatus === "past" || filterStatus === "concluded") return c.status === "CONCLUDED";
        if (filterStatus === "upcoming") return c.status === "UPCOMING";
        return true;
      });

    return NextResponse.json({
      success: true,
      count: projectedContests.length,
      contests: projectedContests,
    });
  } catch (error) {
    console.error("Error fetching contests in /api/v1/contests:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
