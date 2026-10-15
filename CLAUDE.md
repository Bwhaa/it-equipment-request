# IT Equipment Request System — rules for Claude Code

## Read first (every task)
- `docs/checkpoint-1.2.md` is the source of truth: schema, endpoints, DTO rules,
  error codes, transaction design. Cite its section numbers (e.g. "§5.1") in your summary.
- `docs/erDiagram.txt` is the schema. Prisma models must match it exactly.
- Approved additions (already merged into the docs): error codes `INTERNAL_ERROR` (500) and `TOO_MANY_REQUESTS` (429) in §6.
- If the task, this file, and the docs disagree, or the docs don't cover a case:
  STOP and ask. Do not guess, do not invent endpoints, fields, or status codes.

## Stack & layout
- pnpm workspace. `apps/api` NestJS 11 + Prisma 6 + PostgreSQL 16.
  `apps/web` Next.js 15 (App Router) + Tailwind 4 + shadcn/ui. `packages/shared` = types only.
- Node 22 LTS (`.nvmrc`), `engines: >=22`. Ports: web 3000, api 3001 (prefix `/api/v1`), db 5432.
- One root `.env` (see `.env.example`). `JWT_SECRET` is shared by api and web.
  The API loads it through ConfigModule (`.env.test` when NODE_ENV=test); do not add dotenv
  wrappers to runtime scripts.
- Do not upgrade majors (Next 16, Prisma 7, ...) or add packages not in the plan without asking.

## Git
- `main` holds only the initial commit until submission. All work happens on `develop`.
- Never commit to, push to, rebase, or merge into `main`, except the initial commit in task 1.
- Do not push and do not add remotes; the user pushes. Never force-push.
- The user opens one PR `develop` → `main` at submission. It must NOT be squash-merged
  (merge commit or rebase only) so the per-feature commits survive.

## Commands
- `docker compose up -d db`
- `pnpm --filter api db:migrate` / `db:seed` / `db:reset` — these wrap the Prisma CLI
  with `dotenv -e ../../.env --`. Never run `prisma` directly: it cannot see the root `.env`.
  Only exception: `prisma migrate deploy` in the e2e global setup, where DATABASE_URL is
  already in the environment.
- Migrations: `pnpm --filter api db:migrate --name <name>` (add `--create-only` the same way).
  Do NOT add an extra `--`: it makes Prisma ask for the name interactively.
- `pnpm dev` (api + web)
- Gate before every commit — all must pass:
  `pnpm lint && pnpm typecheck && pnpm test`
  plus `pnpm --filter api test:e2e` if anything in `apps/api` changed.

## Hard rules
- TypeScript strict. No `any`, no `as any`, no `@ts-ignore`/`@ts-expect-error`.
  Use `unknown` + narrowing. Shared shapes come from `@app/shared` via `import type`.
- Every body / query / param is validated: class-validator DTO for body and query,
  `ParseUUIDPipe` on every `:id`. Global `ValidationPipe({ whitelist: true,
  forbidNonWhitelisted: true, transform: true })`. Numeric query fields use `@Type(() => Number)`.
- String inputs use the safe `trim` from `src/common/transforms.ts` (§4.4).
- Every thrown error is `new XxxException({ code, message })` with a `code` from the
  `ErrorCode` type (§6). Unexpected errors become `500 INTERNAL_ERROR` with a generic
  message; the stack is logged server-side with the request id, never sent to the client.
- Identity comes ONLY from the verified JWT (`@CurrentUser()`): never read
  `requesterId`, `actorId`, `reviewedById`, `userId` or `role` from body or query.
- Guards: register `JwtAuthGuard` as `APP_GUARD` BEFORE `RolesGuard`.
- Every controller route declares its access explicitly: `@Public()` or `@Roles(...)` (any logged-in user: `@Roles('EMPLOYEE', 'ADMIN')`). `route-access.e2e-spec.ts` fails if a route has neither.
- Failed logins are rate limited (§3). Never remove or weaken the limiter to make a test pass; tests use unique emails / X-Forwarded-For values.
- Every user-supplied `search` goes through `escapeLike()` (`common/escape-like.ts`) before a Prisma `contains`, and every paginated list has a deterministic order that ends with `id`.
- Prisma: camelCase fields + `@map` snake_case, `@@map` table names, `@db.Uuid` ids,
  `@db.Timestamptz(3)` timestamps. Schema changes only via migrations.
  Never run `prisma db push`. Never remove the hand-written CHECK constraints (§2).
- Prisma blocks `migrate reset` for AI agents. Never run `db:reset`, `prisma migrate reset`,
  `db push --force-reset`, `docker compose down -v`, or drop a database yourself, and never
  bypass that guard. If a reset is needed, stop and ask the user to run
  `pnpm --filter api db:reset` in their own terminal.
