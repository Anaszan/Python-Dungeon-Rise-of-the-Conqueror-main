import type { ExamCheck, LessonData } from './lessons'
import { pickVariant } from './lessons'
import type { Difficulty } from './difficulty'

// The hard-mode content: one โจทย์ ("trial") per code box per monster.
//
// Easy mode hands the player a finished spell with a single `___` in it. A
// trial hands them an empty editor, a written brief, and `checks` — the same
// source-scanning idea the end-of-level exam uses (see ExamCheck in
// lessons.ts), except here the checks are enforced *before* the code is
// allowed to run, so a spell that does not use the chapter's syntax never
// fires at all. That is the whole difficulty: the monster states a problem and
// the player writes the solution, instead of filling one blank in someone
// else's solution.
//
// Trials are keyed by chapter (2..7), not by level number, because that is
// what LessonData carries around — see trialsForLesson().
export type TrialSpec = {
  // Stable, unique within its chapter+kind. Only used as a React key and to
  // make a failing test say which trial is broken.
  id: string
  title: string
  // What the monster demands, one requirement per line. Also becomes the
  // comment header the editor starts with (see trialStarterCode).
  brief: string[]
  // Every one of these must match the player's (comment-stripped) source
  // before the spell can be cast. Never global — see ExamCheck.
  checks: ExamCheck[]
  hints: string[]
}

export type TrialSet = {
  attack: TrialSpec[]
  skill: TrialSpec[]
}

