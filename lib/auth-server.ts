import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export const getSession = async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (session) return session;
  } catch (err: unknown) {
    const errorObj = err as { digest?: string; message?: string };
    if (
      errorObj?.digest === "DYNAMIC_SERVER_USAGE" ||
      errorObj?.digest === "NEXT_REDIRECT" ||
      errorObj?.message?.includes("Dynamic server usage")
    ) {
      // Re-throw so Next.js App Router properly flags the route as dynamic without warning logs
      throw err;
    }
    console.warn("Session retrieval error:", err);
  }

  return null;
};

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}
