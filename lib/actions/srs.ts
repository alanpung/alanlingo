"use server";

import { db, isDbAvailable } from "@/lib/db";
import { srsCard, dictionaryWord, userCourseEnrollment, userUnitLibrary, course, unit } from "@/lib/db/schema";
import { and, eq, lte, count, sql, asc, isNotNull, inArray, or } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { calculateNextReview, type Quality, type CardStatus } from "@/lib/srs";
import type { Exercise } from "@/lib/content/types";
import { extractSrsWords } from "@/lib/srs-words";
import { getWordToLevelMap } from "@/lib/words";
import {
  getLocalCards,
  getLocalCard,
  upsertLocalCard,
} from "@/lib/srs-store";

export async function migrateDefaultUserCards(userId: string) {
  if (userId === "default_user") return;
  if (await isDbAvailable()) {
    try {
      const defaultRows = await db.execute(sql`SELECT 1 FROM srs_card WHERE user_id = 'default_user' LIMIT 1`);
      if (!defaultRows || defaultRows.length === 0) return;

      // 1. Remove duplicate 'default_user' cards where the target user already has a card for the same word and language
      await db.execute(sql`
        DELETE FROM srs_card 
        WHERE user_id = 'default_user' 
          AND EXISTS (
            SELECT 1 FROM srs_card target 
            WHERE target.user_id = ${userId} 
              AND target.word = srs_card.word 
              AND target.language = srs_card.language
          )
      `);

      // 2. Safely batch-update all remaining unique 'default_user' cards to the new user ID in a single query
      await db.execute(sql`
        UPDATE srs_card 
        SET user_id = ${userId} 
        WHERE user_id = 'default_user'
      `);
    } catch (err) {
      console.error("Migration error:", err);
    }
  }
}

async function getSafeUserId(): Promise<string> {
  try {
    const session = await getSession();
    if (session?.user?.id) return session.user.id;
  } catch {}
  return "default_user";
}

function getLanguageAliases(lang?: string): string[] {
  if (!lang) return [];
  const normalized = lang.toLowerCase().trim();
  const set = new Set<string>([lang, normalized]);

  if (normalized === "de" || normalized === "german") {
    set.add("de");
    set.add("german");
    set.add("German");
  } else if (normalized === "zh" || normalized === "mandarin" || normalized === "chinese") {
    set.add("zh");
    set.add("mandarin");
    set.add("chinese");
    set.add("Chinese");
    set.add("Mandarin");
  } else if (normalized === "es" || normalized === "spanish") {
    set.add("es");
    set.add("spanish");
    set.add("Spanish");
  } else if (normalized === "fr" || normalized === "french") {
    set.add("fr");
    set.add("french");
    set.add("French");
  } else if (normalized === "en" || normalized === "english") {
    set.add("en");
    set.add("english");
    set.add("English");
  } else if (normalized === "ja" || normalized === "japanese") {
    set.add("ja");
    set.add("japanese");
    set.add("Japanese");
  } else if (normalized === "ko" || normalized === "korean") {
    set.add("ko");
    set.add("korean");
    set.add("Korean");
  } else if (normalized === "it" || normalized === "italian") {
    set.add("it");
    set.add("italian");
    set.add("Italian");
  } else if (normalized === "pt" || normalized === "portuguese") {
    set.add("pt");
    set.add("portuguese");
    set.add("Portuguese");
  } else if (normalized === "ru" || normalized === "russian") {
    set.add("ru");
    set.add("russian");
    set.add("Russian");
  }

  return Array.from(set);
}

export async function addWordToSrs(
  word: string,
  language: string,
  translation: string
) {
  const userId = await getSafeUserId();
  const normalized = word.toLowerCase().trim();

  await upsertLocalCard({
    word: normalized,
    language,
    userId,
    translation,
    status: "new",
    nextReviewAt: null,
  });

  if (await isDbAvailable()) {
    try {
      await db
        .insert(srsCard)
        .values({
          word: normalized,
          language,
          userId,
          translation,
          status: "new",
          nextReviewAt: null,
        })
        .onConflictDoNothing();
    } catch {}
  }
}

