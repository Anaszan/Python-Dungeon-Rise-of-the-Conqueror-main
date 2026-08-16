// One line of the "does this code actually use the chapter" checklist shown
// beside the level-exam editor. `pattern` is tested against the player's raw
// source, not the run's output, because the whole point of the exam is that
// the code was written using this chapter's syntax — passing by pasting three
// bare attack() calls into the loops exam should not count.
//
// Deliberately never global (`/g`): a global RegExp carries lastIndex between
// .test() calls, so the same literal would flip between true and false as the
// checklist re-renders on every keystroke.
export type ExamCheck = {
  label: string
  pattern: RegExp
}

// The end-of-level exam: once every monster in a level is dead the player
// does not walk straight into the next level — they get one empty editor and
// have to write that chapter's whole spell from scratch (no `___` skeleton to
// fill in, no half-written code carried over) and bring the gate guardian
// down with it. See LevelExamOverlay.tsx and store.exitCombat/passLevelExam.
export type ExamSpec = {
  guardianName: string
  // Reset to full at the start of every run, so passing means one complete
  // script did the whole job — not damage dribbled in across ten attempts.
  guardianHp: number
  // What Python sees as `monster_armor`. Level 6's guardian is 0 for the same
  // reason its monsters are: naive division has to blow up so try/except is
  // the only way through.
  guardianArmor: number
  brief: string[]
  // Header comment only. Everything below it is the player's to write.
  starterCode: string
  checks: ExamCheck[]
  hints: string[]
}

export type LessonData = {
  chapter: number
  chapterTitle: string
  // Short (term, meaning) pairs shown as a compact reference table on the
  // ChapterIntro screen before the level starts.
  conceptRows: [string, string][]
  teachingLines: string[]
  // A complete, already-working example shown read-only on ChapterIntro
  // before the player touches the fill-in-the-blank boxes below it. Kept
  // deliberately generic (print()-based, not attack()/skill()-based) so it
  // demonstrates the chapter's syntax without just handing over the answer
  // to the practice exercise. Includes the expected output as a trailing
  // comment so looking at it is enough — no need to actually run it.
  exampleCode: string
  // Fill-in-the-blank starting code for each of the two SpellConsole boxes.
  // Left with `___` placeholders on purpose — running it unmodified throws a
  // SyntaxError, which the runtime already explains in-character, so an
  // untouched skeleton reads as "you still need to finish this" rather than
  // a silent no-op. Most levels only need one variant; level 1 has several
  // so the blank sometimes asks for a number literal and sometimes for a
  // variable name instead of always the same fill-in — see pickSkeleton().
  attackSkeletons: string[]
  skillSkeletons: string[]
  exam: ExamSpec
}

// Deterministic pick, not Math.random(): the same monster always shows the
// same skeleton variant (stable if the component re-renders), but different
// monsters within a level land on different variants, so a 9-monster level
// like level 1 naturally cycles through "fill a number" and "fill a
// variable" versions of the exercise as the player fights their way through.
export function pickSkeleton(variants: string[], seed: string): string {
  if (variants.length <= 1) return variants[0]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return variants[hash % variants.length]
}

