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

## Deploy ฟรี

เลือกอย่างใดอย่างหนึ่ง ทั้งหมดได้ HTTPS ให้อัตโนมัติ ซึ่ง PWA ต้องใช้

### ตัวเลือก A — GitHub Pages (มี workflow ให้แล้ว)

```bash
git init -b main
git add .
git commit -m "init"
gh repo create todo-money --public --source=. --push
```

จากนั้นที่ repo → **Settings → Pages → Source: GitHub Actions** แล้ว push อีกครั้ง (หรือกด Run workflow ในแท็บ Actions)
เว็บจะอยู่ที่ `https://<username>.github.io/todo-money/`

> ตามที่ทราบ GitHub Pages บนแพลนฟรีใช้กับ repo แบบ public — โค้ดนี้ไม่มีข้อมูลลับ (ข้อมูลของคุณอยู่ในเครื่องคุณเท่านั้น) จึงไม่เป็นปัญหา

### ตัวเลือก B — Cloudflare Pages (รองรับ repo private)

Dashboard → Workers & Pages → Create → Pages → เชื่อม Git repo
Build command: *(ว่าง)* · Output directory: `/`

### ตัวเลือก C — Netlify Drop (เร็วสุด ไม่ต้องใช้ git)

เปิด <https://app.netlify.com/drop> แล้วลากทั้งโฟลเดอร์นี้ไปวาง

## ติดตั้งเป็นแอป

- **iPhone/iPad:** เปิดลิงก์ใน **Safari** → ปุ่มแชร์ → *เพิ่มไปยังหน้าจอโฮม*
- **macOS Safari (Sonoma+):** ไฟล์ → *เพิ่มไปยัง Dock…*
- **macOS Chrome/Edge:** กดไอคอนติดตั้งที่แถบที่อยู่

## ตอนอัปเดตโค้ด

แก้เลข `CACHE` ใน `sw.js` (เช่น `todo-money-v2`) ทุกครั้งที่ deploy เวอร์ชันใหม่ เพื่อให้เครื่องที่ติดตั้งไว้ดึงไฟล์ใหม่ (ปิดแล้วเปิดแอป 1–2 ครั้งจะเห็นของใหม่)

## หมายเหตุเรื่องข้อมูลบน iOS

- แอปที่เพิ่มไปหน้าจอโฮมมีที่เก็บข้อมูลแยกจากแท็บ Safari ปกติ — ข้อมูลที่จดไว้ใน Safari **จะไม่ตามไปที่แอป** ให้ส่งออกแล้วนำเข้าถ้าต้องการย้าย
- iOS อาจล้างข้อมูลเว็บของเว็บที่ไม่ได้เปิดนานๆ (โดยเฉพาะเมื่อไม่ได้ติดตั้งเป็นแอป) — แนะนำส่งออกสำรองเป็นครั้งคราว
