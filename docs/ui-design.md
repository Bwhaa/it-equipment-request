# UI design (source of truth สำหรับ U1–U4)

เอกสารนี้กำหนดหน้าตาของเว็บ (`apps/web`) ทุกหน้าต้องใช้ token และ recipe ด้านล่าง ไม่ใช้สี raw ของ Tailwind

## 1. หลักการ

- modern minimal, โทน เขียว / ขาว / ดำ, มุมโค้งมน, ใช้ฟอนต์ไทยแบบไม่มีหัว (loopless), ใช้งานง่ายมาก
- mobile first: `md:` (768px) คือ breakpoint เดียวของ layout
- ฟอนต์ถูก bundle มากับแอป (`@fontsource-variable/noto-sans-thai`) ห้ามใช้ `next/font` และ build ต้องไม่ต้องใช้อินเทอร์เน็ต

## 2. Design tokens

กำหนดใน `apps/web/app/globals.css` เป็น CSS variables บน `:root` และ override ใน `@media (prefers-color-scheme: dark)` เปิดให้ Tailwind ผ่าน `@theme inline` จึงใช้ `bg-surface text-ink border-line` ได้

| Token | Light | Dark |
| --- | --- | --- |
| `ground` | `#F5F7F5` | `#0B0F0D` |
| `surface` | `#FFFFFF` | `#131A16` |
| `ink` | `#0B0F0D` | `#F2F5F3` |
| `muted` | `#55605A` | `#A3AEA7` |
| `line` | `#E2E8E3` | `#26302A` |
| `field-line` | `#8A948D` | `#6B756F` |
| `brand` | `#15803D` | `#15803D` |
| `brand-strong` | `#166534` | `#166534` |
| `brand-text` | `#15803D` | `#4ADE80` |
| `brand-tint` | `#DCFCE7` | `#14532D` |
| `on-brand` | `#FFFFFF` | `#FFFFFF` |
| `approved-bg` | `#DCFCE7` | `#14532D` |
| `approved-text` | `#166534` | `#BBF7D0` |
| `pending-bg` | `#FEF3C7` | `#422006` |
| `pending-text` | `#92400E` | `#FCD34D` |
| `danger-bg` | `#FEE4E2` | `#450A0A` |
| `danger-text` | `#B42318` | `#FCA5A5` |
| `danger-solid` | `#B42318` | `#B42318` |
| `on-danger` | `#FFFFFF` | `#FFFFFF` |
| `chip-bg` | `#EDF0EE` | `#26302A` |
| `chip-text` | `#3F4943` | `#D4DBD6` |
| `disabled-bg` | `#EDF0EE` | `#1E2722` |
| `disabled-text` | `#6B756F` | `#7C867F` |
| `inverse` | `#0B0F0D` | `#F2F5F3` |
| `on-inverse` | `#FFFFFF` | `#0B0F0D` |

`disabled-text` / `disabled-bg` ได้รับการยกเว้นจากเกณฑ์ contrast ส่วนคู่อื่นผ่านการทดสอบใน `apps/web/test/tokens.test.ts` (ข้อความ ≥ 4.5:1, ขอบของ control ≥ 3:1)

## 3. ตัวอักษร

- ฟอนต์: `'Noto Sans Thai Variable'`, `'Noto Sans Thai'`, `'Leelawadee UI'`, `'Sukhumvit Set'`, `system-ui`, `sans-serif` (token `--font-sans`)
- ชื่อหน้า 28/700 (24 บนมือถือ), หัวข้อส่วน 20/600, เนื้อความ 16/400, label 14/500, caption 13, line-height 1.6

## 4. รูปทรงและขนาด

- การ์ด `rounded-card` (20px) พร้อม `border border-line bg-surface`
- ช่องกรอก `rounded-field` (14px)
- ปุ่ม / badge / chip `rounded-pill`
- control หลักและช่องกรอกสูงอย่างน้อย 48px, เป้าที่กดได้อื่นๆ อย่างน้อย 44px

## 5. Recipe ของ component

