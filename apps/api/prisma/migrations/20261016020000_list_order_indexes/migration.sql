-- Serves the default equipment lists: ORDER BY name ASC, id ASC (employee and admin).
-- CreateIndex
CREATE INDEX "equipments_name_id_idx" ON "equipments"("name", "id");

-- Serves the admin request list without a status filter: ORDER BY created_at DESC, id DESC (and the asc sort, scanned backward).
-- CreateIndex
CREATE INDEX "requests_created_at_id_idx" ON "requests"("created_at" DESC, "id" DESC);
