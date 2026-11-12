# รัน Supabase ทั้งกองบนเครื่องตัวเอง (Supabase CLI + Docker)

เกมนี้ใช้ Supabase เป็นหลังบ้านทั้งหมด — บัญชีผู้ใช้ เซฟความคืบหน้า กระดานอันดับ
และแผงแอดมิน ปกติชี้ไปที่โปรเจกต์บนคลาวด์ เอกสารนี้คือวิธีรัน **Supabase ทั้งกอง
บนเครื่องตัวเองด้วย Docker** แทน ไม่ต้องมีบัญชี Supabase ไม่ต้องต่อเน็ตหลังโหลด
อิมเมจเสร็จ และข้อมูลทุกอย่างอยู่ในเครื่องนี้ล้วน ๆ

---

## 1. ต้องมีอะไรก่อน

| อย่าง | เวอร์ชัน | วิธีได้มา |
|---|---|---|
| Docker Desktop | รุ่นล่าสุด | https://www.docker.com/products/docker-desktop/ (Windows ต้องเปิด WSL 2 backend) |
| Node.js | 20 ขึ้นไป | https://nodejs.org |
| Supabase CLI | 3.1.0 | มากับโปรเจกต์แล้ว (`devDependencies`) ไม่ต้องลงเพิ่ม |

> **Docker ต้องเปิดอยู่จริง ๆ** ก่อนสั่งคำสั่งในข้อ 2 — เปิดโปรแกรม Docker Desktop
> แล้วรอจนไอคอนวาฬนิ่ง เช็กได้ด้วย `docker info` ถ้าตอบกลับมาแปลว่าพร้อม
>
> เครื่องควรมี RAM ว่าง ~4 GB และพื้นที่ดิสก์ ~5 GB สำหรับอิมเมจ ครั้งแรกจะโหลดนาน
> (10–20 นาทีแล้วแต่เน็ต) ครั้งต่อ ๆ ไปขึ้นในไม่กี่สิบวินาที

---

## 2. สั่งสามคำสั่ง

```bash
npm install          # ครั้งแรกครั้งเดียว — ลง Supabase CLI มาด้วย
npm run local:up     # ยก Supabase ขึ้นทั้งกอง แล้วเขียน .env.local ให้อัตโนมัติ
npm run dev          # เปิดเกมที่ http://localhost:5173
```

`npm run local:up` ทำสองอย่างต่อกัน:

1. `supabase start` — ดึงอิมเมจ ยกคอนเทนเนอร์ขึ้นครบทุกตัว รัน migrations ใน
   `supabase/migrations/` ตามลำดับ แล้วใส่ข้อมูลตัวอย่างจาก `supabase/seed.sql`
2. `npm run supabase:env` — ถาม CLI ว่า API URL กับ anon key ของสแต็กที่เพิ่งขึ้นคืออะไร
   แล้วเขียนลง `.env.local` ให้ (Vite อ่านไฟล์นี้ทับ `.env` เสมอ)

ถ้าอยากกลับไปใช้โปรเจกต์บนคลาวด์ ลบ `.env.local` ทิ้งแล้วรัน `npm run dev` ใหม่

---

## 3. เปิดดูอะไรได้บ้าง

| บริการ | ที่อยู่ | ใช้ทำอะไร |
|---|---|---|
| **Studio** | http://localhost:54323 | หน้าเว็บจัดการทุกอย่าง — ดู/แก้ตาราง รัน SQL ดูผู้ใช้ ดู logs |
| **API (PostgREST)** | http://localhost:54321 | ปลายทางที่ตัวเกมคุยด้วย |
| **Postgres** | `postgresql://postgres:postgres@localhost:54322/postgres` | ต่อตรงด้วย `psql` / DBeaver / pgAdmin ได้ |
| **Mailpit** | http://localhost:54324 | อีเมลทุกฉบับที่ระบบส่ง (ลิงก์รีเซ็ตรหัสผ่าน) มาโผล่ที่นี่ ไม่ได้ออกไปข้างนอกจริง |
| **Analytics (Logflare)** | http://localhost:54327 | log ของทุกบริการ |

บริการที่ขึ้นมาด้วยแต่เกมยังไม่ได้เรียกใช้ (เปิดไว้ให้ครบตามโจทย์): **Storage**
(พร้อม S3 protocol), **Realtime**, และ **Edge Functions runtime** (Deno 2) —
วางไฟล์ไว้ที่ `supabase/functions/<ชื่อ>/index.ts` แล้ว `supabase functions serve`
ก็ใช้ได้ทันที

---

