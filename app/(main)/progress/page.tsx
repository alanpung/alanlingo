import { getAllCards, getSrsStats, syncOwnerLibraryToSrs } from "@/lib/actions/srs";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { getEnLevelCounts } from "@/lib/words";
import { getSession } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/ai/models";
import { ProgressView } from "./progress-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProgressPage() {
  const session = await getSession();
  const isAdmin = isAdminEmail(session?.user?.email);
  const isAlanP = session?.user?.email?.toLowerCase() === "alan.pung@gmail.com";
  const language = (await getTargetLanguage()) || "en";

  if (isAlanP && session?.user?.id) {
    await syncOwnerLibraryToSrs(session.user.id).catch((err) => {
      console.warn("Owner SRS sync warning:", err);
    });
  }

  const [srsCards] = await Promise.all([
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
  ]);

  const levelCounts = getEnLevelCounts();

  return (
    <div className="w-full max-w-3xl mx-auto px-1 sm:px-4 py-4 pb-20">
      <ProgressView
        isAdmin={isAdmin}
        isAuthorAllWords={isAlanP}
        srsCards={srsCards}
        language={language}
        levelDictionaryCounts={levelCounts}
      />
    </div>
  );
}
