-- Optional client-supplied idempotency key (POST /requests); unique per requester, NULLs may repeat.
-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "idempotency_key" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "requests_requester_id_idempotency_key_key" ON "requests"("requester_id", "idempotency_key");