## 4. บัญชีตัวอย่างที่มีให้เลย

มาจาก `supabase/seed.sql` ซึ่งรันอัตโนมัติตอน `supabase start` / `supabase db reset`
**รหัสผ่านพวกนี้อยู่ในกิตโดยตั้งใจ** เพราะเป็นบัญชีของฐานข้อมูลที่เกิดและตายไป
พร้อมกับคอนเทนเนอร์เท่านั้น — ห้ามเอาไปใช้กับโปรเจกต์จริง

| อีเมล | รหัสผ่าน | เป็นใคร |
|---|---|---|
| `admin@local.test` | `admin12345` | **แอดมิน** — เห็นปุ่ม 🛡 แผงแอดมิน เพิ่ม/แก้ไข/ลบ/ระงับผู้ใช้ได้ |
| `rookie@local.test` | `player12345` | ผู้เล่นใหม่ ด่าน 1 |
| `veteran@local.test` | `player12345` | ผู้เล่นกลางเกม ด่าน 4 โหมดยาก |
| `conqueror@local.test` | `player12345` | จบเกมแล้ว อยู่หัวกระดานอันดับ |
| `banned@local.test` | `player12345` | **ถูกระงับ** — ล็อกอินได้แต่เจอหน้า "บัญชีถูกระงับ" และเขียนฐานข้อมูลไม่ได้เลย |

ล็อกอินด้วยชื่อเล่นก็ได้ (`dungeonmaster`, `rookie`, `veteran`, `conqueror`, `banned`)
หรือเบอร์โทร (`0800000000`–`0800000004`) — ดูหัวข้อ "ล็อกอินด้วยเบอร์โทร/ชื่อเล่น"
ใน README หลัก

---

## 5. คำสั่งที่ใช้บ่อย

```bash
npm run supabase:start    # ยกขึ้น
npm run supabase:stop     # ปิด (ข้อมูลยังอยู่ ครั้งหน้าขึ้นมาเหมือนเดิม)
npm run supabase:status   # ดูว่าอะไรรันอยู่ที่พอร์ตไหน คีย์อะไร
npm run supabase:reset    # ล้างฐานข้อมูล รัน migrations ใหม่หมด แล้วใส่ seed ใหม่
npm run supabase:env      # เขียน .env.local ใหม่จากสถานะปัจจุบัน

npx supabase stop --no-backup   # ปิดและลบข้อมูลทิ้งทั้งหมด เริ่มใหม่หมดจด
```

**`npm run supabase:reset` คือคำสั่งที่ใช้บ่อยที่สุดตอนตรวจงาน** — มันพิสูจน์ว่า
migrations ทั้งชุดรันจากศูนย์ได้จริง ไม่ใช่ฐานข้อมูลที่ถูกแก้มือสะสมมา

---

## 6. ของในโฟลเดอร์นี้

```
supabase/
  config.toml            ตั้งค่าสแต็กทั้งกอง: พอร์ต, auth, อีเมล, storage, realtime,
                         edge functions, analytics — มีคอมเมนต์อธิบายทุกค่าที่ตั้งเอง
  seed.sql               บัญชีและความคืบหน้าตัวอย่าง (ข้อ 4)
  migrations/            สคีมาทั้งหมด เรียงตามลำดับที่ต้องรัน
    20250101000000_extensions.sql            สร้าง schema extensions + pgcrypto
    20250101000001_schema.sql                ตาราง profiles / game_saves / scores + RLS
    20250101000002_player_stats.sql          คอลัมน์ HP / พลังโจมตี / ไอเทมที่เก็บ
    20250101000003_levels_and_skill.sql      คอลัมน์ด่านปัจจุบัน / คูลดาวน์สกิล
    20250101000004_phone_nickname_login.sql  ชื่อเล่น + เบอร์โทร + RPC หาอีเมลจากทั้งสอง
    20250101000005_character_selection.sql   อาชีพ + สีผิว
    20250101000006_character_name.sql        ชื่อตัวละคร (unique)
    20250101000007_progress_leaderboard.sql  RPC กระดานอันดับ
    20250101000008_character_gender.sql      เพศ
    20250101000009_character_shirt_color.sql สีเสื้อ
    20250101000010_character_name_uniqueness.sql  ชื่อซ้ำแบบไม่สนตัวพิมพ์ + RPC จองชื่อ
    20250101000011_difficulty.sql            โหมดง่าย/ยากที่เลือกไว้
    20250101000012_admin.sql                 allow-list แอดมิน + is_admin() + RPC ภาพรวม
    20250101000013_last_position.sql         จำตำแหน่งที่ยืนอยู่ในดันเจี้ยน
    20250101000014_admin_user_management.sql เพิ่ม/แก้ไข/ลบ/ระงับผู้ใช้ + บังคับการระงับด้วย RLS
```

