import fs from "fs/promises";
import path from "path";

export interface SrsCardRecord {
  word: string;
  language: string;
  userId: string;
  translation: string;
  cefrLevel: string | null;
  pos: string | null;
  gender?: string | null;
  status: string; // "new" | "learning" | "review" | "learned"
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  lastRating: string | null;
  createdAt: string;
}

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? "/tmp/data" : path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "srs-cards.json");

let memoryCache: SrsCardRecord[] | null = null;

async function ensureStore(): Promise<SrsCardRecord[]> {
  if (memoryCache !== null) {
    return memoryCache;
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(STORE_FILE, "utf-8");
    memoryCache = JSON.parse(content);
    return memoryCache || [];
  } catch {
    memoryCache = [];
    try {
      await fs.writeFile(STORE_FILE, JSON.stringify([], null, 2), "utf-8");
    } catch {}
    return memoryCache;
  }
}

async function persistStore(cards: SrsCardRecord[]): Promise<void> {
  memoryCache = cards;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(cards, null, 2), "utf-8");
    await fs.rename(tempFile, STORE_FILE);
  } catch (err) {
    console.error("Failed to persist SRS cards to file:", err);
  }
}

export async function getLocalCards(
  userId?: string,
  languageAliases?: string[]
): Promise<SrsCardRecord[]> {
  const cards = await ensureStore();
  return cards.filter((c) => {
    if (languageAliases && languageAliases.length > 0) {
      const langNorm = c.language.toLowerCase().trim();
      return languageAliases.some((a) => a.toLowerCase().trim() === langNorm);
    }
    return true;
  });
}

export async function getLocalCard(
  word: string,
  languageAliases?: string[],
  _userId?: string
): Promise<SrsCardRecord | null> {
  const cards = await ensureStore();
  const normWord = word.toLowerCase().trim();
  const aliasSet = new Set((languageAliases || []).map((a) => a.toLowerCase().trim()));

  const found = cards.find(
    (c) =>
      c.word.toLowerCase().trim() === normWord &&
      (aliasSet.size === 0 || aliasSet.has(c.language.toLowerCase().trim()))
  );

  return found || null;
}

export async function upsertLocalCard(
  record: Partial<SrsCardRecord> & { word: string; language: string; userId?: string }
): Promise<SrsCardRecord> {
  const cards = await ensureStore();
  const normWord = record.word.toLowerCase().trim();
  const langKey = record.language.toLowerCase().trim();

  const index = cards.findIndex(
    (c) =>
      c.word.toLowerCase().trim() === normWord &&
      c.language.toLowerCase().trim() === langKey
  );

  const nowStr = new Date().toISOString();
  let updatedRecord: SrsCardRecord;

  if (index >= 0) {
    const existing = cards[index];
    const rawStatus = record.status || existing.status || "new";
    const mappedStatus = rawStatus === "review" ? "learned" : rawStatus;

    updatedRecord = {
      ...existing,
      ...record,
      word: normWord,
      language: langKey,
      translation: record.translation || existing.translation || normWord,
      cefrLevel: record.cefrLevel || existing.cefrLevel || null,
      pos: record.pos || existing.pos || null,
      status: mappedStatus,
      easeFactor: record.easeFactor ?? existing.easeFactor ?? 2.5,
      interval: mappedStatus === "learned" ? 36500 : (record.interval ?? existing.interval ?? 0),
      repetitions: record.repetitions ?? existing.repetitions ?? 0,
      nextReviewAt: record.nextReviewAt !== undefined ? record.nextReviewAt : existing.nextReviewAt,
      lastReviewedAt: record.lastReviewedAt !== undefined ? record.lastReviewedAt : existing.lastReviewedAt,
      lastRating: record.lastRating !== undefined ? record.lastRating : existing.lastRating,
    };
    cards[index] = updatedRecord;
  } else {
    const rawStatus = record.status || "new";
    const mappedStatus = rawStatus === "review" ? "learned" : rawStatus;

    updatedRecord = {
      word: normWord,
      language: langKey,
      userId: record.userId || "default_user",
      translation: record.translation || normWord,
      cefrLevel: record.cefrLevel || null,
      pos: record.pos || null,
      gender: record.gender || null,
      status: mappedStatus,
      easeFactor: record.easeFactor ?? 2.5,
      interval: mappedStatus === "learned" ? 36500 : (record.interval ?? 0),
      repetitions: record.repetitions ?? 0,
      nextReviewAt: record.nextReviewAt ?? null,
      lastReviewedAt: record.lastReviewedAt ?? null,
      lastRating: record.lastRating ?? null,
      createdAt: nowStr,
    };
    cards.push(updatedRecord);
  }

  await persistStore(cards);
  return updatedRecord;
}
