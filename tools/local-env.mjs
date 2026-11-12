// เขียนไฟล์ .env.local ให้ชี้ไปที่ Supabase ที่รันอยู่บนเครื่อง
//
// `supabase start` จะพิมพ์ API URL กับคีย์ออกมาท้ายคำสั่ง และคีย์นั้นต่างกันได้
// ตามเวอร์ชันของ CLI และตาม JWT secret ของสแต็กที่เพิ่งขึ้นมา — เอกสารที่จด
// คีย์ไว้ตรง ๆ จึงเก่าเงียบ ๆ โดยไม่มีใครรู้จนกว่าจะล็อกอินไม่ผ่าน
// สคริปต์นี้เลยไม่จดอะไรเลย แต่ไปถาม CLI เอาสด ๆ ทุกครั้ง
//
//   npm run supabase:env
//
// Vite อ่าน .env.local ทับ .env เสมอ (และ .gitignore กันไว้แล้ว) ดังนั้นค่าของ
// โปรเจกต์บนคลาวด์ใน .env จะยังอยู่ครบ แค่ถูกบังไว้ระหว่างที่พัฒนาบนเครื่อง
// อยากกลับไปใช้คลาวด์เมื่อไหร่ก็ลบ .env.local ทิ้ง

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ENV_PATH = fileURLToPath(new URL('../.env.local', import.meta.url))

function status() {
  try {
    // -o env ให้ผลเป็น KEY="value" บรรทัดละคู่ ซึ่งคงรูปแบบมากกว่าตารางสวย ๆ
    // ที่ CLI พิมพ์ออกมาตามปกติ
    return execFileSync('npx', ['--yes', 'supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join('\n').trim()
    console.error('อ่านสถานะของ Supabase ไม่ได้ — สแต็กยังไม่ได้รันอยู่หรือเปล่า?')
    console.error('ลอง: npm run supabase:start')
    if (detail) console.error(`\n${detail}`)
    process.exit(1)
  }
}

// บรรทัดหน้าตาแบบ KEY="value" — ค่าที่เหลือ (DB_URL, service_role ฯลฯ) ไม่เอา
// ลงไฟล์นี้: มันเป็นไฟล์ที่เบราว์เซอร์จะได้เห็น service_role key ห้ามไปอยู่ตรงนั้น
function parse(output) {
  const vars = {}
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*"?(.*?)"?$/.exec(line.trim())
    if (match) vars[match[1]] = match[2]
  }
  return vars
}

const vars = parse(status())
const url = vars.API_URL
const anonKey = vars.ANON_KEY ?? vars.PUBLISHABLE_KEY

if (!url || !anonKey) {
  console.error('สถานะที่ได้มาไม่มี API_URL หรือ ANON_KEY — CLI อาจเปลี่ยนชื่อคีย์ในเวอร์ชันใหม่')
  console.error('ดูค่าดิบด้วย: npx supabase status -o env')
  process.exit(1)
}

writeFileSync(
  ENV_PATH,
  [
    '# สร้างอัตโนมัติด้วย `npm run supabase:env` — แก้มือได้แต่จะถูกเขียนทับ',
    '# ชี้ไปที่ Supabase ที่รันด้วย Docker บนเครื่องนี้ (supabase/README.md)',
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
    '',
  ].join('\n'),
  'utf8',
)

console.log(`เขียน .env.local แล้ว — ชี้ไปที่ ${url}`)
console.log('รัน `npm run dev` ได้เลย (ลบ .env.local ทิ้งเมื่อไหร่ก็กลับไปใช้โปรเจกต์บนคลาวด์)')