- Every request status change writes an AuditLog row in the SAME transaction,
  via `AuditLogService.log(tx, ...)` (create: null → PENDING).
- Seed data lives ONLY in `seed(prisma)` in `apps/api/prisma/seed-data.ts` (fixed UUIDs +
  `upsert` with `update: {}`, no top-level side effects). `prisma/seed.ts` is only the CLI
  runner; e2e imports from `seed-data.ts`. Never write a second seed.

## Must-not-miss (each one was a review finding)
1. Approve (§5): one `$transaction`; `updateMany` request WHERE `status = PENDING`;
   `updateMany` equipment WHERE `status = ACTIVE AND stockQuantity >= qty` with
   `decrement` AND `version: { increment: 1 }`; count 0 → re-read to choose
   `EQUIPMENT_INACTIVE` vs `INSUFFICIENT_STOCK`; then audit log. No read-then-write on stock.
2. Reject and create-request are transactions too (status/insert + audit log).
3. `CreateEquipmentDto.status` has NO default value (PartialType copies initializers into
   UpdateEquipmentDto). The default is `@default(ACTIVE)` in Prisma (§4.4).
4. `UpdateEquipmentDto` requires `version` AND at least one other field → else 400 (§5.1).
   Update uses `updateMany WHERE { id, version }` + `version: { increment: 1 }`; count 0 → 404 or 409 `VERSION_CONFLICT`.
5. Employee sees ACTIVE equipment only (list, detail, categories). INACTIVE → 404,
   also when creating a request on it. Stock 0 / qty > stock on create → 422 (§6).
6. Employee reading another user's request → 404, not 403 (§3).
7. Next.js login Route Handler sets the httpOnly cookie and returns ONLY `{ user }`.
   The browser must never receive `accessToken` (§3).
8. `middleware.ts` runs on Edge: verify with `jose` (HS256), never `jsonwebtoken` (§3).
   middleware is UX only; real authorization is the NestJS guards.
9. Browser never calls NestJS directly. All API calls go through `apps/web/lib/api.ts`
   (`import 'server-only'`), which attaches `Authorization: Bearer` from the cookie.

## Frontend
- Cookies can be changed ONLY in middleware, Route Handlers, and Server Actions —
  never in a Server Component or in `lib/api.ts`.
  - Expired / invalid token: middleware deletes the cookie and redirects
    (`/login?expired=1` when expired, `/login` when invalid).
  - 401 seen by `lib/api.ts`: `redirect('/api/auth/logout?expired=1')`; that Route Handler
    deletes the cookie and redirects to `/login?expired=1`.
- Role routing in middleware: `/` → role home; employee on `/admin/*` → `/equipments`;
  admin on employee routes → `/admin/requests`; logged-in user on `/login` → role home.
  `matcher` skips `/api/auth`, `_next/static`, `_next/image`, `favicon.ico`, and any path with a file extension.
- Server Actions RETURN errors (`{ ok: false, error: ApiError }`) for `useActionState`;
  never throw expected errors (production hides their message). Call `redirect()` only
  outside `try/catch` (it works by throwing).
- Every data view has Loading (`loading.tsx` / skeleton), Empty, and Error states.
- Show API `code`/`message` from `ApiError`; on `VERSION_CONFLICT` refetch and show the
  latest values in the form, not just a toast. Disable "request" when stock = 0
  and show "หมด"; disable Approve + show a warning when equipment is INACTIVE or stock < qty.

## Testing
- e2e uses the `it_equipment_test` database (`apps/api/.env.test`, committed, no secrets).
  Global setup creates the database if missing, then runs `prisma migrate deploy` on it
  (never reset). It refuses to run unless the database name ends with `_test`, and
  `resetDb()` re-checks `current_database()` before truncating.
- Every e2e file starts with `beforeAll(resetDb)`: one `TRUNCATE audit_logs, requests,
  equipments, users` statement, then `seed(prisma)`. Run with `--runInBand`.
- Each feature task adds e2e tests for its own acceptance criteria.
- Never delete or skip (`.skip`, `xit`) an existing test to make the gate pass.

## Workflow
- Do only the current task's scope. Found something outside it? List it under
  "Follow-ups" in your summary; do not fix it.
- Conventional Commits, using the commit message given in the task.
  1 task = 1 commit (a few at most, all with the same scope).
- Do not edit `docs/` or this file unless the task says so.
- Long-running processes (dev servers): start them with `setsid`, remember the process group id, stop with `kill -TERM -- -<pgid>`, and before finishing check `ss -ltn` shows ports 3000/3001 free and `pgrep -fa 'nest|next'` shows nothing from this repo.
- Smoke tests against the dev API are read-only (GET + login only). Anything that creates or changes data runs in e2e on the test database.
- Never commit `.env` or secrets.
- End every task with: files changed, commands run + results, acceptance criteria
  checked one by one, open questions, follow-ups.