- **Button**: primary = `bg-brand text-on-brand hover:bg-brand-strong`; secondary = `bg-surface text-ink border border-ink`; ghost = `text-brand-text`; danger = `bg-danger-solid text-on-danger`; outline-danger = `border border-danger-text text-danger-text bg-surface`; disabled = `bg-disabled-bg text-disabled-text cursor-not-allowed` ขนาด md `h-12 px-7 text-base`, sm `h-11 px-5 text-[15px]`, lg `h-[52px] px-9 text-[17px]` ทุกแบบ `rounded-pill font-semibold transition-colors`
- **Field**: `h-12 w-full rounded-field border border-field-line bg-surface px-4 text-base text-ink`; focus: `border-brand` + `ring-4 ring-brand-tint`; invalid: `border-2 border-danger-text`; textarea ใช้ `py-3`
- **Badge**: pending (`pending-bg`/`pending-text`), approved (`approved-bg`/`approved-text`), rejected = danger (`danger-bg`/`danger-text`), neutral = chip (`chip-bg`/`chip-text`), warn = สี pending
- **Alert**: success = `brand-tint`/`approved-text`, warning = pending, error = danger; role เดิม (error = `alert`, อื่นๆ = `status`)
- **Card**: `rounded-card border border-line bg-surface` (`CARD_CLASS` ใน `lib/ui-classes.ts`)
- **Pagination**: ปุ่มก่อนหน้า/ถัดไปเป็น pill สูง 44px; ปุ่มที่ใช้ไม่ได้เป็น `span` ที่มี `aria-disabled` (ไม่ใช่ลิงก์)
- **NavLink**: เดสก์ท็อป active = `bg-inverse text-on-inverse` (pill), ไม่ active = `text-muted`; บนมือถือเมนูเป็น bottom tab bar แบบ fixed, active = `bg-brand-tint text-approved-text` พร้อมไอคอน
- **EmptyState**, **Skeleton**: ใช้ token เดียวกัน (Skeleton ใช้ `bg-chip-bg`)

## 6. Layout

- header: เครื่องหมายแบรนด์ (สี่เหลี่ยม 36px `rounded-[11px] bg-brand` มีไอคอนถูกสีขาว) + ชื่อแอป + เมนู + user chip (อวาตาร์ตัวอักษรแรก, ชื่อ, ป้ายบทบาท) + ปุ่มออกจากระบบ
- container ของเนื้อหา `max-w-[1120px] mx-auto px-4 md:px-8`
- มือถือ: header กะทัดรัด (แบรนด์ + ชื่อ + ออกจากระบบ) และ bottom tab bar; `main` เว้น padding ล่างเพื่อไม่ให้แถบบังเนื้อหา

## 7. กฎ responsive สำหรับงานถัดไป

- ฟอร์มกรองเรียงซ้อนกันบนมือถือ
- กริดการ์ด 1 คอลัมน์บนมือถือ / 2 ที่ `md` / 3 ที่ `lg`
- ตารางของ admin กลายเป็นรายการการ์ดต่ำกว่า `md` (ข้อมูลเดิม ไม่เลื่อนแนวนอน)
- ฟอร์มคอลัมน์เดียว ปุ่มส่งเต็มความกว้างบนมือถือ

## 8. กฎ

- ใช้เฉพาะ semantic token ห้าม raw palette (`bg-white`, `text-black`, `text-neutral-*`, `text-red-*`, `bg-green-*` ฯลฯ) ใน `app/` และ `components/` เมื่อหน้าถูกย้ายแล้ว (`ui-class-scan.test.ts` ตรวจ; รายการ `NOT_YET_MIGRATED` ต้องว่างหลัง U3)
- ข้อความ ≥ 4.5:1
- focus-visible: outline 2px `brand-text` offset 2
- ไม่ใช้สีอย่างเดียวสื่อความหมาย (สถานะมีข้อความเสมอ)
- เคารพ `prefers-reduced-motion` (ไม่มี animation นอกจาก transition ของสี)
