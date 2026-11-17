-- ข้อมูลตัวอย่าง — ไฟล์เดียวกันนี้ใช้ได้ทั้งเครื่องตัวเองและโปรเจกต์บนคลาวด์
--
-- บนเครื่อง: `supabase start` / `supabase db reset` รันให้อัตโนมัติต่อท้าย
-- migrations ทั้งหมด (ดู [db.seed] ใน config.toml)
-- บนคลาวด์: เอาไฟล์นี้ไปวางใน SQL Editor แล้วกดรัน (ดู supabase/README.md ข้อ 9)
--
-- ผลคือเปิดเกมปุ๊บมีของให้ดูเลย — กระดานอันดับไม่ว่างเปล่า แผงแอดมินมีผู้เล่นให้กดดู
-- และมีบัญชีที่ถูกระงับไว้ให้ลองหน้าจอ "บัญชีถูกระงับ" โดยไม่ต้องไประงับใครเอง
--
-- **รันซ้ำได้ และไม่ลบอะไรทิ้ง** ทุกขั้นตอนข้างล่างเช็กก่อนว่ามีอยู่แล้วหรือยัง
-- บัญชีที่มีอยู่แล้วจะถูกอัปเดตให้ตรงกับไฟล์นี้ ไม่ใช่สร้างซ้ำ — รันกี่รอบผลก็
-- ลงเอยเหมือนกัน และ **ผู้ใช้จริงที่มีอยู่ก่อนไม่ถูกแตะต้องเลย**
--
-- ข้อควรรู้ก่อนรันบนคลาวด์: รหัสผ่านข้างล่างอยู่ในกิต แปลว่าใคร ๆ ก็รู้ ถ้าเอา
-- ขึ้นโปรเจกต์จริงก็เท่ากับเปิดบัญชีแอดมินที่ทุกคนรู้รหัสไว้บนอินเทอร์เน็ต
-- ตั้งใจให้เป็นแบบนั้นเฉพาะตอนส่งงาน/สาธิต พอตรวจเสร็จควรลบทิ้งด้วย
--   delete from auth.users where email like '%@local.test';
--
-- ทำไมต้องเขียน auth.users เอง: การสร้างผู้ใช้อย่างถูกวิธีต้องยิง Auth API ด้วย
-- service_role key ซึ่งไฟล์ seed ทำไม่ได้ (มันเป็น SQL ที่รันตรงเข้าฐานข้อมูล)
-- ชุดคอลัมน์ข้างล่างจึงลอกมาจาก admin_create_player ใน migration 014 ทั้งดุ้น
-- รวมถึงแถว auth.identities ที่ขาดไม่ได้ และคอลัมน์ token ที่ต้องเป็นสตริงว่าง
-- ไม่ใช่ NULL (GoTrue อ่านมันเข้า Go string แล้วพังถ้าเจอ NULL)

