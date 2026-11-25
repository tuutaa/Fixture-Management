# Fixture Management · FAN2 (Flow MM)

ระบบบริหารจัดการฟิกซ์เจอร์สำหรับสายการผลิต Delta FAN2 — React + Vite + Tailwind CSS v4 + Express/Mongoose
สร้างใหม่ตาม **Flow Fixture MM.drawio**

## Flow (Flow Fixture MM)

```
Register → Input Fixture Information → If Exist / Not Exist
Request → Change Model | Breakdown
Change Model → (By line: queue slot | By machine: select machine) → Model A → Model B → Compare A->B → Summary Issue/Return
  → Fixture Room Progress → ME/TE Confirm Received → Record History → Done
  → ME/TE Return Fixture → Fixture Confirm Returned → Record History
Breakdown → Verify → PM & Maintenance | Issue Spare | Record Breakdown
PM → Pre-Alert → Overdue 3 day remind (Orange) | Current reach 80% remind (Orange)
  → Plan PM → PM On Due → PM Over Due → 4M (Over 7 Day → Management Approve +XX Days)
  → PM & Maintenance → Verify + Record
     OK → Reset Due → Auto Print Sticker → Record History → Done
     NG → Need Scrape | Need PR (Red) | New One Replacement → Record History → Done
```

- **Request** — ผู้ใช้ส่งคำขอ `Change Model` หรือ `Breakdown`
- **Orders** — Fixture Room รับคำขอ (Accept) → เตรียม/จ่ายของ (Issue) → ME/TE ยืนยันรับ (Verify → Done)
  - Change Model เลือกได้ 2 รูปแบบ: `Change by line` (ใช้คิว 1 ชม. ต่อ Line) หรือ `Change by machine` (ระบุเครื่องจักร ไม่ใช้คิว) และ Compare Fixture List ของ Model A→B อัตโนมัติ แยกรายการ Issue / Return / Keep
- **Register** — ลงทะเบียน Fixture ใหม่ ตรวจ `If Exist / Not Exist` ตาม Serial Number
- **Return** — ME/TE คืน Fixture → Fixture Room ยืนยันรับคืนเข้า `In Stock` หรือ `Maintenance`
- **PM** — หน้าแยกแท็บ `งาน PM` (4M → Approve → Start PM · ปฏิทิน · รายการตาม Line/Model) และ `ตรวจรับงานซ่อม` (เลือก Fixture → Done / NG)
  Pre-Alert · Overdue 3 day remind · 80% Usage remind · PM On Due · PM Over Due + `Plan PM` + `4M Approve (+XX days)`
- **Maintenance** — Verify + Record: `OK` → Reset Due + Auto Print Sticker, `NG` → Need Scrape / Need PR / New One Replacement
- **History** — ทุก action บันทึกลง collection `history` อัตโนมัติ
- **Users** — อนุมัติผู้ใช้ใหม่และจัดการสิทธิ์
- **Sticker printing** — พิมพ์ QR 36 × 11 mm (Register และหลัง PM OK อัตโนมัติ)

## Data model (ตาม drawio)

- `users` — `{ empId, pass, name, lastname, dept{}, status{} }`
- `fixturelist` — `{ line, model, fixtureInfo[] }`
  - `fixtureInfo` — `{ step, process, position, fixtureDetail{} }`
  - `fixtureDetail` — `{ sn, status, type, storage, usage{}, registered{}, fixtureBase }`
  - `usage` — `{ current, max, exp, storage, currentModel, changeModel }`
- `request` — `{ line, model, modelTo, type, status, desc, requestInfo, acceptInfo, issueInfo, verifyInfo }`
- `history` — record ทุก action (`Register`, `Accept`, `Issue`, `Return`, `Verify`, `Plan PM`, `PM OK`, `PM NG`, `4M Approve`, …)

สถานะ Request: `Waiting → Accepted → Issued → Done`
สถานะ Fixture: `In Stock / In Use / Maintenance / Scrape / PR`

## Requirements

- Node.js 20+
- MongoDB — ฐานข้อมูลใหม่ `Fixture_Management` (เน้น underscore)

ค่าเริ่มต้นเชื่อมต่อ `mongodb://10.192.8.238:27017/Fixture_Management`

> ⚠️ เมื่อรันครั้งแรกกับ DB ว่าง server จะ seed ผู้ใช้ `admin` / `admin`
> (approved + admin) ให้อัตโนมัติ — **ควรเปลี่ยนรหัสผ่านทันทีที่เข้าใช้งานจริง**

## Run

Development (HMR):

```bash
npm install
npm run dev
```

- API: http://localhost:3000
- Web: http://localhost:8000
- ตรวจสอบการเชื่อมต่อฐานข้อมูลได้ที่ http://localhost:3000/api/health

Production (เปิดเว็บที่พอร์ตเดียว):

```bash
npm run build
npm start
```

เปิด http://localhost:3000 — `npm start` จะ serve ทั้ง API และไฟล์ frontend จาก `dist/`

### Mock mode (ไม่ต้องใช้ MongoDB)

```bash
npm run dev:mock
```

เปิด http://localhost:8000 — ข้อมูลตัวอย่างถูกสร้างในหน่วยความจำฝั่ง frontend
(`src/lib/mockData.js` + `src/lib/mockApi.js`) และจะรีเซ็ตทุกครั้งที่ refresh

| Emp ID | Password | Role |
| --- | --- | --- |
| `admin` | `admin` | Admin |
| `10001` | `1234` | ช่าง (Signed) |

โหมดนี้เปิดด้วย `VITE_MOCK=true` (ดู `.env.mock`) — คำสั่ง `npm run dev` / `npm run build`
ยังคงใช้ API จริงตามปกติ

## Configuration

ตั้งค่า environment variable ก่อนรัน `server.js`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | พอร์ต API |
| `MONGO_URL` | `mongodb://10.192.8.238:27017/Fixture_Management` | ฐานข้อมูลหลัก |

Frontend (ตอน build/dev):

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | API base URL |
| `VITE_MOCK` | – | `true` = ใช้ mock data ฝั่ง frontend |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | รัน API + Vite พร้อมกัน |
| `npm run server` | รันเฉพาะ API |
| `npm run client` | รันเฉพาะ Vite ที่พอร์ต 8000 |
| `npm run dev:mock` | รัน frontend ด้วย mock data (ไม่ต้องใช้ API/MongoDB) |
| `npm run build` | สร้าง production bundle |
| `npm start` | รัน API และ serve `dist/` |
| `npm run lint` | ตรวจ ESLint |
| `npm run reset-db` | ล้างข้อมูลธุรกรรม (ต้องยืนยันด้วย `-- --yes`) |

## Roles

- **Admin** — Register, Return, Orders (ดำเนินการ), PM, Maintenance, Users, History
- **User** — Request, Orders (ติดตามของตัวเอง), History

Role ตรวจจาก `users.status.admin` (login แล้วได้ role `admin`)