// Regexes shared by several trials. Kept here rather than repeated so a fix to
// "what counts as declaring a variable" lands everywhere at once.
const HAS_VARIABLE = /^[ \t]*[A-Za-z_]\w*\s*=[^=]/m
const HAS_ADDITION = /=[^=\n]*\+/
const HAS_MULTIPLY = /=[^=\n]*\*/
const USES_ATK = /\batk\b/
const USES_HP = /\bhp\b/
const USES_MONSTER_HP = /\bmonster_hp\b/
const USES_MONSTER_ARMOR = /\bmonster_armor\b/
const USES_MONSTER_NAME = /\bmonster_name\b/
const CALLS_PRINT = /\bprint\s*\(/
const CALLS_ATTACK = /\battack\s*\(/
const CALLS_SKILL = /\bskill\s*\(/
const HAS_IF = /^[ \t]*if\s+.+:/m
const HAS_ELSE = /^[ \t]*(elif\s+.+:|else\s*:)/m
const HAS_FOR_RANGE = /^[ \t]*for\s+\w+\s+in\s+range\s*\(/m
const HAS_WHILE = /^[ \t]*while\s+.+:/m
const HAS_DEF = /^[ \t]*def\s+\w+\s*\(.*\)\s*:/m
const HAS_RETURN = /^[ \t]+return\b/m
const HAS_TRY = /^[ \t]*try\s*:/m
const HAS_EXCEPT = /^[ \t]*except\b/m
const OPENS_FILE = /\bwith\s+open\s*\(/
const WRITES_FILE = /\.write\s*\(/
const READS_FILE = /\.read\s*\(/

// attack(...) / skill(...) written on an indented line, i.e. inside a loop,
// an if-branch or a function body rather than at the top level.
const CALLS_ATTACK_INDENTED = /^[ \t]+attack\s*\(/m
const CALLS_SKILL_INDENTED = /^[ \t]+skill\s*\(/m

// Passing a function call straight into the spell — attack(fireball(atk)).
const CALLS_ATTACK_WITH_CALL = /\battack\s*\(\s*\w+\s*\(/
const CALLS_SKILL_WITH_CALL = /\bskill\s*\(\s*\w+\s*\(/

const TRIALS_BY_CHAPTER: Record<number, TrialSet> = {
  // บทที่ 2 — ตัวแปรและชนิดข้อมูล
  2: {
    attack: [
      {
        id: 'ch2-atk-report',
        title: 'รายงานพลังก่อนลงมือ',
        brief: [
          'สร้างตัวแปรของเจ้าเอง (เช่น damage) เก็บพลังที่คำนวณจาก atk',
          'รายงานพลังนั้นออกมาด้วย print() ก่อนร่าย',
          'ส่งตัวแปรนั้นเข้า attack(...) เพื่อโจมตี',
        ],
        checks: [
          { label: 'สร้างตัวแปรของเจ้าเอง (ชื่อ = ค่า)', pattern: HAS_VARIABLE },
          { label: 'คำนวณจากค่า atk', pattern: USES_ATK },
          { label: 'รายงานด้วย print()', pattern: CALLS_PRINT },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'damage = atk แล้ว print(damage) แล้ว attack(damage) — สามบรรทัดก็ครบโจทย์แล้ว',
          'attack() แรงได้สูงสุดเท่ากับ atk ต่อหนึ่งครั้ง ใส่มากกว่านั้นก็จะถูกตัดลงมาเท่า atk',
        ],
      },
      {
        id: 'ch2-atk-combine',
        title: 'รวมพลังจากสองแหล่ง',
        brief: [
          'สร้างตัวแปรอย่างน้อยสองตัว เช่น base (จาก atk) และ bonus (ตัวเลขของเจ้าเอง)',
          'รวมค่าทั้งสองด้วยเครื่องหมาย + เก็บไว้ในตัวแปรใหม่',
          'ส่งผลรวมนั้นเข้า attack(...)',
        ],
        checks: [
          { label: 'สร้างตัวแปรของเจ้าเอง (ชื่อ = ค่า)', pattern: HAS_VARIABLE },
          { label: 'ใช้ค่า atk', pattern: USES_ATK },
          { label: 'มีการบวกค่า (... = ... + ...)', pattern: HAS_ADDITION },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'base = atk / bonus = 5 / damage = base + bonus / attack(damage)',
          'ตัวแปรตั้งชื่อเป็นภาษาอังกฤษ ห้ามขึ้นต้นด้วยตัวเลข และห้ามมีเว้นวรรค',
        ],
      },
    ],
    skill: [
      {
        id: 'ch2-skill-multiply',
        title: 'สกิลต้องแรงกว่าคาถาปกติ',
        brief: [
          'สร้างตัวแปร power ที่ได้จากการ "คูณ" ค่า atk (ใช้เครื่องหมาย *)',
          'รายงานพลังของสกิลด้วย print()',
          'ส่ง power เข้า skill(...)',
        ],
        checks: [
          { label: 'สร้างตัวแปรของเจ้าเอง (ชื่อ = ค่า)', pattern: HAS_VARIABLE },
          { label: 'มีการคูณค่า (... = ... * ...)', pattern: HAS_MULTIPLY },
          { label: 'ใช้ค่า atk', pattern: USES_ATK },
          { label: 'รายงานด้วย print()', pattern: CALLS_PRINT },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'power = atk * 3 คือเพดานของสกิล ใส่มากกว่านี้ก็ถูกตัดลงมาเท่าเดิม',
          'print(power) วางไว้ก่อน skill(power) จะได้เห็นตัวเลขก่อนคาถาออก',
        ],
      },
      {
        id: 'ch2-skill-name',
        title: 'เอ่ยชื่อศัตรูก่อนสาป',
        brief: [
          'ในสนามรบมีตัวแปร monster_name เก็บชื่อของศัตรูตัวนี้ไว้ให้แล้ว',
          'ใช้ print() ประกาศชื่อศัตรูออกมา (เช่น print("สาปใส่", monster_name))',
          'คำนวณพลังจาก atk เก็บใส่ตัวแปร แล้วส่งเข้า skill(...)',
        ],
        checks: [
          { label: 'ใช้ตัวแปร monster_name', pattern: USES_MONSTER_NAME },
          { label: 'ประกาศด้วย print()', pattern: CALLS_PRINT },
          { label: 'สร้างตัวแปรของเจ้าเอง (ชื่อ = ค่า)', pattern: HAS_VARIABLE },
          { label: 'ใช้ค่า atk', pattern: USES_ATK },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'print(f"สาปใส่ {monster_name}") หรือ print("สาปใส่", monster_name) ก็ได้ทั้งคู่',
          'monster_name เป็นข้อความ (str) เอาไปบวกกับตัวเลขตรง ๆ ไม่ได้ จะเจอ TypeError',
        ],
      },
    ],
  },

  // บทที่ 3 — คำสั่งเงื่อนไข
  3: {
    attack: [
      {
        id: 'ch3-atk-readhp',
        title: 'อ่านเลือดศัตรูก่อนลงมือ',
        brief: [
          'ใช้ if ตรวจค่า monster_hp ของศัตรูตัวนี้',
          'ถ้าเลือดยังเยอะ ให้ทุ่มพลังเต็มที่ ถ้าเหลือน้อยให้ออมแรง — ต้องมี else หรือ elif รองรับ',
          'ร่าย attack(...) ด้วยพลังที่เลือกไว้',
        ],
        checks: [
          { label: 'มีเงื่อนไข if ... :', pattern: HAS_IF },
          { label: 'ตรวจค่า monster_hp', pattern: USES_MONSTER_HP },
          { label: 'มีทางเลือกสำรอง else / elif', pattern: HAS_ELSE },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'if monster_hp > 50: แล้วเยื้อง 4 ช่องตั้ง damage = atk / บรรทัด else: ตั้งค่าอีกแบบ',
          'อย่าลืมเครื่องหมาย : ท้ายบรรทัด if และ else ทุกครั้ง',
        ],
      },
      {
        id: 'ch3-atk-selfcheck',
        title: 'ดูเลือดตัวเองด้วย',
        brief: [
          'เงื่อนไขต้องดูทั้งเลือดของเจ้า (hp) และสถานะของศัตรู โดยเชื่อมด้วย and หรือ or',
          'ต้องมี else หรือ elif เป็นทางเลือกสำรองเสมอ',
          'ร่าย attack(...) ให้ครบทุกเส้นทางของเงื่อนไข',
        ],
        checks: [
          { label: 'มีเงื่อนไข if ... :', pattern: HAS_IF },
          { label: 'ใช้ค่า hp ของเจ้าเอง', pattern: USES_HP },
          { label: 'เชื่อมเงื่อนไขด้วย and / or', pattern: /\b(and|or)\b/ },
          { label: 'มีทางเลือกสำรอง else / elif', pattern: HAS_ELSE },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'if hp > 50 and monster_hp > 30: — เชื่อมสองเงื่อนไขด้วย and ได้เลย',
          'hp คือเลือดของเจ้า ส่วน monster_hp คือเลือดศัตรู คนละตัวแปรกัน',
        ],
      },
    ],
    skill: [
      {
        id: 'ch3-skill-finisher',
        title: 'เลือกจังหวะปิดฉาก',
        brief: [
          'ใช้ if ตรวจ monster_hp: ถ้าเหลือน้อยให้ปิดฉากด้วยพลังเต็ม',
          'ถ้ายังไม่ใช่จังหวะนั้น ให้ใช้พลังน้อยลงในบล็อก else / elif',
          'ร่าย skill(...) โดยใช้ค่าที่เงื่อนไขเลือกไว้',
        ],
        checks: [
          { label: 'มีเงื่อนไข if ... :', pattern: HAS_IF },
          { label: 'ตรวจค่า monster_hp', pattern: USES_MONSTER_HP },
          { label: 'มีทางเลือกสำรอง else / elif', pattern: HAS_ELSE },
          { label: 'ใช้ค่า atk คำนวณพลัง', pattern: USES_ATK },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'if monster_hp <= atk * 3: power = atk * 3 / else: power = atk * 2',
          'skill() แรงได้สูงสุด 3 เท่าของ atk ต่อหนึ่งครั้ง',
        ],
      },
      {
        id: 'ch3-skill-armor',
        title: 'เกราะหนาต้องเจาะ',
        brief: [
          'ตรวจเกราะของศัตรูด้วย monster_armor ในเงื่อนไข if',
          'เกราะยิ่งหนา ยิ่งต้องอัดพลังมาก — เกราะบางก็ออมไว้ (ต้องมี else / elif)',
          'ร่าย skill(...) ด้วยพลังที่เลือก',
        ],
        checks: [
          { label: 'มีเงื่อนไข if ... :', pattern: HAS_IF },
          { label: 'ตรวจค่า monster_armor', pattern: USES_MONSTER_ARMOR },
          { label: 'มีทางเลือกสำรอง else / elif', pattern: HAS_ELSE },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'if monster_armor > 10: power = atk * 3 / else: power = atk * 2',
          'monster_armor ของมอนสเตอร์ส่วนใหญ่เป็นเลขมาก ๆ (999) ยกเว้นด่าน 6 ที่ถูกสาปให้เป็น 0',
        ],
      },
    ],
  },

  // บทที่ 4 — การวนซ้ำ
  4: {
    attack: [
      {
        id: 'ch4-atk-combo',
        title: 'คอมโบตามจำนวนรอบ',
        brief: [
          'ใช้ for ... in range(...) เพื่อโจมตีซ้ำหลายครั้งในคาถาเดียว',
          'ต้องเรียก attack(...) อยู่ "ข้างใน" ลูป (บรรทัดเยื้อง)',
          'พิมพ์รายงานรอบที่โจมตีด้วย print() ในลูปด้วย',
        ],
        checks: [
          { label: 'มีลูป for ... in range(...):', pattern: HAS_FOR_RANGE },
          { label: 'เรียก attack(...) ข้างในลูป (บรรทัดเยื้อง)', pattern: CALLS_ATTACK_INDENTED },
          { label: 'รายงานด้วย print()', pattern: CALLS_PRINT },
        ],
        hints: [
          'for i in range(4): แล้วบรรทัดถัดไปเยื้อง 4 ช่อง — print(i) และ attack(atk)',
          'ดาเมจของทุกรอบจะสะสมรวมกัน ยิ่งวนมากยิ่งเจ็บ แต่เกิน 200 ครั้งข้าจะตัดคาถาทิ้ง',
        ],
      },
      {
        id: 'ch4-atk-drain',
        title: 'ตีจนพลังสำรองหมด',
        brief: [
          'สร้างตัวแปรเก็บ "พลังสำรอง" ไว้ก่อน แล้วใช้ลูป while วนจนกว่าจะหมด',
          'ทุกรอบต้องลดค่าตัวแปรนั้นลง ไม่งั้นลูปจะวนไม่รู้จบ',
          'เรียก attack(...) อยู่ข้างในลูป',
        ],
        checks: [
          { label: 'มีลูป while ... :', pattern: HAS_WHILE },
          { label: 'อัปเดตตัวแปรข้างในลูป (บรรทัดเยื้อง)', pattern: /^[ \t]+\w+\s*(-=|=[^=])/m },
          { label: 'เรียก attack(...) ข้างในลูป (บรรทัดเยื้อง)', pattern: CALLS_ATTACK_INDENTED },
          { label: 'ใช้ค่า atk', pattern: USES_ATK },
        ],
        hints: [
          'remaining = atk * 3 / while remaining > 0: / (เยื้อง) attack(atk) / (เยื้อง) remaining = remaining - atk',
          'ถ้าลืมลดค่า remaining ลูปจะวนไม่จบ — ข้าตัดคาถาให้ที่ 200 ครั้ง แต่คาถาก็จะพังไปด้วย',
        ],
      },
    ],
    skill: [
      {
        id: 'ch4-skill-split',
        title: 'แบ่งพลังเป็นก้อนเท่า ๆ กัน',
        brief: [
          'ใช้ลูป (for หรือ while) ยิงสกิลหลายครั้งในคาถาเดียว',
          'แบ่งพลังแต่ละก้อนด้วยการหารเอาจำนวนเต็ม // เพื่อไม่ให้เหลือเศษ',
          'เรียก skill(...) อยู่ข้างในลูป',
        ],
        checks: [
          { label: 'มีลูป for ... : หรือ while ... :', pattern: /^[ \t]*(for\s+\w+\s+in\s+.+:|while\s+.+:)/m },
          { label: 'ใช้การหารเอาจำนวนเต็ม //', pattern: /\/\// },
          { label: 'เรียก skill(...) ข้างในลูป (บรรทัดเยื้อง)', pattern: CALLS_SKILL_INDENTED },
        ],
        hints: [
          'for i in range(3): แล้วเยื้อง skill(atk * 3 // 3)',
          '// คือหารปัดลงเป็นจำนวนเต็ม ส่วน / จะได้ทศนิยม — คาถารับได้ทั้งคู่ แต่โจทย์นี้ขอ //',
        ],
      },
      {
        id: 'ch4-skill-countfromhp',
        title: 'นับรอบจากเลือดศัตรู',
        brief: [
          'คำนวณจำนวนรอบที่ต้องยิงจากค่า monster_hp (เลือดที่ศัตรูเหลืออยู่)',
          'ใช้จำนวนรอบนั้นกับ for ... in range(...)',
          'เรียก skill(...) อยู่ข้างในลูป',
        ],
        checks: [
          { label: 'มีลูป for ... in range(...):', pattern: HAS_FOR_RANGE },
          { label: 'ใช้ค่า monster_hp คำนวณจำนวนรอบ', pattern: USES_MONSTER_HP },
          { label: 'เรียก skill(...) ข้างในลูป (บรรทัดเยื้อง)', pattern: CALLS_SKILL_INDENTED },
        ],
        hints: [
          'rounds = monster_hp // (atk * 3) + 1 แล้ว for i in range(rounds):',
          'range() รับได้เฉพาะจำนวนเต็ม — ใช้ // แทน / เพื่อไม่ให้กลายเป็นทศนิยม',
        ],
      },
    ],
  },

  // บทที่ 5 — ฟังก์ชัน
  5: {
    attack: [
      {
        id: 'ch5-atk-named',
        title: 'คาถาที่ตั้งชื่อเอง',
        brief: [
          'ประกาศฟังก์ชันของเจ้าเองด้วย def ชื่อ(พารามิเตอร์):',
          'ให้ฟังก์ชันคำนวณพลังแล้วส่งกลับด้วย return',
          'เรียกใช้แบบส่งผลลัพธ์เข้าคาถาตรง ๆ เช่น attack(ชื่อฟังก์ชัน(atk))',
        ],
        checks: [
          { label: 'ประกาศฟังก์ชันด้วย def ชื่อ(...):', pattern: HAS_DEF },
          { label: 'ส่งค่ากลับด้วย return', pattern: HAS_RETURN },
          { label: 'ส่งผลลัพธ์ฟังก์ชันเข้า attack(...)', pattern: CALLS_ATTACK_WITH_CALL },
          { label: 'ใช้ค่า atk', pattern: USES_ATK },
        ],
        hints: [
          'def fireball(power): แล้วเยื้อง return power * 2 จากนั้น attack(fireball(atk))',
          'อย่าลืมว่าบรรทัดใน def ต้องเยื้อง 4 ช่อง ไม่งั้นจะเจอ IndentationError',
        ],
      },
      {
        id: 'ch5-atk-default',
        title: 'คาถาที่มีค่าเริ่มต้น',
        brief: [
          'ประกาศฟังก์ชันที่มีพารามิเตอร์แบบมีค่าเริ่มต้น (default argument) เช่น def blast(power, bonus=5):',
          'ให้ฟังก์ชัน return พลังที่รวมโบนัสแล้ว',
          'เรียก attack(...) โดยส่งผลลัพธ์ของฟังก์ชันเข้าไป',
        ],
        checks: [
          { label: 'ฟังก์ชันมีค่าเริ่มต้น เช่น def f(a, b=5):', pattern: /^[ \t]*def\s+\w+\s*\([^)]*=[^)]*\)\s*:/m },
          { label: 'ส่งค่ากลับด้วย return', pattern: HAS_RETURN },
          { label: 'ส่งผลลัพธ์ฟังก์ชันเข้า attack(...)', pattern: CALLS_ATTACK_WITH_CALL },
        ],
        hints: [
          'def blast(power, bonus=5): / (เยื้อง) return power + bonus / attack(blast(atk))',
          'พารามิเตอร์ที่มีค่าเริ่มต้นต้องอยู่ท้ายสุดของวงเล็บเสมอ',
        ],
      },
    ],
    skill: [
      {
        id: 'ch5-skill-reads-monster',
        title: 'ฟังก์ชันที่อ่านสถานะศัตรู',
        brief: [
          'ประกาศฟังก์ชันที่รับค่าเลือดศัตรูเป็นพารามิเตอร์',
          'ให้ฟังก์ชันคำนวณพลังสกิลจากค่านั้นแล้ว return ออกมา',
          'เรียก skill(...) โดยส่ง monster_hp ผ่านฟังก์ชันเข้าไป',
        ],
        checks: [
          { label: 'ประกาศฟังก์ชันด้วย def ชื่อ(...):', pattern: HAS_DEF },
          { label: 'ส่งค่ากลับด้วย return', pattern: HAS_RETURN },
          { label: 'ใช้ค่า monster_hp', pattern: USES_MONSTER_HP },
          { label: 'ส่งผลลัพธ์ฟังก์ชันเข้า skill(...)', pattern: CALLS_SKILL_WITH_CALL },
        ],
        hints: [
          'def judge(enemy_hp): / (เยื้อง) return enemy_hp / จากนั้น skill(judge(monster_hp))',
          'ค่าที่เกินเพดาน (atk * 3) จะถูกตัดลงมาให้เอง ไม่ต้องกลัวใส่เกิน',
        ],
      },
      {
        id: 'ch5-skill-two-functions',
        title: 'คาถาซ้อนคาถา',
        brief: [
          'ประกาศฟังก์ชัน "อย่างน้อยสองตัว" — ตัวหนึ่งคำนวณพลังฐาน อีกตัวขยายพลังนั้นต่อ',
          'ทั้งสองต้องส่งค่ากลับด้วย return',
          'ให้ฟังก์ชันตัวที่สองเรียกใช้ตัวแรก แล้วส่งผลลัพธ์เข้า skill(...)',
        ],
        checks: [
          { label: 'ประกาศฟังก์ชันอย่างน้อย 2 ตัว', pattern: /\bdef\b[\s\S]*\bdef\b/ },
          { label: 'ส่งค่ากลับด้วย return', pattern: HAS_RETURN },
          { label: 'ส่งผลลัพธ์ฟังก์ชันเข้า skill(...)', pattern: CALLS_SKILL_WITH_CALL },
          { label: 'ใช้ค่า atk', pattern: USES_ATK },
        ],
        hints: [
          'def base(p): return p * 2 แล้ว def big(p): return base(p) + 10 จากนั้น skill(big(atk))',
          'ฟังก์ชันเรียกฟังก์ชันได้ ขอแค่ตัวที่ถูกเรียกถูกประกาศไว้ก่อนตอนที่รันจริง',
        ],
      },
    ],
  },

  // บทที่ 6 — การจัดการไฟล์
  6: {
    attack: [
      {
        id: 'ch6-atk-roundtrip',
        title: 'จารึกแล้วอ่านกลับ',
        brief: [
          'จารึกค่าพลังโจมตีลงไฟล์ด้วย with open("ชื่อไฟล์", "w") as f: แล้ว f.write(...)',
          'เปิดไฟล์เดิมด้วยโหมด "r" อ่านกลับมาด้วย f.read() แล้วแปลงเป็นตัวเลขด้วย int(...)',
          'ใช้ค่าที่อ่านกลับมานั้นร่าย attack(...)',
        ],
        checks: [
          { label: 'เปิดไฟล์ด้วย with open(...) as f:', pattern: OPENS_FILE },
          { label: 'จารึกด้วย .write(...)', pattern: WRITES_FILE },
          { label: 'อ่านกลับด้วย .read()', pattern: READS_FILE },
          { label: 'แปลงกลับเป็นตัวเลขด้วย int(...)', pattern: /\bint\s*\(/ },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'f.write() รับได้เฉพาะข้อความ ต้อง str(atk) ก่อนเสมอ',
          'ตอนอ่านกลับมาเป็นข้อความ ต้อง int(f.read()) ไม่งั้นเอาไปคำนวณจะเจอ TypeError',
        ],
      },
      {
        id: 'ch6-atk-append',
        title: 'ตำราที่เขียนต่อท้ายได้',
        brief: [
          'จารึกค่าแรกลงไฟล์ด้วยโหมด "w" โดยคั่นด้วยเครื่องหมาย ,',
          'เปิดไฟล์เดิมด้วยโหมดต่อท้าย "a" แล้วจารึกค่าที่สองต่อไป',
          'อ่านทั้งหมดกลับมาด้วย f.read() แยกด้วย .split(",") รวมค่า แล้วร่าย attack(...)',
        ],
        checks: [
          { label: 'เปิดไฟล์ด้วย with open(...) as f:', pattern: OPENS_FILE },
          { label: 'ใช้โหมดต่อท้าย "a"', pattern: /open\s*\([^)]*["']a["']/ },
          { label: 'อ่านกลับด้วย .read()', pattern: READS_FILE },
          { label: 'แยกข้อความด้วย .split(...)', pattern: /\.split\s*\(/ },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'parts = f.read().split(",") จะได้ลิสต์ของข้อความ ใช้ int(parts[0]) + int(parts[1])',
          'โหมด "w" จะล้างไฟล์เก่าทิ้งทุกครั้ง ส่วน "a" ต่อท้ายของเดิม',
        ],
      },
    ],
    skill: [
      {
        id: 'ch6-skill-grimoire',
        title: 'ตำราสกิลของเจ้าเอง',
        brief: [
          'จารึกพลังสกิลลงไฟล์ (คำนวณจาก atk ก่อนแล้วค่อยเขียนก็ได้)',
          'อ่านกลับมาแล้วนำไปคูณเพิ่มด้วยเครื่องหมาย *',
          'ร่าย skill(...) ด้วยค่าที่ได้',
        ],
        checks: [
          { label: 'เปิดไฟล์ด้วย with open(...) as f:', pattern: OPENS_FILE },
          { label: 'จารึกด้วย .write(...)', pattern: WRITES_FILE },
          { label: 'อ่านกลับด้วย .read()', pattern: READS_FILE },
          { label: 'มีการคูณค่า (... = ... * ...)', pattern: HAS_MULTIPLY },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'with open("grimoire.txt", "w") as f: f.write(str(atk)) แล้วเปิดใหม่โหมด "r" อ่านกลับ',
          'power = int(f.read()) * 3 แล้วค่อย skill(power)',
        ],
      },
      {
        id: 'ch6-skill-log',
        title: 'บันทึกชื่อเหยื่อลงตำรา',
        brief: [
          'จารึกชื่อศัตรู (monster_name) ลงไฟล์ด้วย f.write(...)',
          'อ่านกลับมาด้วย f.read() แล้วรายงานด้วย print()',
          'คำนวณพลังจาก atk แล้วร่าย skill(...)',
        ],
        checks: [
          { label: 'เปิดไฟล์ด้วย with open(...) as f:', pattern: OPENS_FILE },
          { label: 'ใช้ตัวแปร monster_name', pattern: USES_MONSTER_NAME },
          { label: 'จารึกด้วย .write(...)', pattern: WRITES_FILE },
          { label: 'อ่านกลับด้วย .read()', pattern: READS_FILE },
          { label: 'รายงานด้วย print()', pattern: CALLS_PRINT },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'monster_name เป็นข้อความอยู่แล้ว เขียนลงไฟล์ได้ตรง ๆ ไม่ต้อง str()',
          'อ่านกลับมาแล้ว print(f.read()) จะเห็นชื่อที่จารึกไว้ในบันทึกคาถา',
        ],
      },
    ],
  },

  // บทที่ 7 — การจัดการข้อผิดพลาด
  7: {
    attack: [
      {
        id: 'ch7-atk-zerodiv',
        title: 'กับดักหารด้วยศูนย์',
        brief: [
          'คำนวณพลังเจาะเกราะโดย "หาร" ด้วย monster_armor (ซึ่งที่นี่ถูกสาปให้เป็น 0)',
          'ครอบด้วย try: แล้วดักด้วย except ZeroDivisionError: ให้ตรงชนิด',
          'ไม่ว่าจะพลาดหรือไม่ ก็ต้องร่าย attack(...) ออกไปได้',
        ],
        checks: [
          { label: 'เริ่มด้วย try:', pattern: HAS_TRY },
          { label: 'ดักด้วย except ZeroDivisionError:', pattern: /except\s+ZeroDivisionError\s*:/ },
          { label: 'ใช้ค่า monster_armor', pattern: USES_MONSTER_ARMOR },
          { label: 'มีการหาร (/ หรือ //)', pattern: /\// },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'try: / (เยื้อง) damage = atk // monster_armor / except ZeroDivisionError: / (เยื้อง) damage = atk',
          'ตั้งค่าตัวแปรพลังให้ครบทุกเส้นทาง ไม่งั้นจะเจอ NameError ตอนเรียก attack()',
        ],
      },
      {
        id: 'ch7-atk-finally',
        title: 'โล่ที่ทำงานเสมอ',
        brief: [
          'ใช้ค่า monster_armor คำนวณพลังในบล็อก try:',
          'ดักความผิดพลาดด้วย except แล้วปิดท้ายด้วย finally: ที่ทำงานทุกกรณี',
          'รายงานด้วย print() ในบล็อก finally แล้วร่าย attack(...)',
        ],
        checks: [
          { label: 'เริ่มด้วย try:', pattern: HAS_TRY },
          { label: 'ดักข้อผิดพลาดด้วย except', pattern: HAS_EXCEPT },
          { label: 'ปิดท้ายด้วย finally:', pattern: /^[ \t]*finally\s*:/m },
          { label: 'ใช้ค่า monster_armor', pattern: USES_MONSTER_ARMOR },
          { label: 'รายงานด้วย print()', pattern: CALLS_PRINT },
          { label: 'ร่ายด้วย attack(...)', pattern: CALLS_ATTACK },
        ],
        hints: [
          'ลำดับคือ try: → except ...: → finally: เรียงต่อกันโดยไม่มีบรรทัดอื่นคั่นระดับ',
          'finally ทำงานเสมอ ไม่ว่าคาถาจะพลาดหรือไม่ — เหมาะกับการรายงานผล',
        ],
      },
    ],
    skill: [
      {
        id: 'ch7-skill-shield',
        title: 'โล่กันคำสาปสะท้อน',
        brief: [
          'ในบล็อก try: ให้คำนวณพลังสกิลโดยหารด้วย monster_armor',
          'ถ้าเจอคำสาป (except) ให้เปลี่ยนไปใช้พลังสำรองที่คำนวณจาก atk แทน',
          'ต้องร่าย skill(...) ผ่านโดยไม่มี error หลุดออกมา',
        ],
        checks: [
          { label: 'เริ่มด้วย try:', pattern: HAS_TRY },
          { label: 'ดักข้อผิดพลาดด้วย except', pattern: HAS_EXCEPT },
          { label: 'ใช้ค่า monster_armor', pattern: USES_MONSTER_ARMOR },
          { label: 'ใช้ค่า atk เป็นพลังสำรอง', pattern: USES_ATK },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'except ZeroDivisionError: แล้วในนั้น power = atk * 3',
          'except เปล่า ๆ ก็ดักได้ทุกชนิด แต่ระบุชนิดให้ตรงจะอ่านง่ายกว่าและปลอดภัยกว่า',
        ],
      },
      {
        id: 'ch7-skill-report',
        title: 'แจ้งเตือนเมื่อคาถาสะดุด',
        brief: [
          'ในบล็อก try: ลองคำนวณพลังจาก monster_armor',
          'ในบล็อก except ต้องมี print() แจ้งเตือนว่าเจอคำสาปอะไร (บรรทัดเยื้อง)',
          'จากนั้นร่าย skill(...) ด้วยพลังสำรองให้สำเร็จ',
        ],
        checks: [
          { label: 'เริ่มด้วย try:', pattern: HAS_TRY },
          { label: 'ดักข้อผิดพลาดด้วย except', pattern: HAS_EXCEPT },
          { label: 'มี print() ในบล็อก (บรรทัดเยื้อง)', pattern: /^[ \t]+print\s*\(/m },
          { label: 'ใช้ค่า monster_armor', pattern: USES_MONSTER_ARMOR },
          { label: 'ร่ายด้วย skill(...)', pattern: CALLS_SKILL },
        ],
        hints: [
          'except ZeroDivisionError: / (เยื้อง) print("เกราะถูกสาปเป็นศูนย์!") / (เยื้อง) power = atk * 3',
          'ข้อความใน print() จะไปโผล่ในบันทึกคาถาใต้กล่องโค้ดหลังร่ายเสร็จ',
        ],
      },
    ],
  },
}

export function trialsForLesson(lesson: LessonData): TrialSet | undefined {
  return TRIALS_BY_CHAPTER[lesson.chapter]
}

// Every chapter's trials, in chapter order — for tests and for anything that
// wants to audit the whole hard-mode content set.
export const ALL_TRIAL_SETS: { chapter: number; trials: TrialSet }[] = Object.entries(TRIALS_BY_CHAPTER)
  .map(([chapter, trials]) => ({ chapter: Number(chapter), trials }))
  .sort((a, b) => a.chapter - b.chapter)

// The editor in hard mode starts with the โจทย์ written out as comments and
// nothing else — no code to lean on, which is the entire point. The brief is
// also rendered above the box (TrialBrief), so this is a convenience for
// players who prefer to read the requirements next to what they type.
export function trialStarterCode(trial: TrialSpec): string {
  return [
    `# โจทย์จากมอนสเตอร์: ${trial.title}`,
    ...trial.brief.map((line, i) => `# ${i + 1}. ${line}`),
    '# --- เขียนคาถาของเจ้าเองใต้บรรทัดนี้ ---',
    '',
    '',
  ].join('\n')
}

// Checks read the player's source, and the starter code hands them a comment
// block containing the words "print()", "attack(...)" and so on. Without this
// the trial would mark itself complete before a single line was written, so
// every check is tested against the source with comments removed.
//
// A `#` inside a string literal is stripped too, which can only ever make a
// check harder to satisfy (all checks are positive matches), never easier.
export function stripComments(code: string): string {
  return code.replace(/#.*$/gm, '')
}

export function missingCheck(trial: TrialSpec, code: string): ExamCheck | undefined {
  const source = stripComments(code)
  return trial.checks.find((c) => !c.pattern.test(source))
}

// What one code box should start out holding, for either difficulty. `trial`
// is null in easy mode, which is what tells the UI to render a plain
// fill-in-the-blank box with no brief and no pre-cast gate.
export type SpellTask = {
  code: string
  trial: TrialSpec | null
}

export function pickSpellTask(
  lesson: LessonData,
  difficulty: Difficulty,
  kind: 'attack' | 'skill',
  seed: string,
): SpellTask {
  const skeletons = kind === 'attack' ? lesson.attackSkeletons : lesson.skillSkeletons
  if (difficulty !== 'hard') return { code: pickVariant(skeletons, seed), trial: null }

  const set = trialsForLesson(lesson)
  const variants = kind === 'attack' ? set?.attack : set?.skill
  // A chapter with no trials authored would silently fall back to the easy
  // skeleton rather than handing the player an empty editor with no โจทย์.
  // levels.test.ts fails the build before that can ship.
  if (!variants || variants.length === 0) return { code: pickVariant(skeletons, seed), trial: null }

  const trial = pickVariant(variants, seed)
  return { code: trialStarterCode(trial), trial }
}
