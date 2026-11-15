import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { contest, contestParticipation } from "@/server/db/contest-schema";
import { user } from "@/server/db/auth-schema";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { authenticateApiKey } from "@/server/api-key-auth";

/**
 * GET /api/v1/students/:email/contests
 *
 * Exposes a student's contest participation history and scorecard across contests
 * for external platforms (e.g. CareerForge).
 * Protected by X-Kernel-Api-Key.
 *
 * Security & Anti-Cheating Invariant:
 * - When a contest is still running (NOW() < endTime), the student's score and rank
 *   are strictly MASKED to prevent premature result leakage.
 * - When a contest has concluded (NOW() >= endTime), the final score, rank, and performance are revealed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const auth = authenticateApiKey(request);
  if (!auth.authenticated && auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { email: rawEmail } = await params;
    if (!rawEmail) {
      return NextResponse.json(
        { success: false, error: "Student email is required" },
        { status: 400 }
      );
    }

    const email = decodeURIComponent(rawEmail).trim().toLowerCase();

    // Look up student by email
    const [foundStudent] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user)
      .where(sql`LOWER(${user.email}) = ${email}`);

    if (!foundStudent) {
      return NextResponse.json({
        success: true,
        found: false,
        message: `Student with email '${email}' has no recorded contest history in Kernel.`,
        student: null,
        participations: [],
      });
    }

    // Query all contest participations for this student with authoritative DB clock expressions
    const participations = await db
      .select({
        participationId: contestParticipation.id,
        contestId: contestParticipation.contestId,
        joinedAt: contestParticipation.joinedAt,
        startedAt: contestParticipation.startedAt,
        finishedAt: contestParticipation.finishedAt,
        rawScore: contestParticipation.score,
        rawRank: contestParticipation.rank,
        contestCode: contest.code,
        contestTitle: contest.title,
        contestDescription: contest.description,
        coverImageUrl: contest.coverImageUrl,
        startTime: contest.startTime,
        endTime: contest.endTime,
        totalQuestions: contest.totalQuestions,
        totalScore: contest.totalScore,
        duration: contest.duration,
        isActive: contest.isActive,
        isEnded: sql<boolean>`NOW() >= ${contest.endTime}`,
        isLiveNow: sql<boolean>`NOW() >= ${contest.startTime} AND NOW() < ${contest.endTime}`,
      })
      .from(contestParticipation)
      .innerJoin(contest, eq(contestParticipation.contestId, contest.id))
      .where(eq(contestParticipation.userId, foundStudent.id))
      .orderBy(desc(contestParticipation.joinedAt));

    if (participations.length === 0) {
      return NextResponse.json({
        success: true,
        found: true,
        student: foundStudent,
        participations: [],
      });
    }

    // Fetch total participant count per contest for context (e.g. "Rank 3 of 45")
    const contestIds = Array.from(new Set(participations.map((p) => p.contestId)));
    const participantCountMap = new Map<string, number>();

    if (contestIds.length > 0) {
      const counts = await db
        .select({
          contestId: contestParticipation.contestId,
          count: sql<number>`count(*)::int`,
        })
        .from(contestParticipation)
        .where(inArray(contestParticipation.contestId, contestIds))
        .groupBy(contestParticipation.contestId);

      for (const row of counts) {
        participantCountMap.set(row.contestId, row.count);
      }
    }

    const projectedParticipations = participations.map((p) => {
      const isFinished = p.finishedAt !== null;
      const isEnded = Boolean(p.isEnded);
      const isLiveNow = Boolean(p.isLiveNow);

      let status: "CONCLUDED" | "RESULTS_PENDING" | "IN_PROGRESS" | "TIMED_OUT";

      if (isFinished) {
        if (isEnded) {
          status = "CONCLUDED";
        } else {
          status = "RESULTS_PENDING";
        }
      } else {
        if (isLiveNow) {
          status = "IN_PROGRESS";
        } else {
          status = "TIMED_OUT";
        }
      }

      // STRICT TIME-LOCK: zero score/rank leakage while contest is still running
      const score = status === "CONCLUDED" ? p.rawScore : null;
      const rank = status === "CONCLUDED" ? p.rawRank : null;
      const totalParticipants = participantCountMap.get(p.contestId) || 1;

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
        participationId: p.participationId,
        contestId: p.contestId,
        contestCode: p.contestCode,
        contestTitle: p.contestTitle,
        contestDescription: p.contestDescription,
        coverImageUrl: p.coverImageUrl,
        startTime: p.startTime,
        endTime: p.endTime,
        totalQuestions: p.totalQuestions,
        totalScore: p.totalScore,
        durationMinutes: p.duration,
        timeTakenMinutes: durationMinutes,
        status,
        isEnded,
        isLiveNow,
        score,
        maxScore: p.totalScore,
        percentage:
          score !== null && p.totalScore > 0 ? Math.round((score / p.totalScore) * 100) : null,
        rank,
        totalParticipants,
        joinedAt: p.joinedAt,
        startedAt: p.startedAt,
        finishedAt: p.finishedAt,
      };
    });

    return NextResponse.json({
      success: true,
      found: true,
      student: foundStudent,
      count: projectedParticipations.length,
      participations: projectedParticipations,
    });
  } catch (error) {
    console.error("Error fetching student contests in /api/v1/students/:email/contests:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
