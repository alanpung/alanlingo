"use server";

import { db, isDbAvailable } from "@/lib/db";
import {
  userStats,
  lessonCompletion,
  exerciseAttempt,
  dailyActivity,
  unit,
  userUnitLibrary,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { computeStreak } from "@/lib/game/streaks";
import type { Exercise } from "@/lib/content/types";
import { getUnitLessons } from "@/lib/content/loader";
import { recordWordPractice } from "@/lib/actions/srs";
import { extractSrsWords } from "@/lib/srs-words";

interface CompleteLessonInput {
  unitId: string;
  lessonIndex: number;
  results: {
    exerciseIndex: number;
    exerciseType: string;
    correct: boolean;
    userAnswer: string;
  }[];
  mistakeCount: number;
}

export async function completeLesson(input: CompleteLessonInput) {
  const session = await requireSession();
  const userId = session.user.id;

  const perfectScore = input.mistakeCount === 0;
  const today = new Date().toISOString().split("T")[0];

  if (await isDbAvailable()) {
    try {
      // Create lesson completion + fetch unit row in parallel
      const [completionResult, unitResult] = await Promise.all([
        db
          .insert(lessonCompletion)
          .values({
            userId,
            unitId: input.unitId,
            lessonIndex: input.lessonIndex,
            perfectScore,
          })
          .returning(),
        db
          .select({
            id: unit.id,
            courseId: unit.courseId,
            markdown: unit.markdown,
            targetLanguage: unit.targetLanguage,
            visibility: unit.visibility,
            createdBy: unit.createdBy,
          })
          .from(unit)
          .where(eq(unit.id, input.unitId)),
      ]);

      const completion = completionResult[0];
      const unitRow = unitResult[0];

      // Save exercise attempts (depends on completion.id)
      if (completion && input.results.length > 0) {
        await db.insert(exerciseAttempt).values(
          input.results.map((r) => ({
            userId,
            lessonCompletionId: completion.id,
            exerciseIndex: r.exerciseIndex,
            exerciseType: r.exerciseType,
            correct: r.correct,
            userAnswer: r.userAnswer,
          }))
        );
      }

      // Collect all SRS word practice calls
      const srsPromises: Promise<void>[] = [];
      if (unitRow) {
        try {
          const lessons = getUnitLessons(unitRow.markdown);
          const lesson = lessons[input.lessonIndex];
          if (lesson) {
            for (const result of input.results) {
              if (result.userAnswer === "[skipped]") continue;
              const exercise = lesson.exercises[result.exerciseIndex] as Exercise | undefined;
              if (!exercise) continue;
              if (exercise.type === "flashcard-review") continue;
              const words = extractSrsWords(exercise);
              for (const w of words) {
                srsPromises.push(
                  recordWordPractice(userId, w, unitRow.targetLanguage, "", result.correct)
                );
              }
            }
          }
        } catch {
          // SRS extraction error — continue without SRS
        }
      }

      await Promise.all([
        Promise.all(srsPromises).catch(() => {}),
        upsertUserStats(userId, today),
        db
          .insert(dailyActivity)
          .values({ userId, date: today, lessonsCompleted: 1 })
          .onConflictDoUpdate({
            target: [dailyActivity.userId, dailyActivity.date],
            set: {
              lessonsCompleted: sql`${dailyActivity.lessonsCompleted} + 1`,
            },
          }),
        autoAddToLibrary(userId, unitRow),
      ]);
    } catch (e) {
      console.warn("Complete lesson DB save skipped:", e);
    }
  }

  return { perfectScore };
}

async function upsertUserStats(userId: string, today: string) {
  // Fetch current stats to compute streak
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  const { newStreak, shouldUpdate } = computeStreak(
    stats?.currentStreak ?? 0,
    stats?.lastPracticeDate ?? null
  );

  // Always increment lesson count; only update streak fields if needed
  const totalCompleted = (stats?.totalLessonsCompleted ?? 0) + 1;
  const longestStreak = Math.max(stats?.longestStreak ?? 0, newStreak);

  if (stats) {
    if (shouldUpdate) {
      await db
        .update(userStats)
        .set({
          currentStreak: newStreak,
          longestStreak,
          lastPracticeDate: today,
          totalLessonsCompleted: totalCompleted,
        })
        .where(eq(userStats.userId, userId));
    } else {
      // Already practiced today — only increment lesson count
      await db
        .update(userStats)
        .set({ totalLessonsCompleted: totalCompleted })
        .where(eq(userStats.userId, userId));
    }
  } else {
    await db.insert(userStats).values({
      userId,
      currentStreak: newStreak,
      longestStreak,
      lastPracticeDate: today,
      totalLessonsCompleted: totalCompleted,
    });
  }
}

async function autoAddToLibrary(
  userId: string,
  unitRow: { id: string; courseId: string | null; visibility: string | null; createdBy: string | null } | undefined
) {
  if (!unitRow) return;
  // Only auto-add standalone (no course), public, non-owned units
  if (unitRow.courseId) return;
  if (unitRow.visibility !== "public") return;
  if (unitRow.createdBy === userId) return;

  await db
    .insert(userUnitLibrary)
    .values({ userId, unitId: unitRow.id })
    .onConflictDoNothing();
}

