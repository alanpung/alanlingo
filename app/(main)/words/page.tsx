import { getAllCards, getSrsStats, getLibraryWordSet } from "@/lib/actions/srs";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { getEnLevelCounts } from "@/lib/words";
import { getSession } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/ai/models";
import { WordExplorer } from "./word-explorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WordsPage() {
  const session = await getSession();
  const isAdmin = isAdminEmail(session?.user?.email);
  const language = (await getTargetLanguage()) || "en";
  const userId = session?.user?.id || "default_user";

  const [srsCards, stats, libraryWordSet] = await Promise.all([
    getAllCards(language).catch(() => []),
    getSrsStats(language).catch(() => ({
      total: 0,
      due: 0,
      new: 0,
      learning: 0,
      review: 0,
      learned: 0,
      hard: 0,
      ok: 0,
      easy: 0,
    })),
    getLibraryWordSet(userId, language).catch(() => new Set<string>()),
  ]);

  const levelCounts = getEnLevelCounts();

  return (
    <div className="w-full max-w-3xl mx-auto px-1 sm:px-4">
      <WordExplorer
        isAdmin={isAdmin}
        srsCards={srsCards}
        srsStats={stats}
        language={language}
        levelDictionaryCounts={levelCounts}
        libraryWords={Array.from(libraryWordSet)}
      />
    </div>
  );
}
