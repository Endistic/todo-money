# จดๆ — Todo + รายรับรายจ่าย (PWA)

แอปเดียวจบ: จดงานที่ต้องทำ + บันทึกรายรับรายจ่าย ใช้ได้ทั้ง iOS และ macOS แบบติดตั้งเป็นแอป ใช้ออฟไลน์ได้

- ไม่มี backend, ไม่มี build step — ไฟล์ static ล้วน (HTML/CSS/JS)
- ข้อมูลเก็บใน `localStorage` ในเครื่องนั้นๆ (ไม่ sync ข้ามเครื่อง) — มีปุ่มส่งออก/นำเข้า JSON และส่งออก CSV ในแท็บ "เพิ่มเติม"
- Dark mode ตามระบบ, รองรับ safe-area ของ iPhone

## ทดลองรันในเครื่อง

```bash
python3 -m http.server 8080
# เปิด http://localhost:8080
```

(service worker ทำงานเฉพาะบน `https://` หรือ `localhost`)

## Deploy — Cloudflare Pages

เว็บอยู่ที่ <https://todo-money.pages.dev> (HTTPS อัตโนมัติ ซึ่ง PWA ต้องใช้)

ครั้งแรกครั้งเดียว:

```bash
npx wrangler login
npx wrangler pages project create todo-money --production-branch main --force
```

(`--force` = สร้างเป็น Pages แบบเดิม ไม่ให้ wrangler โยนไปเป็น Workers — ใช้แค่ตอนสร้างครั้งเดียว)

ทุกครั้งที่ deploy (อัปโหลดเฉพาะไฟล์แอป ไม่รวม `.git`/README):

```bash
d=$(mktemp -d) && cp -r index.html styles.css app.js sw.js manifest.webmanifest icons "$d" \
  && npx wrangler pages deploy "$d" --project-name todo-money --branch main
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