export async function addOrFailWord(
  word: string,
  language: string,
  translation: string
): Promise<"added" | "failed"> {
  const userId = await getSafeUserId();
  const normalizedWord = word.toLowerCase().trim();
  const aliases = getLanguageAliases(language);

  const localExisting = await getLocalCard(normalizedWord, aliases, userId);

  if (!localExisting) {
    await upsertLocalCard({
      word: normalizedWord,
      language,
      userId,
      translation,
      status: "learning",
      nextReviewAt: new Date().toISOString(),
    });

    if (await isDbAvailable()) {
      try {
        await db.insert(srsCard).values({
          word: normalizedWord,
          language,
          userId,
          translation,
          status: "learning",
          nextReviewAt: new Date(),
        }).onConflictDoNothing();
      } catch {}
    }

    return "added";
  }

  // Already exists — reset
  const result = calculateNextReview(
    {
      easeFactor: localExisting.easeFactor,
      interval: localExisting.interval,
      repetitions: localExisting.repetitions,
      status: (localExisting.status as CardStatus) ?? "learning",
    },
    0
  );

  await upsertLocalCard({
    word: normalizedWord,
    language: localExisting.language,
    userId,
    easeFactor: result.easeFactor,
    interval: result.interval,
    repetitions: result.repetitions,
    status: result.status,
    nextReviewAt: result.nextReviewAt.toISOString(),
    lastReviewedAt: new Date().toISOString(),
  });

  if (await isDbAvailable()) {
    try {
      await db
        .update(srsCard)
        .set({
          easeFactor: result.easeFactor,
          interval: result.interval,
          repetitions: result.repetitions,
          status: result.status,
          nextReviewAt: result.nextReviewAt,
          lastReviewedAt: new Date(),
        })
        .where(
          and(
            eq(srsCard.word, normalizedWord),
            inArray(srsCard.language, aliases),
            eq(srsCard.userId, userId)
          )
        );
    } catch {}
  }

  return "failed";
}

export async function getDueCards(language: string, limit = 20) {
  const userId = await getSafeUserId();
  const now = new Date();
  const aliases = getLanguageAliases(language);

  if (await isDbAvailable()) {
    try {
      const conditions = [
        eq(srsCard.userId, userId),
        inArray(srsCard.status, ["learning", "review"]),
        isNotNull(srsCard.nextReviewAt),
        lte(srsCard.nextReviewAt, now),
      ];

      if (aliases.length > 0) {
        conditions.push(inArray(srsCard.language, aliases));
      }

      return await db
        .select()
        .from(srsCard)
        .where(and(...conditions))
        .orderBy(srsCard.nextReviewAt)
        .limit(limit);
    } catch {}
  }

  const local = await getLocalCards(userId, aliases);
  return local
    .filter(
      (c) =>
        (c.status === "learning" || c.status === "review") &&
        c.nextReviewAt &&
        new Date(c.nextReviewAt) <= now
    )
    .sort((a, b) => (a.nextReviewAt! > b.nextReviewAt! ? 1 : -1))
    .slice(0, limit)
    .map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      nextReviewAt: c.nextReviewAt ? new Date(c.nextReviewAt) : null,
      lastReviewedAt: c.lastReviewedAt ? new Date(c.lastReviewedAt) : null,
    }));
}

export interface SrsCardItem {
  word: string;
  language: string;
  userId: string;
  translation: string;
  cefrLevel: string | null;
  pos: string | null;
  gender?: string | null;
  status: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date | null;
  lastReviewedAt: Date | null;
  lastRating: string | null;
  createdAt: Date;
}