ไฟล์ใน `migrations/` คือไฟล์ชุดเดียวกับที่เคยเป็น `schema.sql` + `migrations_0NN_*.sql`
**เนื้อในไม่ได้แก้** เปลี่ยนแค่ชื่อให้เป็นรูปแบบที่ Supabase CLI รู้จัก
(`<เลขเวลา 14 หลัก>_<ชื่อ>.sql`) จะเอาไปวางใน SQL Editor ของโปรเจกต์คลาวด์
ทีละไฟล์ตามลำดับเหมือนเดิมก็ยังได้

---

## 7. ความปลอดภัย — จุดที่อยากให้ดู

ทั้งโปรเจกต์ **ไม่มี `service_role` key อยู่ในหน้าเว็บเลย** หน้าเว็บถือแค่ anon key
ซึ่งเป็นคีย์สาธารณะ อำนาจของแอดมินทั้งหมดอยู่ในฟังก์ชัน `SECURITY DEFINER` ฝั่ง
Postgres ที่ขึ้นต้นด้วยการถาม `public.is_admin()` ทุกตัว — ซ่อนปุ่มในหน้าเว็บเป็น
แค่การตกแต่ง ไม่ใช่กำแพง

ลองพิสูจน์ได้จาก Studio → SQL Editor:

```sql
-- สวมบทผู้เล่นธรรมดาแล้วลองเรียก RPC ของแอดมิน → ต้องได้ 42501 insufficient_privilege
-- (ครอบด้วย begin/rollback เพราะ set_config แบบ local มีผลแค่ใน transaction เดียว
--  และเพื่อไม่ให้เหลืออะไรค้างไว้หลังทดลองเสร็จ)
begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = 'rookie@local.test'),
                      'role', 'authenticated')::text, true);
  select * from public.get_admin_player_overview();
rollback;
```

และการระงับบัญชีก็บังคับที่ RLS ไม่ใช่ที่หน้าเว็บ — `banned@local.test` ต่อให้แก้
JavaScript ในเบราว์เซอร์เองก็ยังเขียนฐานข้อมูลไม่ได้สักแถว

---

## 8. เจอปัญหา

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| `docker: command not found` | ยังไม่ได้ลง Docker Desktop หรือยังไม่ได้เปิด |
| `failed to inspect container health` | Docker ลงแล้วแต่ยังไม่ได้เปิดโปรแกรม |
| พอร์ตชนกัน (54321–54327) | มีอะไรใช้พอร์ตอยู่ — ปิดตัวนั้น หรือแก้พอร์ตใน `config.toml` แล้ว `supabase stop` + `start` ใหม่ |
| ล็อกอินไม่ผ่านทั้งที่รหัสถูก | `.env.local` ชี้ผิดที่ — รัน `npm run supabase:env` ใหม่ |
| ลิงก์รีเซ็ตรหัสผ่านไม่เข้าเมล | ถูกแล้ว — อีเมลทุกฉบับไปโผล่ที่ Mailpit http://localhost:54324 |
| แก้ migration แล้วไม่เห็นผล | `npm run supabase:reset` (CLI รัน migration ที่รันไปแล้วซ้ำให้ไม่ได้) |

---

## 9. ข้อควรระวังสำหรับโปรเจกต์บนคลาวด์

โปรเจกต์บนคลาวด์ถูกสร้างด้วยการเอา SQL พวกนี้ไปวางใน SQL Editor ทีละไฟล์ด้วยมือ
ไม่ได้ผ่าน CLI มันจึง **ไม่มีประวัติ migration** ในตารางของ CLI

ดังนั้น **อย่าเพิ่งสั่ง `supabase db push` ใส่โปรเจกต์คลาวด์** — CLI จะเห็นว่า
ยังไม่เคยรัน migration สักไฟล์ แล้วพยายามรันใหม่ทั้งหมดทับของที่มีอยู่ ถ้าจะเชื่อม
สองฝั่งเข้าด้วยกันจริง ๆ ต้อง `supabase link` แล้ว `supabase migration repair --status applied <เลขเวลา>`
ไล่ทีละไฟล์ก่อน เพื่อบอก CLI ว่าของพวกนี้ขึ้นไปแล้ว

การรันบนเครื่องตัวเองตามเอกสารนี้ไม่แตะโปรเจกต์คลาวด์เลยแม้แต่น้อย
