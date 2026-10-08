import { db, isDbAvailable } from "./index";
import { course, unit, user } from "./schema";
import { getAllCourses, getAllUnits } from "../content/registry";
import { eq, or, ilike, and, notInArray, inArray } from "drizzle-orm";

let lastSyncedAt = 0;

export async function seedContentFromFilesystem() {
  if (!(await isDbAvailable())) return;

  // Throttle syncs to once every 10 seconds max per server instance
  const now = Date.now();
  if (now - lastSyncedAt < 10000) return;
  lastSyncedAt = now;

  try {
    // 1. Ensure Alan's user name is "Alan P"
    let alanUser = await db.query.user.findFirst({
      where: ilike(user.email, "alan.pung@gmail.com"),
    });

    if (!alanUser) {
      alanUser = await db.query.user.findFirst({
        where: ilike(user.name, "%alan%"),
      });
    }

    if (alanUser && alanUser.name !== "Alan P") {
      await db.update(user).set({ name: "Alan P" }).where(eq(user.id, alanUser.id));
    }

    const creatorId = alanUser ? alanUser.id : null;

    // 2. Load filesystem content
    const courses = getAllCourses();
    const units = getAllUnits();
    const courseIds = courses.map((c) => c.id);

    // 3. Upsert all filesystem courses with Alan P (creatorId) as author
    for (const c of courses) {
      await db
        .insert(course)
        .values({
          id: c.id,
          title: c.title,
          sourceLanguage: c.sourceLanguage,
          targetLanguage: c.targetLanguage,
          level: c.level,
          visibility: "public",
          published: true,
          createdBy: creatorId,
        })
        .onConflictDoUpdate({
          target: course.id,
          set: {
            title: c.title,
            sourceLanguage: c.sourceLanguage,
            targetLanguage: c.targetLanguage,
            level: c.level,
            visibility: "public",
            published: true,
            createdBy: creatorId,
            updatedAt: new Date(),
          },
        });
    }

    if (courseIds.length > 0 && creatorId) {
      await db.update(course).set({ createdBy: creatorId }).where(inArray(course.id, courseIds));
    }

    // 4. Delete unwanted German / test courses and units
    await db
      .delete(unit)
      .where(
        or(
          ilike(unit.targetLanguage, "de"),
          ilike(unit.title, "%German%"),
          ilike(unit.title, "%Steve Jobs%"),
          ilike(unit.title, "%Testing Unit%"),
          ilike(unit.id, "%testing-%"),
          ilike(unit.id, "%steve-jobs-%")
        )
      );

    await db
      .delete(course)
      .where(
        or(
          ilike(course.targetLanguage, "de"),
          ilike(course.title, "%German%"),
          ilike(course.title, "%Steve Jobs%"),
          ilike(course.title, "%Testing%"),
          ilike(course.id, "%testing-%"),
          ilike(course.id, "%steve-jobs-%")
        )
      );

    // 5. Track valid unit IDs for each course and upsert filesystem units
    const validUnitIdsByCourse = new Map<string, string[]>();

    for (const u of units) {
      const p = u.parsed;
      if (!p.targetLanguage || !p.courseId) continue;

      const match = p.title.match(/Unit\s+(\d+)/i);
      const unitNum = match ? parseInt(match[1], 10) : null;
      
      // Use clean deterministic unit ID: e.g. "a1-flashcard-course-unit-1"
      const unitId = unitNum ? `${p.courseId}-unit-${unitNum}` : `${p.courseId}-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

      if (!validUnitIdsByCourse.has(p.courseId)) {
        validUnitIdsByCourse.set(p.courseId, []);
      }
      validUnitIdsByCourse.get(p.courseId)!.push(unitId);

      await db
        .insert(unit)
        .values({
          id: unitId,
          courseId: p.courseId,
          title: p.title,
          description: p.description,
          icon: p.icon,
          color: p.color,
          markdown: u.markdown,
          targetLanguage: p.targetLanguage,
          sourceLanguage: p.sourceLanguage,
          level: p.level,
          visibility: "public",
          createdBy: creatorId,
        })
        .onConflictDoUpdate({
          target: unit.id,
          set: {
            courseId: p.courseId,
            title: p.title,
            description: p.description,
            icon: p.icon,
            color: p.color,
            markdown: u.markdown,
            targetLanguage: p.targetLanguage,
            sourceLanguage: p.sourceLanguage,
            level: p.level,
            visibility: "public",
            createdBy: creatorId,
            updatedAt: new Date(),
          },
        });
    }

    if (courseIds.length > 0 && creatorId) {
      await db.update(unit).set({ createdBy: creatorId }).where(inArray(unit.courseId, courseIds));
    }

    // 6. Strict cleanup of old/ghost units in DB for known courses
    for (const [courseId, validIds] of validUnitIdsByCourse.entries()) {
      if (validIds.length > 0) {
        await db
          .delete(unit)
          .where(
            and(
              eq(unit.courseId, courseId),
              notInArray(unit.id, validIds)
            )
          );
      }
    }

    // 7. General deduplication by course and Unit number
    const allDbUnits = await db.select().from(unit);
    const seenByCourseAndNum = new Map<string, string>();
    const dupesToDelete: string[] = [];

    for (const u of allDbUnits) {
      if (!u.courseId || !u.title) continue;
      const match = u.title.match(/Unit\s+(\d+)/i);
      if (match) {
        const key = `${u.courseId}-unit-${match[1]}`;
        if (seenByCourseAndNum.has(key)) {
          dupesToDelete.push(u.id);
        } else {
          seenByCourseAndNum.set(key, u.id);
        }
      }
    }

    for (const dupId of dupesToDelete) {
      await db.delete(unit).where(eq(unit.id, dupId));
    }

  } catch (err) {
    console.warn("seedContentFromFilesystem error:", err);
  }
}
