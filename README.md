# IT Equipment Request System

## 1. ภาพรวมระบบ

ระบบขอเบิกอุปกรณ์ไอที: พนักงาน (EMPLOYEE) ดูรายการอุปกรณ์และยื่นคำขอเบิก ส่วนผู้ดูแล (ADMIN) อนุมัติ/ปฏิเสธคำขอและจัดการอุปกรณ์
การอนุมัติตัดสต็อกและบันทึก audit log ใน transaction เดียวกัน ชื่ออุปกรณ์ห้ามซ้ำกัน (ไม่สนตัวพิมพ์ใหญ่เล็ก ไม่นับช่องว่างหัวท้าย รวมรายการที่ปิดใช้งาน) ฐานข้อมูลเป็นผู้บังคับกฎนี้ แบบฟอร์มขอเบิกใหม่ส่ง idempotency key ที่สร้างใหม่ทุกครั้งที่โหลดหน้าฟอร์ม ดังนั้นการส่งฟอร์มที่โหลดแล้วใบเดิมซ้ำ (กดสองครั้ง หรือส่งซ้ำเพราะคำตอบหาย) จะสร้างคำขอเพียงใบเดียว ส่วนการโหลดหน้าใหม่หรือกด Back จะได้ฟอร์มใหม่พร้อม key ใหม่ และการส่งฟอร์มนั้นสร้างคำขอใหม่

**Stack:** NestJS 11 + Prisma 6 + PostgreSQL 16 (API) · Next.js 15 App Router + Tailwind 4 (web, เรียก API ผ่าน BFF เท่านั้น) · pnpm workspace · Node 22

## 2. Quick start ด้วย Docker

Prerequisites: Docker Desktop หรือ Docker Engine ที่มี Compose v2 (บน WSL2 ต้องเปิด WSL integration ของ distro ที่ใช้)

```bash
cp .env.example .env
sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env && rm .env.bak
docker compose up --build   # ใส่ -d เพื่อรันเบื้องหลัง
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- รอจนทุก service เป็น `healthy` (ตรวจด้วย `docker compose ps`) — api จะ apply migration และ seed เองก่อนเริ่มรับ request

ถ้า `JWT_SECRET` สั้นกว่า 32 ตัวอักษร API จะไม่ยอมเริ่มทำงาน (ตั้งใจให้เป็นเช่นนั้น) และ API จะไม่เริ่มเมื่อ `JWT_SECRET` ยังเป็นค่าตัวอย่างจาก `.env.example` (container จะหยุดและ log ระบุชื่อ `JWT_SECRET`)

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
- หมายเหตุการอัปเกรด: การเริ่ม container กับฐานข้อมูลที่มีอยู่แล้วจะ apply migration `equipment_name_unique` อัตโนมัติ และจะล้มด้วย unique violation ถ้าฐานข้อมูลนั้นมีอุปกรณ์ชื่อซ้ำกันอยู่แล้ว (ไม่สนตัวพิมพ์ใหญ่เล็กและช่องว่างหัวท้าย) ให้เปลี่ยนชื่อรายการใดรายการหนึ่งก่อน

## 6. การทดสอบ

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter api test:e2e
```

`test:e2e` ต้องมี db container รันอยู่ (`docker compose up -d db`); ฐานข้อมูล `it_equipment_test` ถูกสร้างอัตโนมัติ และชุดทดสอบจะไม่ยอมรันบนฐานข้อมูลที่ชื่อไม่ลงท้ายด้วย `_test`

ชุดทดสอบพิสูจน์: ตาราง RBAC ของทุก route (และทุก route ต้องประกาศสิทธิ์ชัดเจน), การ rollback ทั้ง transaction ของ approve / reject / create เมื่อบันทึก audit log ไม่สำเร็จ (`rollback.e2e-spec.ts`),
การอนุมัติพร้อมกัน เช่น สต็อก 4 กับ 10 คำขอ → อนุมัติได้ 4 และสต็อกไม่ติดลบ (`concurrency.e2e-spec.ts`),
และ `VERSION_CONFLICT` เมื่อ PATCH อุปกรณ์ด้วย version เก่าหรือพร้อมกัน (`concurrency.e2e-spec.ts`, `equipments.e2e-spec.ts`)

ชุดทดสอบของ web (`apps/web/test`) ครอบคลุมการ render ด้วย `renderToString` ของ component ใน `components/ui`, หน้ารายการ/รายละเอียด/ฟอร์ม และสถานะ loading / empty / error ของทุกหน้า (เปรียบเทียบกับ snapshot), การมี title ของทุกหน้า และกฎ class สีข้อความ error ในโหมดมืด แต่ **ไม่ครอบคลุม** การคลิก, hydration, การย้ายโฟกัสหลังส่งฟอร์มไม่ผ่าน และการแสดงผลจริงในเบราว์เซอร์

## 7. โครงสร้างโปรเจกต์

```
apps/api         NestJS + Prisma (prisma/ มี schema, migrations, seed)
apps/web         Next.js (app/, components/ui, lib/api.ts = BFF client)
packages/shared  types ที่ใช้ร่วมกัน
docs/            checkpoint-1.2.md, erDiagram.txt, erd.png
```

เอกสาร: [docs/checkpoint-1.2.md](docs/checkpoint-1.2.md) · [docs/erDiagram.txt](docs/erDiagram.txt) · [docs/erd.png](docs/erd.png)

## 8. API endpoints