-- ---------------------------------------------------------------------------
-- ตัวช่วยสร้างบัญชี — ลบทิ้งท้ายไฟล์ ไม่หลงเหลือไปอยู่ในฐานข้อมูลจริง
--
-- ถ้าอีเมลนี้มีอยู่แล้วจะคืน id เดิมโดยไม่แตะอะไร (ยกเว้นรหัสผ่านกับชื่อที่ตั้งให้
-- ตรงกับไฟล์นี้) — นี่คือสิ่งที่ทำให้รันซ้ำได้และทำให้สองฝั่งลงเอยเหมือนกัน
-- ---------------------------------------------------------------------------
create or replace function pg_temp.seed_player(
  p_email text,
  p_password text,
  p_display_name text,
  p_nickname text,
  p_phone text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_existing uuid;
begin
  select id into v_existing from auth.users where lower(email) = lower(p_email);

  -- มีอยู่แล้ว: ดันค่าให้ตรงกับไฟล์นี้แล้วจบ ไม่สร้างใหม่
  -- (ตั้งรหัสผ่านทับด้วย เพราะ "ข้อมูลเหมือนกันสองฝั่ง" ต้องรวมถึงรหัสผ่านที่ใช้
  --  ล็อกอินได้จริง ไม่งั้นบัญชีเดียวกันสองฝั่งเข้าได้ไม่เหมือนกัน)
  if v_existing is not null then
    update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('nickname', p_nickname, 'phone', p_phone),
        updated_at = now()
    where id = v_existing;

    update public.profiles
    set display_name = p_display_name, nickname = p_nickname
    where id = v_existing;

    insert into public.user_contacts (id, phone)
    values (v_existing, p_phone)
    on conflict (id) do update set phone = excluded.phone;

    return v_existing;
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('nickname', p_nickname, 'phone', p_phone),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  -- handle_new_user() (migration 004) สร้างแถว profiles + user_contacts ให้แล้ว
  -- จาก raw_user_meta_data ข้างบน เหลือแค่ชื่อที่แสดงผล
  update public.profiles set display_name = p_display_name where id = v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- บัญชีตัวอย่าง
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid;
  v_rookie uuid;
  v_veteran uuid;
  v_conqueror uuid;
  v_banned uuid;
begin
  -- แอดมินของเครื่องนี้ ใช้อีเมลปลอม ไม่ใช่อีเมลแอดมินตัวจริงที่ migration 012
  -- ใส่ไว้ — อีเมลจริงจะได้ไม่มีรหัสผ่านที่เปิดเผยผูกอยู่ด้วย
  insert into public.admin_emails (email)
  values ('admin@local.test')
  on conflict (email) do nothing;

  v_admin := pg_temp.seed_player('admin@local.test', 'admin12345', 'อาจารย์ผู้คุมดันเจี้ยน', 'dungeonmaster', '0800000000');

  v_rookie    := pg_temp.seed_player('rookie@local.test',    'player12345', 'ผู้มาใหม่',   'rookie',    '0800000001');
  v_veteran   := pg_temp.seed_player('veteran@local.test',   'player12345', 'นักผจญภัย',   'veteran',   '0800000002');
  v_conqueror := pg_temp.seed_player('conqueror@local.test', 'player12345', 'ผู้พิชิต',     'conqueror', '0800000003');
  v_banned    := pg_temp.seed_player('banned@local.test',    'player12345', 'ผู้ถูกระงับ',  'banned',    '0800000004');

  -- เซฟของแต่ละคน: กระจายให้อยู่คนละด่าน กระดานอันดับจะได้มีลำดับให้ดูจริง ๆ
  insert into public.game_saves (
    user_id, character_name, character_class, gender, skin_color, shirt_color,
    difficulty, current_level, player_hp, attack_power,
    defeated_monster_ids, collected_pickup_ids, updated_at
  )
  -- รายชื่อมอนสเตอร์ที่ล้มแล้วยึด id จริงจาก levels.ts และไล่ให้สมเหตุสมผลกับ
  -- current_level: คนที่อยู่ด่าน N ต้องล้มบอสของด่าน 1..N-1 มาแล้ว
  -- (dragon-1 → bone-tyrant-1 → hydra-1 → archmage-1 → forbiddentome-1)
  values
    (v_admin,     'Merlin',  'wizard',  'male',   '#e8b98a', null,      'hard', 3, 180, 30,
      '{slime-1,slime-2,wraith-1,wraith-2,wraith-3,goblin-1,goblin-2,goblin-3,dragon-1,'
      'goblin-warrior-1,goblin-warrior-2,orc-1,orc-2,specter-1,specter-2,specter-3,'
      'wraith-elite-1,wraith-elite-2,bone-tyrant-1}',
      '{heal-1,attack-1,heal-2,attack-2,potion-1}', now() - interval '10 minutes'),

    (v_rookie,    'Elora',   'cleric',  'female', '#f0c9a0', '#7c5cff', 'easy', 1, 200, 10,
      '{slime-1,slime-2}', '{heal-1}', now() - interval '2 hours'),

    (v_veteran,   'Kaito',   'warrior', 'male',   '#c98b5e', null,      'hard', 4, 155, 45,
      '{slime-1,slime-2,wraith-1,wraith-2,wraith-3,goblin-1,goblin-2,goblin-3,dragon-1,'
      'goblin-warrior-1,goblin-warrior-2,orc-1,orc-2,specter-1,specter-2,specter-3,'
      'wraith-elite-1,wraith-elite-2,bone-tyrant-1,'
      'imp-1,imp-2,raider-1,raider-2,raider-3,banshee-1,banshee-2,banshee-3,hydra-1}',
      '{heal-1,attack-1,heal-2,attack-2,potion-1,heal-3,attack-3,heal-4,attack-4,potion-2}',
      now() - interval '1 day'),

    (v_conqueror, 'Seraphi', 'rogue',   'female', '#8a5a3c', '#f0c85a', 'hard', 6, 95,  60,
      '{slime-1,slime-2,wraith-1,wraith-2,wraith-3,goblin-1,goblin-2,goblin-3,dragon-1,'
      'goblin-warrior-1,goblin-warrior-2,orc-1,orc-2,specter-1,specter-2,specter-3,'
      'wraith-elite-1,wraith-elite-2,bone-tyrant-1,'
      'imp-1,imp-2,raider-1,raider-2,raider-3,banshee-1,banshee-2,banshee-3,hydra-1,'
      'wisp-1,wisp-2,hexsprite-1,hexsprite-2,hexsprite-3,spellknight-1,spellknight-2,'
      'cultist-1,cultist-2,archmage-1,'
      'bookgolem-1,bookgolem-2,ghostlib-1,ghostlib-2,ghostlib-3,'
      'archivist-1,archivist-2,archivist-3,tome-1}',
      '{heal-1,attack-1,heal-2,attack-2,potion-1,heal-3,attack-3,heal-4,attack-4,potion-2,'
      'heal-5,attack-5,heal-6,attack-6,potion-3,heal-7,attack-7,heal-8,attack-8,potion-4,'
      'heal-9,attack-9,heal-10,attack-10,potion-5}',
      now() - interval '3 days'),

    (v_banned,    'Grimm',   'wizard',  'male',   '#e8b98a', '#b8262c', 'easy', 2, 200, 15,
      '{slime-1,slime-2,wraith-1,wraith-2,wraith-3,goblin-1,goblin-2,goblin-3,dragon-1}',
      '{heal-1,attack-1}', now() - interval '5 days')
  -- รันซ้ำแล้วดันค่าให้ตรงกับไฟล์นี้ ไม่ใช่ระเบิดที่ primary key
  -- ซึ่งแปลว่า "รันไฟล์นี้ทั้งสองฝั่ง" = "ข้อมูลตัวอย่างสองฝั่งเหมือนกัน" เสมอ
  on conflict (user_id) do update set
    character_name = excluded.character_name,
    character_class = excluded.character_class,
    gender = excluded.gender,
    skin_color = excluded.skin_color,
    shirt_color = excluded.shirt_color,
    difficulty = excluded.difficulty,
    current_level = excluded.current_level,
    player_hp = excluded.player_hp,
    attack_power = excluded.attack_power,
    defeated_monster_ids = excluded.defeated_monster_ids,
    collected_pickup_ids = excluded.collected_pickup_ids,
    updated_at = excluded.updated_at;

  -- ผู้พิชิต: มีแถวใน scores ถึงจะขึ้นหัวตารางในฐานะคนที่จบเกมแล้ว
  -- (ดูลำดับการเรียงใน get_progress_leaderboard — migration 007)
  --
  -- scores ไม่มีคีย์ธรรมชาติ (id เป็น uuid สุ่ม) เลยใช้ on conflict ไม่ได้ —
  -- ลบของเดิมของบัญชีตัวอย่างคนนี้ทิ้งก่อนแล้วใส่ใหม่ ถึงจะรันซ้ำได้โดยไม่สะสม
  -- แถวซ้ำ แตะเฉพาะ v_conqueror ซึ่งเป็นบัญชีที่ไฟล์นี้สร้างเอง ไม่โดนคนอื่น
  delete from public.scores where user_id = v_conqueror;

  insert into public.scores (user_id, monsters_defeated, completed_at)
  values (v_conqueror, 58, now() - interval '3 days');

  -- บัญชีที่ถูกระงับไว้ให้ลองหน้าจอ "บัญชีถูกระงับ" และพิสูจน์ว่า RLS กันเขียนจริง
  -- (migration 014): ล็อกอินด้วย banned@local.test ได้ แต่เซฟอะไรไม่ได้เลย
  update public.profiles
  set suspended_at = now() - interval '1 day',
      suspended_reason = 'ตัวอย่างบัญชีที่ถูกระงับ — สร้างจาก supabase/seed.sql'
  where id = v_banned;
end;
$$;

drop function pg_temp.seed_player(text, text, text, text, text);