export const LESSONS: LessonData[] = [
  // Level 1 — บทที่ 2: ตัวแปรและชนิดข้อมูล
  {
    chapter: 2,
    chapterTitle: 'ตัวแปรและชนิดข้อมูล',
    conceptRows: [
      ['ตัวแปร (Variable)', 'ช่องเก็บค่าพลัง เช่น hp, atk'],
      ['int / float', 'ตัวเลขพลังชีวิต/ความเสียหาย'],
      ['print()', 'แสดงข้อความออกมาดูระหว่างร่ายคาถา'],
    ],
    teachingLines: [
      'ก่อนเข้าทางเดินมืด เจ้าต้องรู้จักเก็บพลังของตัวเองก่อน ตัวแปรคือกระเป๋าใส่พลังของเจ้า',
      'ในสนามรบ ข้าเตรียมตัวแปร atk (พลังโจมตีของเจ้า) และ monster_hp (เลือดมอนสเตอร์) ไว้ให้เสมอ',
      'ลองเขียน damage = atk แล้วส่งเข้า attack(damage) ดูสิ — นั่นแหละคือคาถาแรกของเจ้า',
    ],
    exampleCode: `name = "นักรบเวท"
gold = 50
print(f"{name} มีทอง {gold} เหรียญ")
# ผลลัพธ์: นักรบเวท มีทอง 50 เหรียญ
`,
    // Three variants each, mixing "fill a number" and "fill a variable
    // name" blanks so the exercise doesn't feel identical against every one
    // of level 1's 9 monsters — see pickSkeleton() above.
    attackSkeletons: [
      `# ตัวแปรเก็บพลังโจมตีของเจ้าอยู่ใน atk แล้ว
damage = ___  # TODO: ใส่ตัวแปรพลังโจมตีของเจ้า

attack(damage)
`,
      `# เพิ่มพลังโจมตีปกติของเจ้าอีกเล็กน้อยก่อนร่าย
damage = atk + ___  # TODO: เติมตัวเลข (ลองใส่ 5) เพื่อเพิ่มพลังโจมตี

attack(damage)
`,
      `# สร้างตัวแปรใหม่ชื่อ base เก็บพลังโจมตีของเจ้าไว้ก่อน
base = atk
damage = ___  # TODO: ใส่ตัวแปรที่เพิ่งสร้างไว้ด้านบน (base)

attack(damage)
`,
    ],
    skillSkeletons: [
      `# สกิลพิเศษต้องใช้พลังมากกว่าปกติ ลองสร้างตัวแปรใหม่จาก atk
power = atk + ___  # TODO: เติมตัวเลขเพื่อเพิ่มพลังให้สกิลแรงขึ้น

skill(power)
`,
      `# เก็บพลังโจมตีของเจ้าไว้ในตัวแปรชื่อ base ก่อนร่ายสกิล
base = atk
power = ___  # TODO: ใส่ตัวแปรที่เพิ่งสร้างไว้ด้านบน (base)

skill(power)
`,
      `# ร่ายสกิลพิเศษด้วยพลังคงที่จากอาจารย์
power = ___  # TODO: เติมตัวเลขพลังของสกิล (ลองใส่เลขที่มากกว่า 20)

skill(power)
`,
    ],
    exam: {
      guardianName: 'ผู้พิทักษ์ประตูด่าน 1',
      guardianHp: 60,
      guardianArmor: 5,
      brief: [
        'สร้างตัวแปรของเจ้าเองเพื่อเก็บพลังโจมตี โดยคำนวณจาก atk',
        'รายงานพลังที่จะร่ายออกไปด้วย print()',
        'ร่าย attack(...) หรือ skill(...) ให้รวมกันแล้วล้มผู้พิทักษ์ได้ในการร่ายครั้งเดียว',
      ],
      starterCode: `# บทสอบจบด่าน 1 — บทที่ 2: ตัวแปรและชนิดข้อมูล
# เขียนคาถาปิดผนึกด่านนี้เองทั้งหมด (ไม่มีช่องว่างให้เติมแล้ว)

`,
      checks: [
        { label: 'สร้างตัวแปรเอง (เช่น damage = ...)', pattern: /^[ \t]*[A-Za-z_]\w*\s*=[^=]/m },
        { label: 'ใช้ค่า atk ในการคำนวณ', pattern: /\batk\b/ },
        { label: 'แสดงผลด้วย print()', pattern: /\bprint\s*\(/ },
      ],
      hints: [
        'skill() แรงได้ถึง 3 เท่าของ atk ในการเรียกครั้งเดียว ส่วน attack() ได้สูงสุดเท่ากับ atk',
        'เรียก attack() / skill() หลายบรรทัดในคาถาเดียวได้ ดาเมจจะสะสมรวมกัน',
      ],
    },
  },

  // Level 2 — บทที่ 3: คำสั่งเงื่อนไข
  {
    chapter: 3,
    chapterTitle: 'คำสั่งเงื่อนไข',
    conceptRows: [
      ['if / else', 'เลือกทำสิ่งต่างกันตามเงื่อนไข'],
      ['> < >= <= == !=', 'เปรียบเทียบค่า'],
      ['and / or / not', 'รวมหลายเงื่อนไขเข้าด้วยกัน'],
    ],
    teachingLines: [
      'มอนสเตอร์ในดันเจี้ยนนี้ไม่เหมือนกัน เจ้าต้อง "ตัดสินใจ" ว่าจะโจมตีแรงแค่ไหนตามสถานการณ์',
      'ใช้ if...else ตรวจ monster_hp ที่เหลือ แล้วเลือกพลังโจมตีให้เหมาะสม',
      'อย่าลืมเครื่องหมาย : ท้ายเงื่อนไข และเยื้องบรรทัดให้ตรงกัน ไม่งั้นคาถาร่ายไม่ออก',
    ],
    exampleCode: `hp = 40
if hp < 50:
    print("ระวัง! เลือดเหลือน้อย")
else:
    print("เลือดยังเยอะอยู่")
# ผลลัพธ์: ระวัง! เลือดเหลือน้อย
`,
    attackSkeletons: [
      `damage = atk

# TODO: ถ้า monster_hp มากกว่า 50 ให้เพิ่มพลังโจมตีอีก 5
if monster_hp ___ 50:
    damage = damage + 5

attack(damage)
`,
    ],
    skillSkeletons: [
      `# สกิลพิเศษ: ถ้าเลือดเจ้า (hp) เหลือน้อยกว่า 80 ให้ร่ายแรงเป็นพิเศษ
if hp ___ 80:
    power = atk * 3
else:
    power = atk * 2

skill(power)
`,
    ],
    exam: {
      guardianName: 'ผู้พิทักษ์ประตูด่าน 2',
      guardianHp: 90,
      guardianArmor: 5,
      brief: [
        'ตรวจสถานการณ์ด้วย if แล้วเลือกพลังโจมตีให้เหมาะสม',
        'ต้องมีทางเลือกสำรองด้วย else (หรือ elif)',
        'ใช้ค่า monster_hp ของผู้พิทักษ์ในเงื่อนไข แล้วล้มมันในการร่ายครั้งเดียว',
      ],
      starterCode: `# บทสอบจบด่าน 2 — บทที่ 3: คำสั่งเงื่อนไข
# เขียนคาถาปิดผนึกด่านนี้เองทั้งหมด (ไม่มีช่องว่างให้เติมแล้ว)

`,
      checks: [
        { label: 'มีเงื่อนไข if ... :', pattern: /^[ \t]*if\s+.+:/m },
        { label: 'มีทางเลือกสำรอง else / elif', pattern: /^[ \t]*(elif\s+.+:|else\s*:)/m },
        { label: 'ตรวจค่า monster_hp ในเงื่อนไข', pattern: /\bmonster_hp\b/ },
      ],
      hints: [
        'monster_hp คือเลือดเต็มของผู้พิทักษ์ตอนเริ่มร่าย ใช้เทียบกับตัวเลขได้เลย เช่น if monster_hp > 50:',
        'อย่าลืม : ท้ายบรรทัดเงื่อนไข และเยื้อง 4 ช่องให้บรรทัดข้างในตรงกัน',
      ],
    },
  },

  // Level 3 — บทที่ 4: การวนซ้ำ
  {
    chapter: 4,
    chapterTitle: 'การวนซ้ำ',
    conceptRows: [
      ['for i in range(n):', 'วนซ้ำ n รอบ เมื่อรู้จำนวนรอบแน่นอน'],
      ['while เงื่อนไข:', 'วนซ้ำจนกว่าเงื่อนไขจะเป็นเท็จ'],
      ['//', 'หารเอาเฉพาะจำนวนเต็ม เผื่อแบ่งดาเมจเป็นก้อนเท่า ๆ กัน'],
    ],
    teachingLines: [
      'ในสนามคอมโบนี้ เจ้าจะได้เรียนการวนซ้ำ — สั่งให้คาถาทำงานซ้ำ ๆ โดยไม่ต้องพิมพ์ attack() หลายรอบเอง',
      'for i in range(n): จะทำคำสั่งด้านในซ้ำ n รอบ ลองโจมตีต่อเนื่องหลายครั้งดูสิ',
      'ระวังอย่าให้ลูปวนไม่รู้จบ (เช่น while ที่เงื่อนไขไม่เคยเป็นเท็จ) ไม่งั้นคาถาจะค้าง — ข้าได้ใส่เกราะกันคาถาคุมพลังไว้ให้เจ้าระดับหนึ่งแล้ว แต่ก็ควรระวังไว้เสมอ',
    ],
    exampleCode: `for i in range(3):
    print("โจมตีครั้งที่", i + 1)
# ผลลัพธ์:
# โจมตีครั้งที่ 1
# โจมตีครั้งที่ 2
# โจมตีครั้งที่ 3
`,
    attackSkeletons: [
      `# โจมตีคอมโบ 3 ครั้งติด ครั้งละ 1 ใน 3 ของพลังโจมตี
for i in range(___):  # TODO: ใส่จำนวนครั้งที่ต้องการโจมตีซ้ำ
    attack(atk // 3)
`,
    ],
    skillSkeletons: [
      `# วนโจมตีด้วยสกิลจนกว่า "remaining" (พลังคาถาที่จำลองไว้) จะเหลือน้อยกว่า 20
remaining = atk * 4
while remaining ___ 20:  # TODO: ใส่เงื่อนไขให้วนซ้ำ (เช่น >)
    skill(atk // 2)
    remaining = remaining - atk // 2
`,
    ],
    exam: {
      guardianName: 'ผู้พิทักษ์ประตูด่าน 3',
      guardianHp: 120,
      guardianArmor: 5,
      brief: [
        'ใช้ลูป for หรือ while สั่งให้คาถาทำงานซ้ำ',
        'เรียก attack(...) หรือ skill(...) อยู่ "ข้างใน" ลูป (ต้องเยื้องบรรทัด)',
        'ดาเมจรวมจากทุกรอบต้องล้มผู้พิทักษ์ได้ในการร่ายครั้งเดียว',
      ],
      starterCode: `# บทสอบจบด่าน 3 — บทที่ 4: การวนซ้ำ
# เขียนคาถาปิดผนึกด่านนี้เองทั้งหมด (ไม่มีช่องว่างให้เติมแล้ว)

`,
      checks: [
        { label: 'มีลูป for ... : หรือ while ... :', pattern: /^[ \t]*(for\s+\w+\s+in\s+.+:|while\s+.+:)/m },
        { label: 'เรียกคาถาอยู่ข้างในลูป (บรรทัดเยื้อง)', pattern: /^[ \t]+(attack|skill)\s*\(/m },
      ],
      hints: [
        'for i in range(4): แล้วเยื้องบรรทัดถัดไปเรียก attack(atk) จะได้ดาเมจ 4 เท่าของ atk',
        'ระวัง while ที่เงื่อนไขไม่มีวันเป็นเท็จ — ข้าตัดคาถาทิ้งเมื่อเรียกเกิน 200 ครั้งในคาถาเดียว',
      ],
    },
  },

  // Level 4 — บทที่ 5: ฟังก์ชัน
  {
    chapter: 5,
    chapterTitle: 'ฟังก์ชัน',
    conceptRows: [
      ['def ชื่อ(param):', 'สร้างฟังก์ชัน/คาถาใหม่'],
      ['return', 'ส่งค่ากลับจากฟังก์ชัน'],
      ['default argument', 'กำหนดค่าเริ่มต้นให้พารามิเตอร์ เผื่อไม่ได้ระบุ'],
    ],
    teachingLines: [
      'หอคาถานี้สอนเรื่องฟังก์ชัน — สร้างคาถาที่ตั้งชื่อเองได้ แล้วเรียกใช้ซ้ำได้ไม่จำกัด',
      'ใช้ def ชื่อฟังก์ชัน(พารามิเตอร์): แล้วใช้ return เพื่อส่งค่ากลับออกมา',
      'สร้างฟังก์ชันคาถาของเจ้าเอง แล้วส่งผลลัพธ์เข้า attack() หรือ skill() ได้เลย',
    ],
    exampleCode: `def heal(amount):
    return amount * 2

print(heal(10))
# ผลลัพธ์: 20
`,
    attackSkeletons: [
      `# สร้างฟังก์ชันคาถาโจมตีของเจ้าเอง
def fireball(power):
    return ___  # TODO: ให้ฟังก์ชันคืนค่าพลังโจมตี (ลองคูณ power ดู)

attack(fireball(atk))
`,
    ],
    skillSkeletons: [
      `# ฟังก์ชันที่มีค่าเริ่มต้น (default argument) ให้พลังพิเศษเพิ่มขึ้นเสมอ
def big_spell(power, bonus=___):  # TODO: ใส่ตัวเลขโบนัสให้สกิลแรงขึ้น
    return power + bonus

skill(big_spell(atk))
`,
    ],
    exam: {
      guardianName: 'ผู้พิทักษ์ประตูด่าน 4',
      guardianHp: 120,
      guardianArmor: 5,
      brief: [
        'สร้างฟังก์ชันคาถาของเจ้าเองด้วย def',
        'ให้ฟังก์ชันส่งค่าพลังกลับมาด้วย return',
        'ส่งผลลัพธ์ของฟังก์ชันเข้า attack(...) หรือ skill(...) โดยตรง แล้วล้มผู้พิทักษ์ในการร่ายครั้งเดียว',
      ],
      starterCode: `# บทสอบจบด่าน 4 — บทที่ 5: ฟังก์ชัน
# เขียนคาถาปิดผนึกด่านนี้เองทั้งหมด (ไม่มีช่องว่างให้เติมแล้ว)

`,
      checks: [
        { label: 'ประกาศฟังก์ชันด้วย def ชื่อ(...):', pattern: /^[ \t]*def\s+\w+\s*\(.*\)\s*:/m },
        { label: 'ส่งค่ากลับด้วย return', pattern: /^[ \t]+return\b/m },
        { label: 'ส่งผลลัพธ์ฟังก์ชันเข้า attack()/skill()', pattern: /\b(attack|skill)\s*\(\s*\w+\s*\(/ },
      ],
      hints: [
        'def fireball(power): แล้วบรรทัดถัดไปเยื้อง 4 ช่อง return power * 2',
        'เรียกใช้แบบ attack(fireball(atk)) — ผลลัพธ์จาก return จะไหลเข้าคาถาทันที',
      ],
    },
  },

  // Level 5 — บทที่ 6: การจัดการไฟล์
  {
    chapter: 6,
    chapterTitle: 'การจัดการไฟล์',
    conceptRows: [
      ['open(name, mode)', 'เปิดไฟล์ โหมด "w" เขียนใหม่ / "r" อ่าน / "a" ต่อท้าย'],
      ['with ... as f:', 'เปิดไฟล์แล้วปิดให้อัตโนมัติ ปลอดภัยที่สุด'],
      ['f.write() / f.read()', 'เขียน/อ่านข้อมูลในไฟล์'],
    ],
    teachingLines: [
      'หอสมุดลับแห่งนี้เก็บตำราคาถาไว้มากมาย เจ้าต้องรู้จักจารึกและอ่านบันทึกจากไฟล์',
      'ใช้ with open("ชื่อไฟล์", "w") as f: แล้ว f.write(...) เพื่อจารึกพลังคาถาลงตำรา',
      'จากนั้นเปิดไฟล์แบบ "r" แล้ว f.read() เพื่ออ่านค่ากลับมาร่ายคาถา',
    ],
    exampleCode: `with open("note.txt", "w") as f:
    f.write("บันทึกไว้แล้ว")

with open("note.txt", "r") as f:
    print(f.read())
# ผลลัพธ์: บันทึกไว้แล้ว
`,
    attackSkeletons: [
      `# จารึกพลังโจมตีลงตำราคาถา แล้วอ่านกลับมาร่าย
with open("spellbook.txt", "w") as f:
    f.write(str(___))  # TODO: ใส่ atk เพื่อจารึกพลังโจมตีลงไป

with open("spellbook.txt", "r") as f:
    damage = int(f.read())

attack(damage)
`,
    ],
    skillSkeletons: [
      `# เพิ่มพลังสกิลโดยจารึกซ้ำสองครั้งด้วยโหมดต่อท้าย "a"
with open("skillbook.txt", "w") as f:
    f.write(str(atk) + ",")

with open("skillbook.txt", "___") as f:  # TODO: ใส่โหมดต่อท้ายไฟล์
    f.write(str(atk))

with open("skillbook.txt", "r") as f:
    parts = f.read().split(",")
    power = int(parts[0]) + int(parts[1])

skill(power)
`,
    ],
    exam: {
      guardianName: 'ผู้พิทักษ์ประตูด่าน 5',
      guardianHp: 90,
      guardianArmor: 5,
      brief: [
        'จารึกพลังคาถาลงไฟล์ด้วย with open(...) as f:',
        'เขียนด้วย f.write(...) แล้วเปิดอ่านกลับมาด้วย f.read()',
        'ใช้ค่าที่อ่านกลับมาร่ายคาถาจนล้มผู้พิทักษ์ในการร่ายครั้งเดียว',
      ],
      starterCode: `# บทสอบจบด่าน 5 — บทที่ 6: การจัดการไฟล์
# เขียนคาถาปิดผนึกด่านนี้เองทั้งหมด (ไม่มีช่องว่างให้เติมแล้ว)

`,
      checks: [
        { label: 'เปิดไฟล์ด้วย with open(...) as f:', pattern: /\bwith\s+open\s*\(/ },
        { label: 'จารึกลงไฟล์ด้วย .write(...)', pattern: /\.write\s*\(/ },
        { label: 'อ่านกลับมาด้วย .read()', pattern: /\.read\s*\(/ },
      ],
      hints: [
        'f.write() รับได้เฉพาะข้อความ — แปลงตัวเลขก่อนด้วย str(atk)',
        'ตอนอ่านกลับมาต้องแปลงกลับเป็นตัวเลขด้วย int(f.read()) ไม่งั้นจะเจอ TypeError',
      ],
    },
  },

  // Level 6 — บทที่ 7: การจัดการข้อผิดพลาด
  {
    chapter: 7,
    chapterTitle: 'การจัดการข้อผิดพลาด',
    conceptRows: [
      ['try / except', 'ทดลองทำคำสั่งที่อาจพลาด แล้วดักข้อผิดพลาดไว้'],
      ['ZeroDivisionError', 'เกิดเมื่อหารด้วยศูนย์'],
      ['finally', 'ทำงานเสมอไม่ว่าจะพลาดหรือไม่'],
    ],
    teachingLines: [
      'ดันเจี้ยนสุดท้ายนี้เต็มไปด้วยกับดัก แม้แต่จอมเวทฝีมือดีก็พลาดได้ — สิ่งสำคัญคือต้องมีโล่ป้องกันความผิดพลาด',
      'มอนสเตอร์ที่นี่ถูกสาปจนเกราะ (monster_armor) กลายเป็น 0 — หากเจ้าหารด้วยมันตรง ๆ จะเกิด ZeroDivisionError ทันที',
      'ใช้ try: ... except ZeroDivisionError: ... เพื่อดักคำสาปนี้ไว้ ไม่ให้คาถาพังกลางทาง',
    ],
    exampleCode: `try:
    x = 10 / 0
except ZeroDivisionError:
    print("หารด้วยศูนย์ไม่ได้!")
# ผลลัพธ์: หารด้วยศูนย์ไม่ได้!
`,
    attackSkeletons: [
      `# เกราะของมอนสเตอร์ที่นี่มักถูกสาปจนเหลือ 0 — ระวังหารด้วยศูนย์!
try:
    pierce = atk / monster_armor
    damage = int(pierce) + atk
except ___:  # TODO: ใส่ชนิด error ที่ป้องกันการหารด้วยศูนย์
    damage = atk  # ถ้าคำนวณพลาด ใช้พลังโจมตีปกติแทน

attack(damage)
`,
    ],
    skillSkeletons: [
      `# ลองใช้ finally เพื่อให้ทำงานเสมอไม่ว่าจะพลาดหรือไม่
try:
    power = atk * (100 // monster_armor)
except ZeroDivisionError:
    power = atk * 3
___:  # TODO: เติม finally เพื่อให้ทำงานเสมอหลัง try/except
    print("ร่ายคาถาสกิลพิเศษเรียบร้อย")

skill(power)
`,
    ],
    exam: {
      guardianName: 'ผู้พิทักษ์ประตูสุดท้าย',
      guardianHp: 120,
      // 0 on purpose, same as every monster in this level — a naive
      // atk / monster_armor in the exam has to raise ZeroDivisionError so
      // try/except is the only way past the last gate.
      guardianArmor: 0,
      brief: [
        'ใช้ monster_armor ของผู้พิทักษ์ในการคำนวณ (มันถูกสาปให้เป็น 0)',
        'ครอบด้วย try: แล้วดักคำสาปด้วย except',
        'ต้องร่ายผ่านโดยไม่มี error หลุดออกมา และล้มผู้พิทักษ์ในการร่ายครั้งเดียว',
      ],
      starterCode: `# บทสอบจบด่าน 6 — บทที่ 7: การจัดการข้อผิดพลาด
# เขียนคาถาปิดผนึกด่านนี้เองทั้งหมด (ไม่มีช่องว่างให้เติมแล้ว)

`,
      checks: [
        { label: 'เริ่มด้วย try:', pattern: /^[ \t]*try\s*:/m },
        { label: 'ดักข้อผิดพลาดด้วย except', pattern: /^[ \t]*except\b/m },
        { label: 'ใช้ค่า monster_armor ในการคำนวณ', pattern: /\bmonster_armor\b/ },
      ],
      hints: [
        'except ZeroDivisionError: แล้วในนั้นตั้งค่าพลังสำรองไว้ เช่น damage = atk * 3',
        'เรียก attack()/skill() หลังบล็อก try/except จบแล้วก็ได้ ขอแค่ตัวแปรพลังถูกกำหนดค่าทุกเส้นทาง',
      ],
    },
  },
]