| Method | Path | Role |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/auth/me` | EMPLOYEE, ADMIN |
| GET | `/api/v1/equipments` | EMPLOYEE, ADMIN |
| GET | `/api/v1/equipments/categories` | EMPLOYEE, ADMIN |
| GET | `/api/v1/equipments/:id` | EMPLOYEE, ADMIN |
| POST | `/api/v1/equipments` | ADMIN |
| PATCH | `/api/v1/equipments/:id` | ADMIN |
| POST | `/api/v1/requests` | EMPLOYEE |
| GET | `/api/v1/requests/me` | EMPLOYEE |
| GET | `/api/v1/requests` | ADMIN |
| GET | `/api/v1/requests/:id` | EMPLOYEE (เฉพาะของตัวเอง), ADMIN |
| PATCH | `/api/v1/requests/:id/approve` | ADMIN |
| PATCH | `/api/v1/requests/:id/reject` | ADMIN |

## 9. Git workflow

ทำงานบน `develop` หนึ่ง task ต่อหนึ่ง commit แล้วเปิด PR เดียว `develop` → `main`
**ห้าม squash merge** (ใช้ merge commit หรือ rebase) เพื่อให้ commit รายฟีเจอร์ยังอยู่

**งานอัปเกรดหลังส่ง:** งานที่ส่งตรวจอยู่ที่ branch `develop` (tag `submission-v1`, PR `develop` → `main`) งานปรับปรุงหลังส่งทำแยกที่ branch `upgrade/v2` เป็น commit ใหม่ต่อจากจุดส่งงาน และเปิด PR แยก (`upgrade/v2` → `develop`) โดยไม่แก้ประวัติของงานที่ส่ง ห้าม squash merge ทั้งสอง PR

## 10. ข้อจำกัดที่รู้

- Login rate limit เก็บในหน่วยความจำ: แยกต่อ instance และหายเมื่อ restart
- การจำกัดต่อ IP ปิดอยู่ จะทำงานเมื่อตั้ง `TRUST_PROXY` **และ** request มี `X-Forwarded-For` หลัง reverse proxy ที่เชื่อถือได้และเขียนทับ `X-Forwarded-For` เท่านั้น (ตัวป้องกันหลักคือการจำกัดต่อ email)
- JWT อายุเริ่มต้น 1 ชั่วโมง (ตั้งได้ด้วย `JWT_EXPIRES_IN`) และ cookie ของ web หมดอายุที่ 1 ชั่วโมงเสมอ; ไม่มี refresh token
- หน้าเว็บที่เรียก `notFound()` ตอบ HTTP 200 เพราะมี `loading.tsx` (semantics แบบ 404 บังคับใช้และทดสอบที่ API)
- ไม่มี browser (UI) automation test: พฤติกรรม UI ตรวจด้วย unit test และ curl กับ production build
- ใช้ Tailwind component ธรรมดา (ไม่มี UI library)
- container ผูกพอร์ตกับ 127.0.0.1 เท่านั้น
- bcrypt ใช้เฉพาะ 72 ไบต์แรกของรหัสผ่าน (อักษรไทยใช้ 3 ไบต์ต่อตัว) ส่วนที่เกินถูกละเว้นเงียบๆ; API จำกัดรหัสผ่านไม่เกิน 128 ตัวอักษร
- เมื่อใช้งานหลัง HTTPS ให้ตั้ง `COOKIE_SECURE=true`; แอปไม่ตั้ง HSTS (เป็นหน้าที่ของ TLS proxy)
- ฐานข้อมูลใช้ผู้ใช้/รหัสผ่าน `app`/`app` และเปิดพอร์ต 5432 บน 127.0.0.1 เท่านั้น: สำหรับใช้ในเครื่อง
- health check ของ api พิสูจน์เพียงว่า process ตอบสนอง (เรียก `/auth/me` แล้วคาดหวัง 401) ไม่ได้ query ฐานข้อมูล
- ชื่ออุปกรณ์ที่ต่างกันเฉพาะช่องว่างภายในชื่อ (เช่น `Monitor  24-inch` สองช่องว่าง) ถือเป็นคนละชื่อ (ทดสอบแล้ว: สร้างได้) ส่วนการเทียบตัวพิมพ์ใหญ่เล็กตามภาษาอื่นขึ้นกับ locale ของฐานข้อมูล: บน PostgreSQL ใน compose (`en_US.utf8`) `ÉCRAN` กับ `écran` ถือว่าซ้ำ (ทดสอบแล้วได้ 409) แต่ฐานข้อมูลที่สร้างด้วย locale `C` จะไม่พับตัวพิมพ์ใหญ่เล็กของอักษรนอก ASCII
- security header ที่ตั้งไว้: `nosniff`, referrer policy, `X-Frame-Options` และ CSP `frame-ancestors` เท่านั้น (ไม่มี CSP ของ script)
- Idempotency key ไม่มีวันหมดอายุ และการ replay เทียบเฉพาะอุปกรณ์ จำนวน และเหตุผลหลัง trim เท่านั้น
- ไคลเอนต์ที่ไม่ส่ง header `Idempotency-Key` จะไม่ได้รับการป้องกันคำขอซ้ำ
- กด Back แล้วส่งใหม่ถือเป็นคำขอใหม่ (หน้าฟอร์มถูกโหลดใหม่และได้ key ใหม่) การกันซ้ำครอบคลุมการส่งฟอร์มเดิมซ้ำ ไม่ครอบคลุมการสร้างคำขอเดียวกันจากหน้าที่โหลดใหม่
