# จดๆ — Todo + รายรับรายจ่าย (PWA)

แอปเดียวจบ: จดงานที่ต้องทำ + บันทึกรายรับรายจ่าย ใช้ได้ทั้ง iOS และ macOS แบบติดตั้งเป็นแอป ใช้ออฟไลน์ได้

- ไม่มี build step — ไฟล์ static ล้วน (HTML/CSS/JS) + backend เล็กๆ เฉพาะ sync (`functions/api/sync.js` + Cloudflare KV)
- ข้อมูลเก็บใน `localStorage` ในเครื่องนั้นๆ — มีปุ่มส่งออก/นำเข้า JSON และส่งออก CSV ในแท็บ "เพิ่มเติม"
- Sync ข้ามเครื่องแบบกดเอง: แท็บ "เพิ่มเติม" → เปิด sync ได้รหัส → ใส่รหัสเดียวกันในอีกเครื่อง → กด "Sync ตอนนี้" ข้อมูลถูกเข้ารหัส (AES-GCM) ในเครื่องก่อนส่ง server อ่านไม่ได้
- Dark mode ตามระบบ, รองรับ safe-area ของ iPhone

## ทดลองรันในเครื่อง

```bash
python3 -m http.server 8080
# เปิด http://localhost:8080
```

(service worker ทำงานเฉพาะบน `https://` หรือ `localhost`) — แบบนี้ sync ใช้ไม่ได้ ถ้าจะลอง sync ให้ build `dist/` (ดูด้านล่าง) แล้วรัน `npx wrangler pages dev` (KV จำลองในเครื่อง)

ทดสอบ logic ของ sync (merge/เข้ารหัส): `node --test`

## Deploy — Cloudflare Pages

เว็บอยู่ที่ <https://todo-money.pages.dev> (HTTPS อัตโนมัติ ซึ่ง PWA ต้องใช้)

ครั้งแรกครั้งเดียว:

```bash
npx wrangler login
npx wrangler pages project create todo-money --production-branch main --force
```

(`--force` = สร้างเป็น Pages แบบเดิม ไม่ให้ wrangler โยนไปเป็น Workers — ใช้แค่ตอนสร้างครั้งเดียว)

KV สำหรับ sync (ครั้งเดียว ทำไว้แล้ว): `npx wrangler kv namespace create todo-money-sync` แล้วใส่ `id` ที่ได้ใน `wrangler.toml`

ทุกครั้งที่ deploy — copy เฉพาะไฟล์แอปไปที่ `dist/` (ไม่รวม `.git`/README) แล้ว deploy ตาม `wrangler.toml` (รวม `functions/` และ KV binding):

```bash
rm -rf dist && mkdir dist && cp -r index.html styles.css app.js sync.js sw.js manifest.webmanifest icons dist/ \
  && npx wrangler pages deploy --branch main
```

## ติดตั้งเป็นแอป

- **iPhone/iPad:** เปิดลิงก์ใน **Safari** → ปุ่มแชร์ → *เพิ่มไปยังหน้าจอโฮม*
- **macOS Safari (Sonoma+):** ไฟล์ → *เพิ่มไปยัง Dock…*
- **macOS Chrome/Edge:** กดไอคอนติดตั้งที่แถบที่อยู่

## ตอนอัปเดตโค้ด

แก้เลข `CACHE` ใน `sw.js` (เช่น `todo-money-v2`) ทุกครั้งที่ deploy เวอร์ชันใหม่ เพื่อให้เครื่องที่ติดตั้งไว้ดึงไฟล์ใหม่ (ปิดแล้วเปิดแอป 1–2 ครั้งจะเห็นของใหม่)

## หมายเหตุเรื่องข้อมูลบน iOS

- แอปที่เพิ่มไปหน้าจอโฮมมีที่เก็บข้อมูลแยกจากแท็บ Safari ปกติ — ข้อมูลที่จดไว้ใน Safari **จะไม่ตามไปที่แอป** ให้ส่งออกแล้วนำเข้าถ้าต้องการย้าย
- iOS อาจล้างข้อมูลเว็บของเว็บที่ไม่ได้เปิดนานๆ (โดยเฉพาะเมื่อไม่ได้ติดตั้งเป็นแอป) — แนะนำส่งออกสำรองเป็นครั้งคราว
