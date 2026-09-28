// One line of the "does this code actually use the chapter" checklist shown
// beside a hard-mode โจทย์ (trials.ts). `pattern` is tested against the
// player's source, not the run's output, because the whole point is that the
// code was written using this chapter's syntax — pasting three bare attack()
// calls into the loops level should not count.
//
// Deliberately never global (`/g`): a global RegExp carries lastIndex between
// .test() calls, so the same literal would flip between true and false as the
// checklist re-renders on every keystroke.
export type CodeCheck = {
  label: string
  pattern: RegExp
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
  // variable name instead of always the same fill-in — see pickVariant().
  // Hard mode ignores these entirely and uses trials.ts instead.
  attackSkeletons: string[]
  skillSkeletons: string[]
}

// Deterministic pick, not Math.random(): the same monster always shows the
// same variant (stable if the component re-renders), but different monsters
// within a level land on different variants, so a 9-monster level like level 1
// naturally cycles through "fill a number" and "fill a variable" versions of
// the exercise as the player fights their way through. Hard mode reuses this
// to hand each monster its own โจทย์ (see trials.ts pickSpellTask).
export function pickVariant<T>(variants: T[], seed: string): T {
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
    // of level 1's 9 monsters — see pickVariant() above.
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
  },
]