export async function getAllCards(language?: string): Promise<SrsCardItem[]> {
  const userId = await getSafeUserId();
  await syncUserCourseWordsToSrs(userId);
  const aliases = language ? getLanguageAliases(language) : [];
  const dbUp = await isDbAvailable();

  let cards: SrsCardItem[] = [];
  if (dbUp) {
    try {
      const conditions = [eq(srsCard.userId, userId)];
      if (aliases.length > 0) {
        conditions.push(inArray(srsCard.language, aliases));
      }

      cards = await db
        .select()
        .from(srsCard)
        .where(and(...conditions))
        .orderBy(srsCard.createdAt);
    } catch (err) {
      console.warn("Postgres error, falling back to local store:", err);
      cards = [];
    }
  }

  if (!dbUp || cards.length === 0) {
    const local = await getLocalCards(userId, aliases);
    cards = local.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      nextReviewAt: c.nextReviewAt ? new Date(c.nextReviewAt) : null,
      lastReviewedAt: c.lastReviewedAt ? new Date(c.lastReviewedAt) : null,
    }));
  }

  const wordsMissingLevel = cards
    .filter((c) => !c.cefrLevel)
    .map((c) => c.word.toLowerCase().trim());

  if (wordsMissingLevel.length > 0) {
    try {
      const levelMap = await getWordToLevelMap();
      for (const card of cards) {
        if (!card.cefrLevel) {
          card.cefrLevel = levelMap[card.word.toLowerCase().trim()] || "A1";
        }
      }
    } catch (err) {
      console.error("Failed to map CEFR levels:", err);
    }
  }

  return cards;
}

export async function reviewCard(
  word: string,
  language: string,
  quality: Quality
) {
  const userId = await getSafeUserId();
  const normalizedWord = word.toLowerCase().trim();
  const aliases = getLanguageAliases(language);
  const dbUp = await isDbAvailable();

  let card: SrsCardItem | null = null;
  if (dbUp) {
    try {
      const [dbCard] = await db
        .select()
        .from(srsCard)
        .where(
          and(
            eq(srsCard.word, normalizedWord),
            inArray(srsCard.language, aliases),
            eq(srsCard.userId, userId)
          )
        );
      card = dbCard || null;
    } catch {}
  }

  if (!card) {
    const local = await getLocalCard(normalizedWord, aliases, userId);
    if (local) {
      card = {
        ...local,
        createdAt: new Date(local.createdAt),
        nextReviewAt: local.nextReviewAt ? new Date(local.nextReviewAt) : null,
        lastReviewedAt: local.lastReviewedAt ? new Date(local.lastReviewedAt) : null,
      };
    }
  }

  const initialStatus: CardStatus = card ? (card.status as CardStatus) : "new";

  const result = calculateNextReview(
    {
      easeFactor: card?.easeFactor ?? 2.5,
      interval: card?.interval ?? 0,
      repetitions: card?.repetitions ?? 0,
      status: initialStatus,
    },
    quality
  );

  const rawStatus = result.status;
  const cardStatus = rawStatus === "review" ? "learned" : rawStatus;

  const ratingStr: "hard" | "ok" | "easy" =
    quality === 5 ? "easy" : quality === 4 ? "ok" : "hard";

  const targetLang = card?.language || aliases[0] || language;

  // 1. Always save to local store
  await upsertLocalCard({
    word: normalizedWord,
    language: targetLang,
    userId,
    status: cardStatus,
    translation: card?.translation || word,
    easeFactor: result.easeFactor,
    interval: cardStatus === "learned" ? 36500 : result.interval,
    repetitions: result.repetitions,
    nextReviewAt: result.nextReviewAt ? result.nextReviewAt.toISOString() : null,
    lastReviewedAt: new Date().toISOString(),
    lastRating: ratingStr,
  });

  // 2. Also save to DB if available
  if (dbUp) {
    try {
      if (card && card.createdAt) {
        await db
          .update(srsCard)
          .set({
            easeFactor: result.easeFactor,
            interval: cardStatus === "learned" ? 36500 : result.interval,
            repetitions: result.repetitions,
            status: cardStatus,
            nextReviewAt: result.nextReviewAt,
            lastReviewedAt: new Date(),
            lastRating: ratingStr,
          })
          .where(
            and(
              eq(srsCard.word, card.word),
              eq(srsCard.language, card.language),
              eq(srsCard.userId, userId)
            )
          );
      } else {
        await db
          .insert(srsCard)
          .values({
            word: normalizedWord,
            language: targetLang,
            userId,
            translation: word,
            easeFactor: result.easeFactor,
            interval: cardStatus === "learned" ? 36500 : result.interval,
            repetitions: result.repetitions,
            status: cardStatus,
            nextReviewAt: result.nextReviewAt,
            lastReviewedAt: new Date(),
            lastRating: ratingStr,
          })
          .onConflictDoUpdate({
            target: [srsCard.word, srsCard.language, srsCard.userId],
            set: {
              easeFactor: result.easeFactor,
              interval: cardStatus === "learned" ? 36500 : result.interval,
              repetitions: result.repetitions,
              status: cardStatus,
              nextReviewAt: result.nextReviewAt,
              lastReviewedAt: new Date(),
              lastRating: ratingStr,
            },
          });
      }
    } catch {}
  }

  try {
    revalidatePath("/words");
  } catch {}
  return result;
}

