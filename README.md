# IT Equipment Request System

## 1. ภาพรวมระบบ

ระบบขอเบิกอุปกรณ์ไอที: พนักงาน (EMPLOYEE) ดูรายการอุปกรณ์และยื่นคำขอเบิก ส่วนผู้ดูแล (ADMIN) อนุมัติ/ปฏิเสธคำขอและจัดการอุปกรณ์
การอนุมัติตัดสต็อกและบันทึก audit log ใน transaction เดียวกัน

**Stack:** NestJS 11 + Prisma 6 + PostgreSQL 16 (API) · Next.js 15 App Router + Tailwind 4 (web, เรียก API ผ่าน BFF เท่านั้น) · pnpm workspace · Node 22

## 2. Quick start ด้วย Docker

Prerequisites: Docker Desktop หรือ Docker Engine ที่มี Compose v2 (บน WSL2 ต้องเปิด WSL integration ของ distro ที่ใช้)

```bash
cp .env.example .env
openssl rand -hex 32        # เอาค่าที่ได้ไปแทนบรรทัด JWT_SECRET=... ใน .env (ต้องยาวอย่างน้อย 32 ตัวอักษร)
docker compose up --build   # ใส่ -d เพื่อรันเบื้องหลัง
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- รอจนทุก service เป็น `healthy` (ตรวจด้วย `docker compose ps`) — api จะ apply migration และ seed เองก่อนเริ่มรับ request

ถ้า `JWT_SECRET` สั้นกว่า 32 ตัวอักษร API จะไม่ยอมเริ่มทำงาน (ตั้งใจให้เป็นเช่นนั้น)

## 3. บัญชีทดสอบ

| Email | Password | Role |
| --- | --- | --- |
| admin@company.com | Admin@123 | ADMIN |
| employee1@company.com | Employee@123 | EMPLOYEE |
| employee2@company.com | Employee@123 | EMPLOYEE |

ข้อมูล seed: อุปกรณ์ 8 รายการ (รวมรายการสต็อกหมดและรายการ INACTIVE) และคำขอ 15 รายการ (PENDING 7, APPROVED 5, REJECTED 3)
มี PENDING สองรายการไว้สาธิตกรณี 409: คำขอบนโปรเจกเตอร์ที่เป็น INACTIVE และคำขอที่จำนวนเกินสต็อก

## 4. การรันแบบ development

ใช้ Node 22 (`.nvmrc`) และ pnpm 10 ผ่าน corepack

```bash
docker compose up -d db
pnpm install
pnpm --filter api db:migrate
pnpm --filter api db:seed
pnpm dev
```

## 5. Migration และ seed

- container `api` รัน `prisma migrate deploy` ทุกครั้งที่เริ่ม แล้วรัน seed **เฉพาะเมื่อตาราง users ว่าง** (restart แล้วข้อมูลไม่ถูกเขียนทับ)
- `pnpm --filter api db:reset` **ลบข้อมูลทั้งหมด** — ให้คนรันเองใน terminal ของตัวเองเท่านั้น

## 6. การทดสอบ

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter api test:e2e
```

`test:e2e` ต้องมี db container รันอยู่ (`docker compose up -d db`); ฐานข้อมูล `it_equipment_test` ถูกสร้างอัตโนมัติ และชุดทดสอบจะไม่ยอมรันบนฐานข้อมูลที่ชื่อไม่ลงท้ายด้วย `_test`

ชุดทดสอบพิสูจน์: ตาราง RBAC ของทุก route (และทุก route ต้องประกาศสิทธิ์ชัดเจน), การ rollback ของ transaction เมื่อบันทึก audit log ไม่สำเร็จ,
การอนุมัติพร้อมกันหลายคำขอที่ไม่ทำให้สต็อกติดลบ, และ `VERSION_CONFLICT` ของการแก้ไขอุปกรณ์ (optimistic locking)

## 7. โครงสร้างโปรเจกต์

```
apps/api         NestJS + Prisma (prisma/ มี schema, migrations, seed)
apps/web         Next.js (app/, components/ui, lib/api.ts = BFF client)
packages/shared  types ที่ใช้ร่วมกัน
docs/            checkpoint-1.2.md, erDiagram.txt, erd.png
```

เอกสาร: [docs/checkpoint-1.2.md](docs/checkpoint-1.2.md) · [docs/erDiagram.txt](docs/erDiagram.txt) · [docs/erd.png](docs/erd.png)

## 8. API endpoints (prefix `/api/v1`)

| Method | Path | Role |
| --- | --- | --- |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | EMPLOYEE, ADMIN |
| GET | `/equipments` | EMPLOYEE, ADMIN |
| GET | `/equipments/categories` | EMPLOYEE, ADMIN |
| GET | `/equipments/:id` | EMPLOYEE, ADMIN |
| POST | `/equipments` | ADMIN |
| PATCH | `/equipments/:id` | ADMIN |
| POST | `/requests` | EMPLOYEE |
| GET | `/requests/me` | EMPLOYEE |
| GET | `/requests` | ADMIN |
| GET | `/requests/:id` | EMPLOYEE (เฉพาะของตัวเอง), ADMIN |
| PATCH | `/requests/:id/approve` | ADMIN |
| PATCH | `/requests/:id/reject` | ADMIN |

## 9. Git workflow

ทำงานบน `develop` หนึ่ง task ต่อหนึ่ง commit แล้วเปิด PR เดียว `develop` → `main`
**ห้าม squash merge** (ใช้ merge commit หรือ rebase) เพื่อให้ commit รายฟีเจอร์ยังอยู่

## 10. ข้อจำกัดที่รู้

- Login rate limit เก็บในหน่วยความจำ: แยกต่อ instance และหายเมื่อ restart
- การจำกัดต่อ IP ปิดอยู่ จะทำงานเมื่อตั้ง `TRUST_PROXY` หลัง reverse proxy ที่เชื่อถือได้และเขียนทับ `X-Forwarded-For` เท่านั้น (ตัวป้องกันหลักคือการจำกัดต่อ email)
- JWT อายุ 1 ชั่วโมงและไม่มี refresh token
- หน้าเว็บที่เรียก `notFound()` ตอบ HTTP 200 เพราะมี `loading.tsx` (semantics แบบ 404 บังคับใช้และทดสอบที่ API)
- ไม่มี browser (UI) automation test: พฤติกรรม UI ตรวจด้วย unit test และ curl กับ production build
- ใช้ Tailwind component ธรรมดา (ไม่มี UI library)
- container ผูกพอร์ตกับ 127.0.0.1 เท่านั้น
