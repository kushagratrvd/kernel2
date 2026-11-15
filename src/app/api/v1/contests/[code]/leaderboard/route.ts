import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { contest, contestParticipation } from "@/server/db/contest-schema";
import { user } from "@/server/db/auth-schema";
import { eq, sql, desc, asc, and } from "drizzle-orm";
import { authenticateApiKey } from "@/server/api-key-auth";

/**
 * GET /api/v1/contests/:code/leaderboard
 *
 * Exposes the official contest leaderboard for external platforms (e.g. CareerForge).
 * Protected by X-Kernel-Api-Key.
 *
 * Security & Anti-Cheating Invariant:
 * - When the contest is still running (NOW() < endTime), the leaderboard is strictly
 *   TIME-LOCKED to prevent answer leaks or live rank surveillance.
 * - When the contest has concluded (NOW() >= endTime), the verified leaderboard is revealed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = authenticateApiKey(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Contest code is required" },
        { status: 400 }
      );
    }

    // Look up contest with authoritative DB clock expressions
    const [foundContest] = await db
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
      })
      .from(contest)
      .where(sql`LOWER(${contest.code}) = LOWER(${code.trim()})`);

    if (!foundContest) {
      return NextResponse.json(
        { success: false, error: `Contest with code '${code}' was not found.` },
        { status: 404 }
      );
    }

    const isEnded = Boolean(foundContest.isEnded);
    const isLive = Boolean(foundContest.isLive);

    const contestSummary = {
      id: foundContest.id,
      code: foundContest.code,
      title: foundContest.title,
      description: foundContest.description,
      coverImageUrl: foundContest.coverImageUrl,
      startTime: foundContest.startTime,
      endTime: foundContest.endTime,
      totalQuestions: foundContest.totalQuestions,
      totalTime: foundContest.totalTime,
      totalScore: foundContest.totalScore,
      duration: foundContest.duration,
      isEnded,
      isLive,
    };

    // If contest has not ended, strictly enforce time-lock
    if (!isEnded) {
      return NextResponse.json({
        success: true,
        contest: contestSummary,
        timeLocked: true,
        message:
          "Contest is still ongoing. The official leaderboard will be released once the contest concludes at " +
          foundContest.endTime.toISOString(),
        totalParticipants: 0,
        leaderboard: [],
      });
    }

    // Fetch ranked participants
    const participants = await db
      .select({
        participationId: contestParticipation.id,
        userId: contestParticipation.userId,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        score: contestParticipation.score,
        rank: contestParticipation.rank,
        joinedAt: contestParticipation.joinedAt,
        startedAt: contestParticipation.startedAt,
        finishedAt: contestParticipation.finishedAt,
      })
      .from(contestParticipation)
      .innerJoin(user, eq(contestParticipation.userId, user.id))
      .where(eq(contestParticipation.contestId, foundContest.id))
      .orderBy(
        desc(contestParticipation.score),
        asc(contestParticipation.finishedAt),
        asc(contestParticipation.joinedAt)
      );

    const leaderboard = participants.map((p, index) => {
      const durationMinutes =
        p.finishedAt && p.startedAt
          ? Math.max(
              0,
              Math.round(
                (new Date(p.finishedAt).getTime() - new Date(p.startedAt).getTime()) / 60000
              )
            )
          : null;

      return {
        rank: p.rank ?? index + 1,
        studentId: p.userId,
        studentName: p.userName,
        studentEmail: p.userEmail,
        studentImage: p.userImage,
        score: p.score,
        maxScore: foundContest.totalScore,
        percentage:
          foundContest.totalScore > 0
            ? Math.round((p.score / foundContest.totalScore) * 100)
            : 0,
        joinedAt: p.joinedAt,
        startedAt: p.startedAt,
        finishedAt: p.finishedAt,
        durationMinutes,
      };
    });

    return NextResponse.json({
      success: true,
      contest: contestSummary,
      timeLocked: false,
      totalParticipants: leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    console.error("Error generating leaderboard in /api/v1/contests/:code/leaderboard:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