export async function getSrsStats(language?: string) {
  const userId = await getSafeUserId();
  await syncUserCourseWordsToSrs(userId);
  const dbUp = await isDbAvailable();
  const aliases = language ? getLanguageAliases(language) : [];

  console.log("DEBUG: getSrsStats called. userId =", userId, "dbUp =", dbUp);

  if (dbUp) {
    try {
      type StatRow = {
        total: number;
        due: number;
        new_count: number;
        learning_count: number;
        learned_count: number;
        hard_count: number;
        ok_count: number;
        easy_count: number;
      };

      const rows = await db.execute<StatRow>(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN status IN ('learning', 'review') AND next_review_at IS NOT NULL AND next_review_at <= NOW() THEN 1 END)::int AS due,
          COUNT(CASE WHEN status = 'new' THEN 1 END)::int AS new_count,
          COUNT(CASE WHEN status = 'learning' THEN 1 END)::int AS learning_count,
          COUNT(CASE WHEN status IN ('learned', 'review') THEN 1 END)::int AS learned_count,
          COUNT(CASE WHEN last_rating = 'hard' THEN 1 END)::int AS hard_count,
          COUNT(CASE WHEN last_rating = 'ok' THEN 1 END)::int AS ok_count,
          COUNT(CASE WHEN last_rating = 'easy' THEN 1 END)::int AS easy_count
        FROM srs_card
        WHERE user_id = ${userId}
          ${aliases.length > 0 ? sql`AND language = ANY(${aliases})` : sql``}
      `);

      const stat = rows[0];
      if (stat) {
        return {
          total: Number(stat.total) || 0,
          due: Number(stat.due) || 0,
          new: Number(stat.new_count) || 0,
          learning: Number(stat.learning_count) || 0,
          review: Number(stat.learned_count) || 0,
          learned: Number(stat.learned_count) || 0,
          hard: Number(stat.hard_count) || 0,
          ok: Number(stat.ok_count) || 0,
          easy: Number(stat.easy_count) || 0,
        };
      }
    } catch (err) {
      console.error("DEBUG: getSrsStats DB query failed:", err);
    }
  }

  const local = await getLocalCards(userId, aliases);
  const now = new Date();
  let dueCount = 0;
  let newCount = 0;
  let learningCount = 0;
  let learnedCount = 0;
  let hardCount = 0;
  let okCount = 0;
  let easyCount = 0;

  for (const c of local) {
    if (c.status === "learned" || c.status === "review") {
      learnedCount++;
    } else if (c.status === "learning") {
      learningCount++;
      if (c.nextReviewAt && new Date(c.nextReviewAt) <= now) {
        dueCount++;
      }
    } else if (c.status === "new") {
      newCount++;
    }

    if (c.lastRating === "hard") hardCount++;
    else if (c.lastRating === "ok") okCount++;
    else if (c.lastRating === "easy") easyCount++;
  }

  return {
    total: local.length,
    due: dueCount,
    new: newCount,
    learning: learningCount,
    review: learnedCount,
    learned: learnedCount,
    hard: hardCount,
    ok: okCount,
    easy: easyCount,
  };
}

export async function setWordStatus(
  word: string,
  language: string,
  status: "new" | "learning" | "learned",
  metadata?: { translation?: string; cefrLevel?: string; pos?: string }
) {
  const userId = await getSafeUserId();
  const normalizedWord = word.toLowerCase().trim();
  const langKey = (language || "en").toLowerCase().trim();
  const aliases = getLanguageAliases(langKey);
  const dbUp = await isDbAvailable();

  const translation = metadata?.translation || word;
  let cefrLevel = metadata?.cefrLevel || null;
  const pos = metadata?.pos || null;

  if (!cefrLevel) {
    try {
      const levelMap = await getWordToLevelMap();
      cefrLevel = levelMap[normalizedWord] || "A1";
    } catch {
      cefrLevel = "A1";
    }
  }

  const reps = status === "learned" ? 10 : status === "learning" ? 1 : 0;
  const interval = status === "learned" ? 36500 : status === "learning" ? 1 : 0;
  const now = new Date();

  // 1. Always save locally first for instant file persistence
  await upsertLocalCard({
    word: normalizedWord,
    language: aliases[0] || langKey,
    userId,
    status,
    translation,
    cefrLevel,
    pos,
    nextReviewAt: status === "learning" ? now.toISOString() : null,
    lastReviewedAt: status === "learned" ? now.toISOString() : null,
    interval,
    repetitions: reps,
  });

  // 2. Also save to DB if available
  if (dbUp) {
    try {
      const [existing] = await db
        .select()
        .from(srsCard)
        .where(
          and(
            eq(srsCard.word, normalizedWord),
            inArray(srsCard.language, aliases),
            eq(srsCard.userId, userId)
          )
        );

      if (existing) {
        await db
          .update(srsCard)
          .set({
            status,
            translation: metadata?.translation || existing.translation,
            cefrLevel: cefrLevel || existing.cefrLevel,
            pos: pos || existing.pos,
            nextReviewAt: status === "learning" ? now : null,
            lastReviewedAt: status === "learned" ? now : existing.lastReviewedAt,
            interval,
            repetitions: reps,
          })
          .where(
            and(
              eq(srsCard.word, existing.word),
              eq(srsCard.language, existing.language),
              eq(srsCard.userId, userId)
            )
          );
      } else {
        await db
          .insert(srsCard)
          .values({
            word: normalizedWord,
            language: aliases[0] || langKey,
            userId,
            translation,
            cefrLevel,
            pos,
            status,
            nextReviewAt: status === "learning" ? now : null,
            lastReviewedAt: status === "learned" ? now : null,
            interval,
            repetitions: reps,
          })
          .onConflictDoUpdate({
            target: [srsCard.word, srsCard.language, srsCard.userId],
            set: {
              status,
              translation,
              cefrLevel: cefrLevel || sql`COALESCE(${srsCard.cefrLevel}, ${cefrLevel})`,
              pos: pos || sql`COALESCE(${srsCard.pos}, ${pos})`,
              nextReviewAt: status === "learning" ? now : null,
              lastReviewedAt: status === "learned" ? now : sql`${srsCard.lastReviewedAt}`,
              interval,
              repetitions: reps,
            },
          });
      }
    } catch (err) {
      console.error("setWordStatus DB error:", err);
    }
  }

  try {
    revalidatePath("/progress");
    revalidatePath("/words");
  } catch {}

  return { success: true, word: normalizedWord, status };
}

export async function getNewCards(language: string, limit = 20) {
  const userId = await getSafeUserId();
  const aliases = getLanguageAliases(language);

  if (await isDbAvailable()) {
    try {
      return await db
        .select()
        .from(srsCard)
        .where(
          and(
            eq(srsCard.userId, userId),
            inArray(srsCard.language, aliases),
            eq(srsCard.status, "new")
          )
        )
        .orderBy(asc(srsCard.createdAt))
        .limit(limit);
    } catch {}
  }

  const local = await getLocalCards(userId, aliases);
  return local
    .filter((c) => c.status === "new")
    .slice(0, limit)
    .map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      nextReviewAt: null,
      lastReviewedAt: null,
    }));
}

export async function introduceNewCards(language: string, count_: number) {
  const userId = await getSafeUserId();
  const aliases = getLanguageAliases(language);
  const now = new Date();

  const cards = await getNewCards(language, count_);
  if (cards.length === 0) return [];

  for (const card of cards) {
    await upsertLocalCard({
      word: card.word,
      language: card.language,
      userId,
      status: "learning",
      nextReviewAt: now.toISOString(),
    });
  }

  if (await isDbAvailable()) {
    try {
      await db
        .update(srsCard)
        .set({
          status: "learning",
          nextReviewAt: now,
        })
        .where(
          and(
            eq(srsCard.userId, userId),
            inArray(srsCard.language, aliases),
            eq(srsCard.status, "new"),
            inArray(
              srsCard.word,
              cards.map((c) => c.word)
            )
          )
        );
    } catch {}
  }

  return cards.map((c) => ({ ...c, status: "learning" as const, nextReviewAt: now }));
}

export async function recordWordPractice(
  userId: string,
  word: string,
  language: string,
  translation: string,
  correct: boolean
) {
  const normalizedWord = word.toLowerCase().trim();
  const aliases = getLanguageAliases(language);
  const local = await getLocalCard(normalizedWord, aliases, userId);

  // Look up CEFR level if missing
  let cefrLevel = local?.cefrLevel || null;
  const pos = local?.pos || null;
  if (!cefrLevel) {
    try {
      const levelMap = await getWordToLevelMap();
      cefrLevel = levelMap[normalizedWord] || null;
    } catch {}
  }

  const previousReps = local?.repetitions ?? 0;
  const previousStatus = local?.status ?? "new";

  // Rule:
  // "learning" = once student encounter the word in any exercise
  // word status = "learned" if correct more or equal 3 times and also when student selected "learned" in flashcard review
  let repetitions = correct ? previousReps + 1 : previousReps;
  let finalStatus: CardStatus = "learning";

  if (previousStatus === "learned" || repetitions >= 3) {
    finalStatus = "learned";
    repetitions = Math.max(repetitions, 3);
  } else {
    finalStatus = "learning";
  }

  const nextReviewAt = new Date();
  if (finalStatus === "learned") {
    nextReviewAt.setDate(nextReviewAt.getDate() + 30);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);
  }

  await upsertLocalCard({
    word: normalizedWord,
    language: aliases[0] || language,
    userId,
    translation: translation || local?.translation || word,
    cefrLevel,
    pos,
    status: finalStatus,
    easeFactor: local?.easeFactor ?? 2.5,
    interval: finalStatus === "learned" ? 36500 : 1,
    repetitions,
    nextReviewAt: nextReviewAt.toISOString(),
    lastReviewedAt: new Date().toISOString(),
  });

  if (await isDbAvailable()) {
    try {
      const [existing] = await db
        .select()
        .from(srsCard)
        .where(
          and(
            eq(srsCard.word, normalizedWord),
            eq(srsCard.language, language),
            eq(srsCard.userId, userId)
          )
        );

      if (!existing) {
        await db.insert(srsCard).values({
          word: normalizedWord,
          language: aliases[0] || language,
          userId,
          translation: translation || word,
          cefrLevel,
          pos,
          status: finalStatus,
          easeFactor: 2.5,
          interval: finalStatus === "learned" ? 36500 : 1,
          repetitions,
          nextReviewAt,
          lastReviewedAt: new Date(),
        }).onConflictDoNothing();
      } else {
        await db
          .update(srsCard)
          .set({
            status: finalStatus,
            cefrLevel: cefrLevel || existing.cefrLevel,
            repetitions,
            interval: finalStatus === "learned" ? 36500 : 1,
            nextReviewAt,
            lastReviewedAt: new Date(),
          })
          .where(
            and(
              eq(srsCard.word, normalizedWord),
              eq(srsCard.language, language),
              eq(srsCard.userId, userId)
            )
          );
      }
    } catch {}
  }
}

export async function addAllLevelWordsToMyWords(
  level: string,
  language: string = "en"
): Promise<{
  success: boolean;
  message: string;
  addedCount: number;
  totalInLevel: number;
}> {
  const session = await getSession();
  if (!session?.user?.email) {
    return { success: false, message: "Authentication required", addedCount: 0, totalInLevel: 0 };
  }
  const { isAdminEmail } = await import("@/lib/ai/models");
  if (!isAdminEmail(session.user.email)) {
    return {
      success: false,
      message: "Only Alan P can bulk add level words directly to My Words.",
      addedCount: 0,
      totalInLevel: 0,
    };
  }

  const userId = session.user.id;
  const normLevel = level.toUpperCase().trim();
  const { loadEnLevelWords } = await import("@/lib/words");
  const words = await loadEnLevelWords(normLevel);

  if (!words || words.length === 0) {
    return {
      success: false,
      message: `No words found for level ${normLevel}`,
      addedCount: 0,
      totalInLevel: 0,
    };
  }

  const aliases = getLanguageAliases(language);
  const existingCards = await getLocalCards(userId, aliases);
  const existingMap = new Map<string, (typeof existingCards)[0]>();
  for (const c of existingCards) {
    existingMap.set(c.word.toLowerCase().trim(), c);
  }

  let addedCount = 0;
  const now = new Date();
  const nextReview = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Batch add to local store
  for (const w of words) {
    const wordLower = w.word.toLowerCase().trim();
    const existing = existingMap.get(wordLower);

    if (!existing) {
      await upsertLocalCard({
        word: wordLower,
        language: aliases[0] || "en",
        userId,
        translation: w.english_translation || w.definition_zh || w.word,
        cefrLevel: normLevel,
        pos: w.pos || "noun",
        status: "learning",
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewAt: nextReview,
        createdAt: now.toISOString(),
      });
      addedCount++;
    }
  }

  // Also bulk insert to DB if available
  if (await isDbAvailable()) {
    try {
      const recordsToInsert = words
        .filter((w) => !existingMap.has(w.word.toLowerCase().trim()))
        .map((w) => ({
          word: w.word.toLowerCase().trim(),
          language: aliases[0] || "en",
          userId,
          translation: w.english_translation || w.definition_zh || w.word,
          cefrLevel: normLevel,
          pos: w.pos || "noun",
          status: "learning",
          easeFactor: 2.5,
          interval: 1,
          repetitions: 0,
          nextReviewAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          createdAt: now,
        }));

      const chunkSize = 200;
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        const chunk = recordsToInsert.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          await db.insert(srsCard).values(chunk).onConflictDoNothing();
        }
      }
    } catch (err) {
      console.error("DB batch insert error:", err);
    }
  }

  try {
    revalidatePath("/progress");
    revalidatePath("/words");
  } catch {}

  return {
    success: true,
    message: `Added ${addedCount} words from ${normLevel} to My Words (${words.length - addedCount} were already in My Words)!`,
    addedCount,
    totalInLevel: words.length,
  };
}

export async function recordChatExerciseResult(
  exercise: Exercise,
  correct: boolean,
  language: string
) {
  const userId = await getSafeUserId();
  const words = extractSrsWords(exercise);

  for (const w of words) {
    await recordWordPractice(userId, w, language, "", correct);
  }
}

export async function syncOwnerLibraryToSrs(userId: string) {
  const { loadLanguageRaw } = await import("@/lib/words");
  const allDictWords = await loadLanguageRaw("en");
  if (!allDictWords || allDictWords.length === 0) return;

  const aliases = getLanguageAliases("en");
  const dbUp = await isDbAvailable();
  if (!dbUp) return;

  try {
    // 1. Fetch all words already in Alan's SRS deck
    const existingRows = await db
      .select({ word: srsCard.word })
      .from(srsCard)
      .where(and(eq(srsCard.userId, userId), inArray(srsCard.language, aliases)));

    const existingSet = new Set(existingRows.map((r) => r.word.toLowerCase().trim()));

    // 2. Identify newly added words from english_merged.json
    const missingWords = allDictWords.filter(
      (w) => !existingSet.has(w.word.toLowerCase().trim())
    );

    if (missingWords.length === 0) return;

    // 3. Batch insert missing words with status: "new"
    const now = new Date();
    const recordsToInsert = missingWords.map((w) => ({
      word: w.word.toLowerCase().trim(),
      language: "en",
      userId,
      translation: w.english_translation || w.definition_zh || w.word,
      cefrLevel: (w.cefr_level || "A1").toUpperCase().trim(),
      pos: w.pos || "noun",
      status: "new",
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewAt: null,
      createdAt: now,
    }));

    const CHUNK_SIZE = 500;
    for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
      const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
      await db.insert(srsCard).values(chunk).onConflictDoNothing();
    }
  } catch (err) {
    console.error("syncOwnerLibraryToSrs error:", err);
  }
}


const userSyncMap = new Map<string, number>();
const inFlightSync = new Map<string, Promise<void>>();

export async function syncUserCourseWordsToSrs(userId: string): Promise<void> {
  if (!userId || userId === "default_user") return;

  // Deduplicate concurrent calls (e.g. from Promise.all([getAllCards, getSrsStats]))
  if (inFlightSync.has(userId)) {
    return inFlightSync.get(userId);
  }

  // Throttle repeated calls for the same user within 60 seconds
  const lastSync = userSyncMap.get(userId) || 0;
  if (Date.now() - lastSync < 60000) return;

  const promise = (async () => {
    try {
      if (!(await isDbAvailable())) return;

      // Automatically purge junk / non-word scraped entries from database
      const JUNK_WORDS = [
        "est", "dev", "md", "vol", "src", "dsl", "pda", "faqs", 
        "zum", "diff", "trackback", "kentucky", "eric", "taylor", "webmaster"
      ];
      try {
        await db.delete(srsCard).where(inArray(srsCard.word, JUNK_WORDS));
      } catch (err) {
        console.warn("Junk words purge warning:", err);
      }

      // 1. Get enrolled course IDs for this user
      const enrollments = await db
        .select({ courseId: userCourseEnrollment.courseId })
        .from(userCourseEnrollment)
        .where(eq(userCourseEnrollment.userId, userId));
      const enrolledIds = new Set(enrollments.map((e) => e.courseId));

      // 2. Also get course IDs from units in userUnitLibrary
      const libraryUnits = await db
        .select({ courseId: unit.courseId })
        .from(userUnitLibrary)
        .innerJoin(unit, eq(unit.id, userUnitLibrary.unitId))
        .where(eq(userUnitLibrary.userId, userId));
      for (const u of libraryUnits) {
        if (u.courseId) enrolledIds.add(u.courseId);
      }

      if (enrolledIds.size === 0) return;

      // Get all courses to sync
      const coursesToSync = await db
        .select({ id: course.id, level: course.level, title: course.title })
        .from(course)
        .where(
          or(
            inArray(course.id, Array.from(enrolledIds)),
            eq(course.createdBy, userId)
          )
        );

      const levelsToSync = new Set<string>();
      for (const c of coursesToSync) {
        if (c.level) {
          levelsToSync.add(c.level.toUpperCase().trim());
        }
        const t = (c.title || "").toLowerCase();
        if (t.includes("a1")) levelsToSync.add("A1");
        if (t.includes("a2")) levelsToSync.add("A2");
        if (t.includes("b1")) levelsToSync.add("B1");
        if (t.includes("b2")) levelsToSync.add("B2");
        if (t.includes("c1")) levelsToSync.add("C1");
        if (t.includes("c2")) levelsToSync.add("C2");
      }

      if (levelsToSync.size === 0) return;

      // Load level dictionary words
      const { loadEnLevelWords } = await import("@/lib/words");

      // Fetch existing cards in srs_card for this user
      const existingRows = await db
        .select({ word: srsCard.word })
        .from(srsCard)
        .where(and(eq(srsCard.userId, userId), eq(srsCard.language, "en")));
      const existingSet = new Set(existingRows.map((r) => r.word.toLowerCase().trim()));

      const now = new Date();
      const recordsToInsert: {
        word: string;
        language: string;
        userId: string;
        translation: string;
        cefrLevel: string;
        pos: string;
        status: "new";
        easeFactor: number;
        interval: number;
        repetitions: number;
        nextReviewAt: null;
        createdAt: Date;
      }[] = [];

      for (const lvl of Array.from(levelsToSync)) {
        const levelWords = await loadEnLevelWords(lvl);
        for (const w of levelWords) {
          const normWord = w.word.toLowerCase().trim();
          if (!existingSet.has(normWord)) {
            existingSet.add(normWord);
            recordsToInsert.push({
              word: normWord,
              language: "en",
              userId,
              translation: w.english_translation || w.definition_zh || w.word,
              cefrLevel: lvl,
              pos: w.pos || "noun",
              status: "new",
              easeFactor: 2.5,
              interval: 0,
              repetitions: 0,
              nextReviewAt: null,
              createdAt: now,
            });
          }
        }
      }

      if (recordsToInsert.length === 0) return;

      // Batch insert in chunks of 200
      const CHUNK_SIZE = 200;
      for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
        const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
        await db.insert(srsCard).values(chunk).onConflictDoNothing();
      }

      userSyncMap.set(userId, Date.now());
    } catch (err) {
      console.error("syncUserCourseWordsToSrs error:", err);
    } finally {
      inFlightSync.delete(userId);
    }
  })();

  inFlightSync.set(userId, promise);
  return promise;
}
