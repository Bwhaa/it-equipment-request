-- Equipment names are unique ignoring letter case and surrounding spaces, INACTIVE items included.
-- Prisma cannot model an expression index, so it exists only in SQL (see CLAUDE.md).
CREATE UNIQUE INDEX "equipments_name_key_idx" ON "equipments" (lower(btrim("name")));
