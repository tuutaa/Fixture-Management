# Fixture Management — Project Context

> เอกสารอ้างอิงของโปรเจค **Fixture Management / FAN2 Flow MM**  
> อัปเดตจากโค้ดปัจจุบัน (ยังไม่ commit) เมื่อ 2026-11-25
> แหล่งความจริงของธุรกิจ: `Fixture MM.drawio` (อ้างอิงในหัวข้อ `server.js`)

---

## 1. ภาพรวมระบบ

ระบบบริหารจัดการ Fixture ของสายผลิต FAN2 (Delta) ครอบคลุมตั้งแต่ลงทะเบียน Fixture, สร้างคำขอ **Change Model / Replace / Breakdown**, รับงาน–สแกน–จ่าย/รับคืนผ่านหน้า **Order**, PM/ซ่อมบำรุงแบบราย Line+Model พร้อมเอกสาร 4M, ประวัติ และ Dashboard แบบ read-only กระชับ ดูได้ในหน้าเดียว

**ไม่มีหน้า Issue/Return แยกอีกต่อไป** — ทุกการจ่าย/รับคืนต้องผ่าน Request → Order เท่านั้น (ลบทั้ง page, nav, API `/api/issue`, `/api/return`)

**Stack**

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 (`@tailwindcss/vite`) |
| Icon | `lucide-react` |
| Font | `@fontsource/noto-sans-thai` (self-hosted, weights 400/500/600/700) |
| Excel | `xlsx` (lazy-load เฉพาะหน้า Fixture List) |
| QR/Print | `qrcode` + `window.print()` |
| Backend | Express 5 + Mongoose 9 + MongoDB |
| Upload | Multer (เก็บเอกสาร 4M ที่ `my-react-app/uploads/pm`, ไม่เกิน 25 MB; UI รับ PDF / Word / Excel / PowerPoint / รูปภาพ) |
| Dev | `concurrently` รัน API :3000 + Vite :8000 |

**ไม่มี React Router** — การเปลี่ยนหน้าใช้ state `page` ใน `App.jsx` + `localStorage.currentPage`; `navigate()` scroll กลับด้านบนเสมอ

**Session** เก็บใน `localStorage`: `currentUser`, `currentUserID`, `currentLastName`, `userRole`, `currentDept`, `currentRequestId` (อ่านอย่างเดียว), `currentPage`, `app_lang`

**Provider tree**

```
main.jsx
└─ <StrictMode>
   └─ <LanguageProvider>            // src/context/LanguageContext.jsx
      └─ <App>
         ├─ <ToastProvider>         // src/components/ui/Toast.jsx
         ├─ LoginPage (ยังไม่ login)
         └─ <AppShell> + active page (login แล้ว)
```

---

## 2. โครงสร้างไฟล์สำคัญ

```
Fixture Management/
├─ context.md                         ← เอกสารนี้
└─ my-react-app/
   ├─ server.js                       ← Express API + Mongoose schema + flow ทั้งหมด
   ├─ index.html                      ← pre-hydration script อ่าน app_lang
   ├─ vite.config.js                  ← proxy /api, /images → localhost:3000
   ├─ scripts/
   │  ├─ reset-db.js                  ← ล้าง collection ด้วย --yes / --all
   │  ├─ migrate-old.mjs
   │  ├─ inspect-old.mjs
   │  └─ inspect-old2.mjs
   ├─ public/delta-logo.png
   ├─ uploads/pm/                     ← เอกสาร 4M ที่อัปโหลด (สร้างอัตโนมัติ)
   └─ src/
      ├─ main.jsx                     ← import font + LanguageProvider
      ├─ App.jsx                      ← auth gate + page switcher + ToastProvider
      ├─ index.css                    ← design token, font, button/card, print CSS
      ├─ context/LanguageContext.jsx  ← TH/ENG, localStorage.app_lang
      ├─ lib/
      │  ├─ api.js                    ← ทุก HTTP call
      │  ├─ i18n.js                   ← useLabels(), useServerMessage(), MESSAGES
      │  ├─ constants.js              ← status/toning/REQUEST_TYPES
      │  ├─ navigation.js             ← NAV_GROUPS 4 กลุ่ม / 8 หน้า (ไม่มี Issue/Return)
      │  ├─ format.js                 ← วันที่, พ.ศ., daysUntil, toDateInput, initials
      │  ├─ fixtureImport.js          ← parse Excel → fixtureList import payload
      │  └─ print.js                  ← sticker 36×11 mm (ยังไม่ได้ใช้งาน)
      ├─ components/
      │  ├─ AppShell.jsx              ← sidebar, mobile drawer, user card, logout, switcher
      │  ├─ AuthCard.jsx
      │  ├─ LanguageSwitcher.jsx
      │  ├─ OrderScanModal.jsx        ← กล่องสแกน Complete(issue) / Verify(return) เฉพาะช่างที่รับงาน + ยืนยัน 2 คน (ไม่มี password)
      │  └─ ui/                       ← Button, Card, Modal, Field, DataTable, Tabs, Toast, ...
      └─ pages/
         ├─ LoginPage.jsx
         ├─ DashboardPage.jsx         ← read-only 1 จอ: StatCard 4 ตัว + สรุป Fixture/งาน
         ├─ RequestPage.jsx           ← Change Model / Replace / Breakdown
         ├─ OrderPage.jsx             ← Progress = issue, Verify = return
         ├─ FixtureListPage.jsx
         ├─ EditFixturePage.jsx
         ├─ PMPage.jsx                ← ราย Line+Model + 4M upload ต่อกลุ่ม
         ├─ RegisterFixturePage.jsx
         └─ HistoryPage.jsx
```

---

## 3. Environment & การรัน

```bash
npm install
npm run dev        # API :3000 + Vite :8000 (ผู้ใช้รันเองใน VSCode)
npm run build      # vite build → dist/
npm start          # Express serve dist/ ที่ :3000
npm run lint       # eslint .
npm run reset-db -- --yes          # ล้าง fixturelist, request, history
npm run reset-db -- --all --yes    # + users (server จะ seed admin ใหม่)
```

> ระหว่างการพัฒนา **ห้าม start server แทนผู้ใช้** — user รัน `npm run dev` เอง
> หลังแก้ `server.js` ต้องให้ผู้ใช้ **restart `npm run dev`** ก่อนทดสอบ API ใหม่

| ตัวแปร | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|
| `PORT` | `3000` | Express API |
| `MONGO_URL` | `mongodb://10.192.8.238:27017/Fixture_Management` | DB หลัก |
| `FAN2_MONGO_URL` | `mongodb://10.192.8.238:27017/FAN2` | DB ภายนอกสำหรับ dropdown Location/ModelNEW |
| `VITE_API_URL` (frontend) | `/api` | Vite proxy ส่งต่อที่ `localhost:3000` |

DB หลักต้องเป็น **`Fixture_Management`** (มี underscore)  
ถ้า `users` ว่าง server จะ seed `admin / admin` (status `Admin`) อัตโนมัติ

Migration user: รัน `node scripts/migrate-users.mjs` จาก `my-react-app`  
(source `FixtureManagement.users` → target `Fixture_Management.users`; `signed`→`Signed`, `unsigned`→`Unsigned`, `Authorization=admin`→`Admin`; merge ตาม `empId` และคง `dept` / `request_id` เดิม)

---

## 4. Schema / Data Model

### 4.1 MongoDB collections (DB `Fixture_Management`)

#### `users`

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `empId` | String | **required**, index, รหัสพนักงาน (ใช้ login/actor) |
| `pass` | String | **required**, เก็บ plain text (ยังไม่ hash) |
| `name` / `lastname` / `dept` | String | ข้อมูลผู้ใช้ |
| `status` | String | `Unsigned` — login ต้อง `Signed` / `Admin` |
| `request_id` | String | request ล่าสุดที่ user กำลังดำเนินการ |

⚠️ `register()` พยายามเขียน `username` แต่ **ไม่มีใน schema** → ถูก Mongoose strict ตัดทิ้ง

#### `fixtureDetail` — แหล่งความจริงของ Fixture แต่ละตัว

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `sn` | String | **required, unique, index** — SN เต็ม เช่น `TB53AO0007-01` |
| `line` / `model` | String | แหล่งความจริงของหน้า Edit (เขียนตอน Register/Import ยืนยัน) |
| `status` | String | `In Stock` (index) — ดู enum §4.3 |
| `type` | String | **Process Type** — `Mainline / Rotor / Winding / Function` (คีย์ DB/API ยังเป็น `type`) |
| `step` / `process` / `position` | String | Master ตาม `fixtureMeta.js` |
| `usage.current` / `usage.max` | Number | ใช้งานสะสม / กำหนด PM ที่ 80% |
| `usage.exp` | String | วันครบกำหนด PM (`YYYY-MM-DD`) |
| `usage.storage` / `usage.usedLine` | String | ตำแหน่งเก็บ / Line ที่จ่ายไปใช้งาน |
| `usage.inUseAt` | String | **จุดเริ่มรอบ PM 90 วัน** — วันล่าสุดที่ `In Stock → In Use` |
| `usage.currentModel` / `usage.changeModel` | String | โมเดลที่ใช้ / โมเดลปลายทางของ model swap |
| `fixtureBase` / `revision` | String | base SN (ตัด suffix `-NN`) / revision |
| `pmDate` | String | วันที่เริ่ม PM / เข้าซ่อม |
| `pmForms` | [String] | URL เอกสาร 4M `/uploads/pm/<file>` (บังคับเมื่อ overdue >3 วัน) |
| `pmRequestedDays` | Number | จำนวนวันที่ขอทำ PM (เลือกตอนแนบ 4M) |
| `pmApproval` | String | `'' / NotRequired / Pending / Approved / Rejected` |
| `pmApprovedBy` / `pmApprovedAt` | String | ผู้อนุมัติ / เวลาที่ Admin กด |
| `pmRunId` | String | รหัสรอบ PM (`PM · วันที่ · Line · Model`) — ใช้รวม event ของ PM run เดียวกันใน History |
| `registered` | personSchema | ผู้ลงทะเบียน |

`findFixture()` / `flattenFixtureDetails()` อ่าน `fixtureDetail` ก่อน; `fixtureList.fixtureInfo` เป็น fallback เฉพาะข้อมูลเก่า

#### `fixtureList` — Master matrix ตาม Line/Model/Position

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `line` / `model` | String | required, index |
| `fixtureInfo[]` | subdoc | `{ step, process, position, sn: [String] }` — `sn` เป็น **base SN** |
| `fixtureInfo[].count` | Number | ⚠️ ไม่ได้ประกาศใน schema → ถูกตัดทิ้งตอน import |

#### `storages`

`{ location (required, unique), desc }`

#### `request` — ใบงาน / Order

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `request_id` | String | required, unique — `REQ` + YYMMDD + running 3 หลัก |
| `line` / `currentModel` / `changeModel` | String | Line / Model A / Model B |
| `type` | String | `Change Model` / `Replace` / `Breakdown` |
| `requestType` / `step` / `dueDate` | String | Process Type / step / due date จากฟอร์ม |
| `queueDate` / `queueSlot` | String | คิว Change Model (`YYYY-MM-DD`, `07:00`…`15:00`) — **Replace ไม่ใช้คิว** |
| `replaceQty` | Number | จำนวน Fixture ที่ต้องเปลี่ยน (integer ≥ 1) — เฉพาะ Replace |
| `items` / `action` | [String] / String | เก็บผล actions ของ Breakdown (ประกาศใน schema แล้ว) |
| `status` | String | `Waiting / Progress / Hold / Verify / Done / Rejected` |
| `desc` | String | auto `A → B` สำหรับ model swap |
| `breakdownItems[]` | `{ sn, symptom }` | รายการ Fixture เสีย |
| `requestInfo` / `acceptInfo` / `issueInfo` / `verifyInfo` | personSchema | **assignee เท่านั้นทำ barcode scan ทุก phase (issue + return) / reset / confirm-scan**; verify approve 2 คน (requester + assignee) **ไม่ใส่รหัสผ่าน** |
| `returnApprovals[]` | `{ role, empId, name, lastname, date }` | `role = requester \| assignee`; ต้องครบ 2 role ก่อน apply return + ตั้ง `Done` |
| `issueDone` / `returnDone` | Boolean | issue ตอน confirm-scan, return ตอน verify ครบ 2 คน |
| `scannedIssue[]` / `returnedItems[]` | [String] | SN ที่จ่าย / คืน |
| `scanMatches[]` | array | `{ sn, scannedSn, planSn, planIndex, action, position, process }` |

#### `history`

`{ sn, request_id, pm_run_id, action, detail, line, model, empId, name, lastname, date }`

`recordHistory(entry, user)` เขียน collection จริงทุก event (Request / Accept / Hold / Complete / Issue / Return / Verify / PM / Edit / Order …) — เมื่อ Verify ครบ 2 role จะมี history ของ Order นั้นครบชุด รวม record สรุปปิดงานพร้อมรายการ SN และชื่อผู้ยืนยัน; event ของ PM run ใหม่จะพก `pm_run_id` เพื่อให้ History รวมเป็นเอกสารเดียวต่อรอบ

### 4.2 External DB `FAN2` (read-only)

| Collection | ฟิลด์ | ใช้ทำอะไร |
|---|---|---|
| `Location` | `location` | dropdown Line ใน Register + Request |
| `ModelNEW` | `model` | dropdown Model ใน Register + Request |

### 4.3 Enum / ค่าที่ใช้บ่อย

- **Fixture status**: `In Stock`, `In Use`, `PM`, `PM Pending`, `Maintenance`, `Scrape`, `PR`, `PR Ready`, `Replaced`
- **Request status**: `Waiting → Progress → Hold → Verify → Done` (+ `Rejected`)
- **Request type**: `Change Model`, `Breakdown` (Replace removed)
- **Process Type**: `Mainline`, `Rotor`, `Winding`, `Function`
- **PM states**: `tracked` (>3 วัน — ต้องแนบ 4M), `pre-alert` (1–3), `on-due`, `overdue-remind` (0–3), `over-due` (>3), `usage-remind` (≥80%)
- **90-day clock**: ทุก `In Stock → In Use` ตั้ง `usage.inUseAt = วันนี้` + `usage.exp = +90 วัน` (confirm-scan, Issue Spare, PUT status→In Use); ครบกำหนด → status `PM`; Verify OK หลังซ่อมกลับ `In Stock` และเคลียร์นาฬิกา รอจ่ายออกจึงเริ่มรอบใหม่
- **Order/NG lifecycle**: `Scrape → PR → PR Ready → Replaced` + `Restock` (API มี แต่ frontend ไม่เรียก)

---

## 5. ข้อมูลต่ำสุดที่ต้องมี

| หน้า / Flow | ต้องมีข้อมูลอะไร |
|---|---|
| Login | user ใน `users` ที่ `status = Signed` หรือ `Admin` (`Unsigned` เข้าไม่ได้) |
| Request | FAN2 `Location` + `ModelNEW`; Change Model ต้องมีคิวว่างวันนี้; Replace ไม่ต้องการคิว |
| Order / Scan | `phase=issue` ต้องเป็น `acceptInfo.empId`, `phase=return` ต้องเป็น `requestInfo.empId`; SN ต้องมีใน `fixtureDetail` แบบเต็ม |
| PM | fixture อยู่ `In Use` / `PM` / `PM Pending` / `Maintenance`; ถ้าเกิน 3 วันและยังไม่มี `pmForms` → ต้องแนบ 4M ก่อนแก้ไข |
| Import | Master `fixtureMeta.js` 49 row + `fixtureDetail.fixtureBase` ตรง base SN ใน Excel |
| Sticker/4M | อัปโหลดไป `uploads/pm` และ serve `/uploads/pm/<file>` |

---

## 6. API Surface

### 6.1 Auth / User

`POST /api/login`, `POST /api/register`, `GET /api/me`, `GET|PUT|DELETE /api/users[/:id]`

### 6.2 Fixture master / register / edit

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| GET | `/api/fixturelist/options` | `{ lines, models, modelsByLine }` |
| GET | `/api/fixturelist?line=&model=` | raw fixtureList docs |
| POST | `/api/fixturelist/import` | ตรง Master → import; ไม่ตรง → `409 needsConfirm` + `issues[]` พร้อม modal ยืนยัน; **ถ้า fixture ไหนเกิน PM 7 วันและไม่มี 4M → 409 blocked ก่อน** |
| GET | `/api/fixture-stats` | `{ total, counts }` |
| GET | `/api/fixtures/detail` | **Edit rows** — detail ก่อน, fixtureList fallback |
| GET | `/api/fixtures/detail/options` | options ทุกช่องของ Edit/Fixture List filter |
| GET | `/api/fixtures?...` | flatten + filter (10 ตัวกรอง, `status` comma-separated exact) |
| GET | `/api/fixtures/options` | distinct options |
| GET | `/api/fixtures/:sn` | 404 ถ้าไม่มี |
| POST | `/api/fixtures` | 409 ถ้า SN ซ้ำ (If Exist) |
| PUT | `/api/fixtures/:sn` | แก้ detail + `fixtureInfo[]`; **4M guard 409**; status→In Use ตั้ง 90-day clock |
| POST | `/api/fixtures/due-date` | อัปเดต `usage.exp` หลาย SN เป็นวันเดียวกัน; **4M guard 409** |
| DELETE | `/api/fixtures/:sn` | ลบ detail + `$pull` SN ออกจาก fixtureList; **4M guard 409** |
| GET | `/api/fixturelist/compare?line=&from=&to=` | `{ issue, return, keep, total, missing }` |
| GET | `/api/fan2/locations`, `/api/fan2/models` | dropdown From FAN2 Mongo |
| GET/POST/PUT/DELETE | `/api/storages[/:id]` | CRUD ตำแหน่งเก็บ |

### 6.3 Request / Order / Scan

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| GET | `/api/requests?status=&type=&empId=` | รายการคำขอ |
| GET | `/api/requests/change-model-slots?date=` | 9 slot `07:00–08:00`…`15:00–16:00`, `{value,label,available,requestId,line,currentModel,changeModel}`; **คิวเต็มถ้ามี request ใดก็ตามในวันนั้น ไม่สน status** |
| GET | `/api/requests/:requestId` | รายละเอียดคำขอ |
| POST | `/api/requests` | กัน request ซ้ำ + กันคิว Change Model ซ้ำ → สร้าง `REQ...`; Replace ตรวจคิวไม่ทำให้คิวเต็ม |
| PUT | `/api/requests/:id/accept` | Waiting/Hold → Progress |
| PUT | `/api/requests/:id/hold` | Progress → Hold |
| PUT | `/api/requests/:id/reject` | Waiting/Hold → Rejected |
| PUT | `/api/requests/:id/complete` | API มี แต่ UI ใช้ scan flow |
| GET | `/api/requests/:id/scan-plan` | `{ plan, matches }` (issue + return) |
| POST | `/api/requests/:id/reset-scan` | รับ `phase` → ล้าง `scanMatches` เฉพาะ phase นั้น (**assignee เท่านั้น** ทั้ง issue/return) |
| POST | `/api/requests/:id/scan` | รับ `phase:'issue'|'return'` → **assignee เท่านั้น**; เลือกเฉพาะ plan ฝั่งนั้น; base ซ้ำใช้ `planIndex`; บันทึก match อย่างเดียว |
| POST | `/api/requests/:id/confirm-scan` | **จ่ายอย่างเดียว** → `issueDone`, `status=Verify`, ตั้ง 90-day clock; return ยังไม่แตะ fixture; **4M guard 409** |
| PUT | `/api/requests/:id/breakdown` | `action = Maintenance \| Issue Spare` → Verify |
| PUT | `/api/requests/:id/verify` | **requester + assignee** (ไม่ต้อง login/รหัสผ่าน); ตรวจ return scan ที่ช่างทำครบ → บันทึก approval ตาม role → ครบ 2 คนจึง apply return → In Stock + clear usage; ตั้ง `Done` |
| DELETE | `/api/requests/:id` | ลบคำขอ |

**Guard ข้อความสำคัญ**

- `403 เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้` (issue + return — ทุกการสแกนใน Order)
- `403 เฉพาะผู้ขอหรือช่างที่รับงานเท่านั้นที่ยืนยันการคืนได้` (Verify approve)
- `409 คิว <HH:00–HH:00> วันที่ <YYYY-MM-DD> ถูกคำขอ <REQ...> ใช้งานอยู่ กรุณาเลือกคิวอื่น`
- `409 มีคำขอ <REQ...> ที่ยังดำเนินการอยู่สำหรับ <Change Model|Replace> <line> · <A> → <B>` (duplicate นับเฉพาะ `Waiting/Progress/Hold/Verify`)
- `409 Fixture <SN> เกินกำหนด PM <n> วัน — กรุณาแนบเอกสาร 4M ก่อนแก้ไขข้อมูล`
- `409 สแกนจ่ายไม่ครบ — ยังขาด <n> ตัว (...)`
- `409 สแกนคืนไม่ครบ — ยังขาด <n> ตัว (...)`

### 6.4 PM / Maintenance / Order(NG)

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| GET | `/api/pm` | sync ครบกำหนด → `PM`; อ่าน `In Use,PM,PM Pending,Maintenance` + `pmStates`, `pmOverdueDays`, `needs4M`, `usagePercent` |
| POST | `/api/pm/plan` | body `{line, model, date}` → ทุก fixture `PM` ที่พร้อมใน **Line+Model เดียวกัน** เป็น `Maintenance` + `pmDate`; **ไม่มี plan ราย SN**; ข้ามตัวที่ติด 4M |
| POST | `/api/pm/start` | body `{sn, date}` → “กำลังทำ PM” รายตัว: `PM → Maintenance` (ต้องมี 4M ถ้าเกิน 3 วัน, ต้องไม่รอ Admin) |
| POST | `/api/pm/approve` | body `{sn, action: approve\|reject}` → เฉพาะ `status=Admin`; `PM Pending → Maintenance` หรือกลับ `PM` |
| POST | `/api/pm/extend` | legacy 4M approve +XX days; **4M guard 409** |
| POST | `/api/pm/forms` | multipart 4M ต่อ SN → `/uploads/pm/...` (low-level, UI ไม่ใช้) |
| POST | `/api/pm/forms/group` | multipart `{line, model, days, file}` → attach 4M ให้ทุกตัวที่เกิน 3 วัน; `days ≤ 7` → `PM`, `days > 7` → `PM Pending`; ปฏิเสธ group ที่ไม่มี Line/Model (ไม่ต้องใช้ 4M) |
| POST | `/api/pm/assign` | legacy management assign QA/ME/TE/PD; **4M guard 409** |
| GET | `/api/maintenance` | คิว status Maintenance |
| POST | `/api/maintenance/verify` | OK → **In Stock** + เคลียร์นาฬิกา (เริ่มใหม่ตอนจ่ายออก); NG → Scrape/PR/PR Ready/Replaced; **4M guard 409** |
| POST | `/api/maintenance/verify/bulk` | body `{sns[], result: OK\|NG, outcome?, user}` → ตรวจทีละ SN, ตอบ `{count, processed, skipped, message}`; ตัวที่ถูก 4M guard ข้ามแล้วรายงาน ไม่ทำให้ทั้งกลุ่มพัง |
| GET | `/api/orders` | fixture ใน status NG chain |
| POST | `/api/orders/:sn/action` | Accept/Reject/Hold/Issue/Verify/Reopen/Restock (ยังไม่มี UI) |

> `/api/issue`, `/api/return` **ถูกลบแล้ว** — ห้ามเรียก/อ้างอิงอีก

### 6.5 Dashboard / History / Health

`GET /api/dashboard` → อ่านจาก `flattenFixtureDetails()` (ทุก fixtureDetail ไม่ใช่เฉพาะ fixtureList) และตอบ:
- KPI/aggregate: `total`, `counts`, `orderCount`, `requestStats`, `requestTypeStats`, `byLine`, `byModel`, `byProcess`, `activeByLine`, `activeByModel`, `activeByProcess`, `lines`
- Work lists: `dueRequests`, `pmAlerts`, `maintenanceQueue`, `orderFixtures` (ทั้งหมดตาม status)
- Page summaries: `lineStats` (ต่อ Line), `storageStats` (ต่อ Storage), `pmStateCounts`, `recentFixtures` (8 ล่าสุดตาม `registered.date`), `recentRequests` (ทั้งหมด), `recentHistory` (20 ล่าสุด), `historyCount`
`GET /api/history?...` (limit ≤ 1000) รองรับ `section=order|pm` (action sets คู่กับ `HISTORY_SECTION_ACTIONS` ใน `constants.js`), `GET /api/health`

Frontend wrapper ทั้งหมดอยู่ใน `src/lib/api.js` (`api`, `ApiError`)

---

## 7. Business Flow ละเอียด

### 7.1 Authentication

- Login ด้วย empId + pass → `POST /api/login`; status ต้อง `Signed`/`Admin` (`Unsigned` เข้าไม่ได้)
- เก็บ session ลง localStorage แล้วเข้า `dashboard`
- **Password gate** ของ Order/PM ไม่มี endpoint พิเศษ — ใช้ `api.login({ empId: user.userId, pass })` เช็คซ้ำก่อน action จริง
- Complete/Scan **ไม่มี password**

### 7.2 Register Fixture

- โหลด `fan2Locations` + `fan2Models` + `storages` แบบ `Promise.allSettled`
- กรอก Line/Model/Step/Process/Position/**Process Type**/Storage/Revision/Status/Exp/Current/Max
- `fixtureBase` คำนวณจาก SN (ข้อความก่อน `-`)
- สแกน SN เต็ม → ถ้ามีในระบบแล้วแถวเป็นสีแดง + `≠` ต่อคอลัมน์ + `⚠ มีในระบบแล้ว`; ห้ามลงทะเบียนจนกว่าจะลบแถวซ้ำ
- กล่อง SN autofocus หลังเพิ่ม/ล้างเพื่อสแกนต่อเนื่อง

### 7.3 สร้างคำขอ (Request Page)

- **Line/Model จาก FAN2 Mongo เดิม** (`Location.location` / `ModelNEW.model`) แบบ flat list เหมือน Register
- ประเภทงาน 3 ปุ่ม: `Change Model`, `Replace`, `Breakdown`
- **Change Model**: เลือก Model A→B + **คิว 1 ชม. ของวันนี้** (ไม่มีช่องวันที่) → ส่ง `queueDate/queueSlot`
  - 9 คิว `07:00–08:00`…`15:00–16:00`, รวมทุก Line, reset ทุกวัน
  - dropdown แสดงสถานะ inline: `เลือกคิว (n คิวเลือกได้)`, `HH:00–HH:00 · เลือกได้`, `HH:00–HH:00 · เต็ม (REQ...) — เลือกไม่ได้` (disabled)
  - **คิวเต็มถ้ามี request ใดก็ตามส่งมาที่ slot นั้นในวันนั้น — ไม่สน status** (พัง/เสร็จแล้วยังทำให้คิวเต็มตามวันที่)
- **Replace**: เหมือน Change Model (Line A→B, compare เดียวกัน) **แต่ไม่ใช้คิว** และต้องระบุ `replaceQty` integer ≥ 1
- **Breakdown**: หลายแถว `{ sn, symptom }`
- กัน duplicate ฝั่ง server:
  - นับเฉพาะ status `Waiting/Progress/Hold/Verify`; `Rejected/Done` ขอใหม่ได้
  - Breakdown: SN ซ้ำกับคำขอค้าง → 409
  - Model swap (`Change Model` หรือ `Replace`): คู่ `line + currentModel + changeModel` ซ้ำ → 409; ตรวจข้ามทั้ง 2 ประเภท

### 7.4 Compare Model A→B (`compareModels`)

- group `fixtureList` ของ line+from / line+to ตาม `position`
- `issue` = SN ที่มีใน B แต่ไม่มีใน A; `return` = SN ที่มีใน A แต่ไม่มีใน B; `keep` = ใช้ร่วมกัน
- ใช้ร่วมกันทั้ง Change Model และ Replace
- **Fallback เมื่อ compare ว่างเปล่าทั้ง 3 กลุ่ม** (`issue/return/keep` ได้ 0): ใช้ `fixtureDetail` ที่ `line + model` ตรงกันแทน — **จ่าย fixture ของ `changeModel` (รุ่นปลายทาง)** และ **คืน fixture ของ `currentModel` (รุ่นเดิม) ทั้งหมด**; กัน SN ซ้ำโดยตัด SN ที่อยู่ในฝั่งจ่ายออกจากฝั่งคืน; plan แต่ละตัวมี `fallback:true` → modal แสดงคำอธิบาย fallback

### 7.5 Order / Complete–Scan / Verify

```
Waiting ──Accept──► Progress ──Scan+ตกลง(issue)──► Verify ──Scan return+ยืนยัน 2 คน──► Done
   │                   │                                  ▲
   └──Reject──► Rejected└──Hold──► Hold ──Accept───────────┘
```

- Accept/Hold/Reject ผ่าน password gate; **Verify ไม่มี password**; ทุก scan/reset/confirm ไม่มี password
- **Barcode scan ทุกตัวใน Order (issue + return) เฉพาะ `acceptInfo/issueInfo.empId` (ช่างที่รับงาน)**; **Verify approve ได้ทั้ง `requestInfo.empId` (ผู้ขอ) และ `acceptInfo/issueInfo.empId` (ช่าง)** — ต้องครบ 2 คน; ผู้ขอไม่สแกน
- **เฉพาะ `Progress` ที่กันรับงานอื่น** — ช่างที่อยู่ `Verify` หรือ `Hold` รับงานอื่นได้

**Progress (จ่ายอย่างเดียว)**

1. `GET scan-plan` → UI กรองเฉพาะ `action === 'issue'` แสดงในตาราง/การ์ด
2. `POST scan` พร้อม `phase:'issue'` → เฉSN เต็ม; base-only ปฏิเสธ; ใช้ `fixtureBase` + `planIndex` กัน base ซ้ำ; ต้องเป็น `In Stock`; บันทึกแค่ `scanMatches`
3. `POST reset-scan` พร้อม `phase:'issue'` ล้าง matches ฝั่งจ่าย (ไม่แตะฝั่งคืน)
4. `POST confirm-scan`: ตรวจ issue ครบ → status `In Use`, `usage.current +1`, `usedLine`, `usage.inUseAt = วันนี้`, `usage.exp = +90 วัน`, `currentModel/changeModel`; เก็บ `scannedIssue`; `returnDone=false`; status = `Verify`

**Verify (สแกนรับคืน + ยืนยัน 2 คน + ปิดงาน)**

1. กด **Verify / ยืนยัน** (requester) หรือ **ยืนยันรับคืน** (assignee) → เปิด `OrderScanModal phase="return"` modal เดียวกัน (ไม่มีช่องรหัสผ่าน)
2. UI กรอง plan/matches เฉพาะ `action === 'return'`; **เฉพาะ assignee (ช่างที่รับงาน) สแกน/รีเซ็ตได้**; SN เต็ม, base ซ้ำใช้ `planIndex`, ต้องไม่เป็น `In Stock`; บันทึก `scanMatches`; requester เห็นรายการแบบ read-only และยืนยันได้เมื่อสแกนครบ
3. `POST reset-scan` พร้อม `phase:'return'` ล้างเฉพาะ matches ฝั่งคืน (assignee เท่านั้น)
4. กดยืนยัน → `PUT verify` (ไม่เรียก `api.login`) → server ตรวจ return scan ครบ → บันทึก `returnApprovals` ตาม role ของผู้กด → ถ้ายังไม่ครบ 2 role ตอบ `บันทึกการยืนยัน... รอ...` และ status ยังเป็น `Verify`
5. เมื่อครบ `requester` + `assignee` → apply **เฉพาะ SN ที่สแกน** → `In Stock`, reset `usage.current=0`, ล้าง `usedLine/inUseAt/currentModel/changeModel`, บันทึก `returnedItems`, `returnDone=true`, history Verify, status = `Done` พร้อม message `Verify สำเร็จ — <id> ปิดงานแล้ว`
6. ถ้าสแกนไม่ครบ server ตอบ `409 สแกนคืนไม่ครบ — ยังขาด <n> ตัว (...)`

**กฎพิเศษของ Breakdown ใน scan-plan**

- ฝ่ายจ่าย (Progress): plan สร้างจาก base ของ `breakdownItems` แต่อนุญาตสแกน **สแปร์ตัวใดก็ได้** ที่ `fixtureBase` เดียวกันและมีอยู่ใน `fixtureDetail` (ต้อง `In Stock`); plan item มี `allowSameBase:true`, `base`
- ฝ่ายคืน (Verify): plan item เป็น **SN ตัวเสียที่ระบุใน `breakdownItems` แบบตรงตัว** (`strictSn:true`) — ห้ามสแกนสแปร์แทน; `/scan` และ `/verify` เปรียบเทียบ exact SN โดยไม่ใช้ base fallback
- UI `MatchList` แสดง SN ที่สแกนจริง underneath เมื่อต่างจาก SN ใน plan (กรณีสแปร์ base เดียวกัน) และแสดง banner อธิบายกฎทั้ง 2 ฝั่ง

**Order card** แสดง line + slot `A01 ● 07:00–08:00` (เฉพาะ Change Model), badge ประเภท (`Replace` แยกชัด), `replaceQty` สำหรับ Replace, chip approval ของผู้ขอ/ช่างในสถานะ Verify

**Information (Change Model)** แสดงภาพรวม 3 กลุ่มพร้อมสถานะสแกน: **จ่าย / ใช้ได้ (keep) / คืน** (อ่าน `/scan-plan` รวม `/fixturelist/compare`)

### 7.6 Breakdown

- ต้องการ `breakdownItems` (SN เต็ม)
- Flow หลักผ่าน Order scan เหมือนประเภทอื่น: Progress = จ่ายสแปร์ base เดียวกัน (ได้หลายตัวตาม base ซ้ำ), Verify = สแกนคืน **SN ตัวเสียใน `breakdownItems` เท่านั้น** แล้ว approve 2 คน
- `PUT /breakdown` (`Maintenance` / `Issue Spare`) ยังเป็น API ทางเลือกสำหรับ action เดิม → Verify; ทั้ง 2 ทางมี **4M guard**
- Spare ที่จ่ายต้องมีอยู่ในระบบ (`fixtureDetail`) และอยู่ `In Stock` — base-only scan ยังปฏิเสธ

### 7.7 Import Fixture List + ตรวจ step/process/position

1. อ่าน Excel → `buildFixtureListItems(rows)` → `api.importFixtureList(items)`
2. Server normalize เทียบ Master `fixtureMeta.js` (49 row) ด้วย position
3. หา `fixtureDetail` ตาม `fixtureBase`; ถ้าไม่ตรง → `409 needsConfirm` + `issues[]`
4. Modal แสดง current → desired; กดยืนยัน → `confirm:true` อัปเดต detail แล้ว import ต่อ
5. ถ้ามี fixture เกิน PM 7 วันไม่มี 4M → 409 block ก่อน Import

### 7.8 Fixture List เป็นตารางอย่างเดียว

- ไม่มี detail modal; modal เดียวคือ Import confirmation
- `view = fixture`: 10 dropdown server-side filter จาก `/api/fixtures/detail/options` + storages + **ช่อง SN แบบพิมพ์บางส่วน** (Process→Position dependency, Search/Clear)
- `view = list`: matrix Line×Position + ช่องค้นหา SN/Model/Position; **ช่อง SN ใน filter ใช้กรอง matrix ได้ด้วย** (ต้องกด Search) — ถ้า base SN เดียวกันถูกอ้างในหลาย Model ของ `fixtureList` จะเห็นหลาย Model ตามข้อมูลจริง
- หน้า Edit (Fixture/Due Date) ใช้ filter card เดียวกันและมีช่อง SN เพิ่มแล้ว

### 7.9 PM Checklist Phase 2 (ราย Line+Model + 4M)

- `GET /api/pm` sync ครบ 90 วัน → `PM` แล้วอ่าน `In Use,PM,PM Pending,Maintenance` + คำนวณ states/overdue/`needs4M`
- **Layout ใหม่:** `StatCard` 4 ตัว (ติด 4M / รอ Admin / พร้อม PM / รอ Verify) อยู่บนสุด → **ปฏิทินกะทัดรัดแสดงตลอด** (cell 62–68px, chip ต่อ Line พร้อมจำนวน Fixture กดข้ามไป worklist) → **งานที่ต้องทำตอนนี้** ลำดับเดียว `ติด 4M` → `รอ Admin อนุมัติ` → `กำลังทำ PM ทั้งกลุ่ม` → `ตรวจรับคิวซ่อม`; worklist เต็มยุบหลังปุ่ม **ดูรายการทั้งหมดตาม Line → Model**
- **Verify queue ทำใหม่:** group ตาม `Line → Model`, มี checkbox เลือกได้ทั้ง Line / ทั้ง Model / รายตัว แล้วกด **Done (OK)** หรือ **NG** ครั้งเดียว (ผ่าน `/api/maintenance/verify/bulk`, password gate)
- **PM Worklist แสดงเป็น Line ก่อน** — `Line` → ขยาย → `Model` → รายการ Fixture (SN, status, PM signal, exp, PM date, usage bar, ลิงก์ 4M) + ปุ่ม **แนบ 4M กลุ่มนี้** / **กำลังทำ PM กลุ่มนี้**; ปุ่มรายตัวย้ายไปอยู่ในงานวันที่แล้ว
- **ลำดับ status ใหม่:**
  1. `In Stock → In Use` เริ่มนาฬิกา 90 วัน (`usage.inUseAt` + `usage.exp`)
  2. ครบ `usage.exp` → `syncPmStatuses()` เปลี่ยนเป็น `PM`
  3. เกิน 3 วัน → บังคับแนบ 4M; ตอนแนบต้องเลือก **PM กี่วัน**
     - `≤ 7 วัน` → ยังเป็น `PM` รอกด **กำลังทำ PM**
     - `> 7 วัน` → `PM Pending` รอ Admin **ยืนยัน / Reject** (รหัสผ่าน) ก่อนเข้าซ่อม
  4. กด **กำลังทำ PM** (password) → `PM → Maintenance`; ใช้ได้เฉพาะของที่ไม่ติด 4M และไม่รอ Admin
  5. Verify OK → `In Stock` + เคลียร์นาฬิกา; คราวหน้าที่สแกนจ่ายออกจึงเริ่ม 90 วันใหม่
  6. Verify NG → `Scrape / PR / PR Ready / Replaced` ตามเดิม (ไม่มีปุ่ม Scrap แยก)
- **แนบ 4M ต่อกลุ่ม** ด้วย `POST /api/pm/forms/group` → attach ให้ทุก fixture ที่ overdue >3 วันใน Line+Model เดียวกัน พร้อม `days` และ `needsApproval`
- **Fixture ที่ไม่มีทั้ง Line และ Model (หรือเป็น `N/A`) ไม่ถูกนับและไม่ถูกบล็อกด้วย 4M** (`hasPmGroup()` ใน server + `hasGroupOf()` ใน PMPage); `POST /api/pm/forms/group` ตอบ 400 `Fixture ที่ไม่มี Line / Model ไม่ต้องแนบเอกสาร 4M`; `/api/pm/plan` อนุญาต group เปล่าได้ถ้าส่ง key มาชัดเจน
- ไม่มีเอกสาร → **แก้ข้อมูล fixture ตัวนั้นไม่ได้เลย** (PUT/due-date/delete/import/pm plan/extend/assign/maintenance verify/verify return ถูก guard 409) ข้อความ: `Fixture <SN> เกินกำหนด PM <n> วัน — กรุณาแนบเอกสาร 4M ก่อนแก้ไขข้อมูล` — **เฉพาะ fixture ที่มี Line+Model เท่านั้น**
- `POST /api/pm/plan` ต้องอ่าน `{line, model, date}` (ไม่ใช่ `sn`) แล้วกรอง fixture `PM` ในกลุ่ม, ข้ามตัวที่ `needs4M`, ตอบ `{count, skipped, message}`; ถ้าอ่าน `req.body.sn` จะตอบ 404 `ไม่พบ Serial Number นี้` (bug ที่เคยเกิด)
- PMPage แสดงลิงก์ `pmForms`, ข้อความบล็อกต่อกลุ่ม, แผงอัปโหลด 4M พร้อมช่อง **PM กี่วัน** (รับ PDF/Word/Excel/PPT/ภาพ ≤25MB), ปุ่ม Approve/Reject เฉพาะ Admin
- ทุกการเปลี่ยนสถานะ PM บันทึก `recordHistory`: `PM Due`, `4M Document`, `4M Approval Request`, `4M Approve`, `Start PM`, `PM Approve`, `PM Reject`, `PM OK`, `PM NG`
- **PM run document:** `/api/pm/plan`, `/api/pm/start`, `/api/pm/approve` สร้าง `pmRunId = PM · PM date · Line · Model` เก็บใน fixtureDetail และเขียน `pm_run_id` ลง History; `maintenance verify` อ่านรหัสนี้ก่อนล้าง แล้วเขียน `PM OK`/`PM NG` พร้อม `pm_run_id` — ทำให้ History รวมทุก SN ของ Line+Model รอบเดียวกันเป็น 1 ใบ; event เก่าที่ไม่มีรหัสใช้ fallback ตาม Line+Model+วันที่เริ่ม PM

### 7.10 PM & Maintenance Verify

- `GET /api/maintenance` → คิว Maintenance
- `POST /api/maintenance/verify` (รายตัว) และ `/api/maintenance/verify/bulk` (หลายตัว) ใช้ helper เดียวกัน `verifyMaintenanceFixture()`
- **Verify OK** (password) → `In Stock`, เคลียร์ `pmDate`/`pmApproval`/`usage.inUseAt`/`usage.exp`/`usage.current`, พิมพ์ sticker เฉพาะเมื่อเลือก 1 ตัว; **ไม่ตั้งวัน PM ใหม่ตอนนี้**
- **Verify NG** → `Scrape / PR / PR Ready / Replaced`, `pmDate:''`
- หน้า PM group Verify เป็น `Line → Model → checkbox` + ปุ่ม **Done (OK) / NG**; ตัวที่โดน guard จะโชว์ใน toast `ข้าม n ตัว` ไม่บล็อกตัวอื่น

### 7.11 Edit Fixture

- แหล่งข้อมูล `fixtureDetail` (fallback เฉพาะข้อมูลเก่า)
- filter zone ซ้าย (320–400px) + result table ขวา (`lg:h-[500px]`), table-only ไม่มี modal/column Edit
- คลิกแถว → โหลด editor ด้านล่าง + auto-scroll
- **Status อ่านอย่างเดียว**, **Line/Model แก้ได้**, `type` แสดงเป็น **Process Type**, **Fixture Base ล็อก**
- dirty-field highlight (`border-amber-300 bg-amber-50`) + สรุป “Unsaved changes”
- Tab Storage (search + Refresh/Add, table ด้านล่าง) และ Tab Due Date (filter เดิม, checkbox หลายตัว, อัปเดต Exp วันเดียวทั้งชุด)
- ถ้า server ตอบ 409 จาก 4M guard → แสดง inline banner พร้อมข้อความ + ชี้ไปหน้า PM เพื่อแนบเอกสาร

### 7.12 Dashboard — Quiet operations snapshot (read-only)

โทน **quiet**: การ์ดขาว, ตัวอักษร slate, accent น้ำเงินเฉพาะจุดสำคัญ + สีส้มสำหรับ PM overdue, ใช้ `StatCard` ตัวเดียวกับหน้าอื่น (ไม่มี meter bar, ไม่มี gradient, ไม่มีกราฟ)

โครงสร้าง (ไม่มีปุ่ม/ลิงก์/quick actions ในเนื้อหา — มีเฉพาะ sidebar/nav ของ shell):

1. **PageHeader** — ชื่อหน้า + คำอธิบายสั้น ๆ ไม่มี actions
2. **KPI 4 ตัว** — Total fixtures / In use / Active requests / PM overdue
3. **สรุป 2 การ์ด** — สถานะ Fixture (In Stock / In Use / Maintenance / Order–NG) และงานค้าง (Waiting / Progress / Hold / Verify / Due soon) แบบ `InfoRow`

ข้อมูลทั้งหมดมาจาก `/api/dashboard` (`counts`, `requestStats`, `dueRequests`, `pmAlerts`) — ไม่เรียก API อื่นเพิ่ม
ห้ามเพิ่ม retry button, action button, หรือลิงก์ภายใน Dashboard; `ErrorState` ก็ไม่มีปุ่ม Retry; เป้าหมายคือเห็นจบใน 1 หน้าจอ

---

## 8. หน้าแต่ละหน้าทำอะไรได้บ้าง

| หน้า (key) | สิ่งที่ทำได้ | API หลัก | Password gate |
|---|---|---|---|
| Login (pre-auth) | Login, สมัครสมาชิก | `login`, `register` | login เอง |
| Dashboard (`dashboard`) | read-only 1 จอ: PageHeader + `StatCard` 4 ตัว + สรุป Fixture/งาน 2 การ์ด; ไม่มีปุ่มหรือลิงก์ในเนื้อหา | `dashboard` | ไม่ |
| Request (`request`) | Change Model (มีคิว) / Breakdown; Line/Model จาก FAN2; ช่องเลือกเป็นลำดับ Line → Model เดิม → Model ใหม่ → คิว | `fan2Locations`, `fan2Models`, `changeModelSlots`, `createRequest` | ไม่ |
| Order (`order`) | กรองคำขอ, แสดง slot, Progress = issue scan, Verify = **ปุ่ม Verify → return scan modal (ช่างสแกน + ผู้ขอยืนยัน, ไม่มี password)**, Accept/Hold/Reject | `requests`, `scanPlan`, scan APIs, `login` | **Accept/Hold/Reject** |
| Fixture List (`fixtures`) | Import Excel + ยืนยัน mismatch, ตารางแบน/matrix, filter 10 dropdown | `fixtureList`, `editFixtures`, `editFixtureOptions`, `importFixtureList` | ไม่ |
| Edit Fixture (`edit`) | filter → table → editor, Storage, Due Date, แจ้ง 4M block | `fixtureFieldOptions`, `fixture`, `updateFixture`, `updateFixtureExpBulk`, `deleteFixture` | ไม่ |
| PM (`pm`) | **KPI → ปฏิทินกะทัดรัด → งานที่ต้องทำตอนนี้** (ติด 4M → รอ Admin → กำลังทำ PM ทั้งกลุ่ม → Verify แบบเลือกหลายตัว); worklist เต็มยุบหลัง **ดูรายการทั้งหมดตาม Line → Model**; Verify OK → In Stock | `pm`, `pmPlan`, `pmStart`, `pmApprove`, `pmUploadGroup`, `maintenance`, `maintenanceVerifyBulk`, `login` | **Start PM / Approve / Reject / Verify** |
| Register (`register`) | ลงทะเบียนแบบ queue, duplicate highlight, SN autofocus | `fan2Locations`, `fan2Models`, `storages`, `fixture`, `createFixture` | ไม่ |
| History (`history`) | **แยก 2 section**: `Order` (1 ใบ = 1 `request_id` ตั้งแต่สร้างจนปิดงาน + งานทั่วไปที่ไม่มีคำขอแยกตามวัน) และ `PM และซ่อมบำรุง` (1 ใบ = 1 PM run ของ Line/Model ผ่าน `pm_run_id`/fallback พร้อม timeline เก่า→ใหม่ + badge 4M/Approve/OK/NG; 4M/แจ้งเตือน/Reject แยก subsection); ใช้ `history({section})` | `history` | ไม่ |

> ไม่มี route-level authorization ฝั่ง server — `role` ใช้แค่แสดงป้าย ADMIN; สิทธิ์จริงอยู่ที่ server guard
>
> **Page visibility:** `status = Signed` เห็นเฉพาะ `order` / `request` และ landing ที่ `order`; `Admin` (role หรือ status) เห็นทุกหน้าเหมือนเดิม — กรองที่ `App.jsx` + `AppShell.jsx` ผ่าน helper ใน `navigation.js`, `status` ถูกเก็บใน `SESSION.status` ตอน login

---

## 9. Component / Library ที่ควรรู้

- `ui/Button`, `Card` (`Card`, `PageHeader`, `SectionHeader`, `StatCard`, `InfoRow`, `EmptyState`, `ErrorState`, `Spinner`), `Modal`, `Field`, `SearchableSelect`, `DataTable` (`embedded`), `Tabs`, `ConfirmDialog`, `Toast`
- `api.js` — wrapper ทุก endpoint; `ApiError` มี `status`/`payload`; `scanRequest(requestId, sn, user, phase)`, `resetScan(requestId, user, phase)`
- `i18n.js` — `useLabels()` (`requestType`, `fixtureStatus`, `requestStatus`, `pmState`…), `useServerMessage()` แปลข้อความ server แบบ exact + regex
- `constants.js` — `PROCESS_TYPES`, `REQUEST_TYPES` (มี `Replace`), status tones
- `navigation.js` — 4 กลุ่ม / **8 หน้า** (ไม่มี Issue/Return) + helper `allowedPagesFor` / `isPageAllowed` / `defaultPageFor` สำหรับ Signed-vs-Admin
- `format.js` — `parseDate` (รองรับ พ.ศ.), `formatDate`, `daysUntil`, `toDateInput`, `initials`

---

## 10. i18n / Font / UX details

- `localStorage.app_lang` = `TH` / `ENG` (legacy `EN` → `ENG`); `<html lang>` ตรงกัน (`th`/`en`)
- `t(th, en)` ใน LanguageContext ถูก memoize (กัน flicker/infinite reload)
- Font self-hosted `@fontsource/noto-sans-thai` 400/500/600/700 ไม่มี Google Fonts
- กล่อง SN ใน Register/Complete-Scan ล้างทุกEnter + focus กลับอัตโนมัติ
- Modal Scan เป็นโทนฟ้า ไม่มี password; Reset อยู่หัวตาราง; เฉพาะช่างที่รับงานกดสแกน/รีเซ็ตได้ ทั้ง issue และ return
- Request ฟอร์ม `max-w-4xl`; PageHeader/icon ชิดซ้าย; model swap แถวเดียว; คิวอยู่ใต้แถว Model; Breakdown เลื่อนภายใน
- Order card แสดง `Line ● slot`; Progress = issue scan, Verify = return scan modal (ช่างสแกน / ผู้ขอยืนยัน, ไม่มี password)
- PM calendar กว้างขึ้น: `minmax(560px,680px)` ที่ `xl`, `minmax(700px,820px)` ที่ `2xl`, `max-w-5xl` ก่อน `xl`, cell `min-h-[86px]`; ไม่มี workflow strip
- Dashboard read-only กระชับ: PageHeader / `StatCard` 4 ตัว (สีน้ำเงิน + สีส้มตัวเดียว) / สรุปสถานะ Fixture และงานค้างแบบ `InfoRow`; ไม่มีกราฟ ปุ่ม ลิงก์ หรือ quick actions ในเนื้อหา (ตรวจ DOM: main container มี 0 clickable)
- PM password modal เด้ง focus ไปช่องอื่นไม่ได้แล้ว: `Modal` ไม่ rerun focus effect เมื่อ `onClose` เปลี่ยนทุก render และรองรับ `initialFocus`; กล่องรหัสผ่าน PM ใช้ `[data-modal-autofocus]`

---

## 11. Known gaps / ข้อควรระวัง

1. `recordHistory()` เขียนจริงแล้ว — ต้อง restart `npm run dev` หลังแก้ `server.js` มิเช่นนั้น History ยังดูเหมือนว่าง/เก่า
2. Password เก็บ plain text, ไม่มี JWT; security อยู่ที่ `api.login` re-check + server guards
3. Mongoose strict ยังตัด: `users.username`, `fixtureDetail.orderStatus/orderNote`, `fixtureInfo.count` — แต่ **`pmForms`, `usage.inUseAt`, `request.items/action` ประกาศแล้ว**
4. ไม่มี route-level auth
5. API ที่ยังไม่มี UI: `users CRUD`, `completeRequest`, `breakdownRequest`, `deleteRequest`, `pmExtend`, `pmAssign`, `orders`, `health`
6. `README.md` อ้างอิง schema/สถานะเก่า — ถือ **context.md + server.js** เป็นความจริง
7. SN ใน `breakdownItems` ต้องเป็น SN เต็มที่มีใน `fixtureDetail`
8. `printStickers()` ใน `lib/print.js` ยังไม่ใช้; PM ใช้ `.pm-sticker`
9. `npm run reset-db` ล้างเฉพาะ `fixturelist`, `request`, `history` (+ `users` ด้วย `--all`) — **ไม่ลบ `fixtureDetail`/`storages`**
10. หลังแก้ `server.js` ต้อง restart `npm run dev` มิเช่นนั้น API ใหม่ยังไม่มีผล

---

## 12. สถานะการเปลี่ยนแปลงล่าสุด (สำหรับผู้พัฒนา)

- ทุกการเปลี่ยนแปลง **ยัง uncommitted** ตามความต้องการของผู้ใช้
- ภาษา TH/ENG ครบทุกหน้า; font self-hosted; language switcher ทั้ง login/shell
- Password gate เฉพาะ Order Accept/Hold/Reject + PM actions; ทุก scan/confirm/verify ไม่มีรหัส
- Scan: full-SN เท่านั้น, duplicate base ใช้ `planIndex`, reset ฝั่ง server, `phase:'issue'` ใน Progress / `phase:'return'` ใน Verify (assignee เท่านั้น); Breakdown issue อนุญาตสแปร์ base เดียวกัน (`allowSameBase`) แต่ return บังคับ exact SN (`strictSn`)
- **ลบหน้า/APIs Issue–Return** ออกทั้งระบบ; ทุกจ่าย/คืนผ่าน Order
- **Replace ถูกนำออกทั้งระบบ**; Request เหลือ Change Model และ Breakdown โดย Change Model ใช้การเลือกตามลำดับ Line → Model เดิม → Model ใหม่ → คิว
- **คิว Change Model** ใช้วันนี้, รวมทุก Line, status inline, occupied disabled; **ทุก request ในวันนั้นทำให้ slot เต็ม (ไม่สน status)**
- Order: แสดง slot, แยก Progress=issue / Verify=return; ทุกบาร์โค้ดสแกนเป็นของช่างที่รับงาน; Verify ครบ 2 คน (ช่างสแกน + ผู้ขอยืนยัน); Verify ไม่กันรับงานใหม่ (กันเฉพาะ Progress)
- PM: KPI → ปฏิทินกะทัดรัด → งานตามลำดับ; ราย Line+Model, 90-day clock → `PM`, 4M บังคับเมื่อเกิน 3 วัน + เลือก PM days, `>7 วัน` → `PM Pending` รอ Admin, `กำลังทำ PM` → `Maintenance`, Verify OK → `In Stock`, Verify แบบ multi-select ตาม Line/Model; ไม่มีปุ่ม Scrap แยก (ใช้ Verify NG → Need Scrape)
- 4M ใช้เฉพาะ fixture ที่มี Line+Model; `N/A / N/A` ไม่ถูกนับ ไม่ถูกบล็อก แนบไฟล์ได้หลายรูปแบบ ≤25MB
- Edit/Import/Due-date/Delete/PM ทุกตัวมี 4M guard + UI feedback; `confirm-scan` ก็ตรวจ 4M ก่อนจ่าย
- Dashboard ปรับเป็น quiet one-screen snapshot — `StatCard` 4 ตัว + สรุป Fixture/งาน 2 การ์ด, สีน้อย, ไม่มีกราฟ/quick actions, ยัง read-only 100%
- `Modal` เสถียรขึ้น: focus effect ไม่ถูก `onClose` แบบ inline รีเซ็ตขณะพิมพ์รหัส; PM plan/verify modal โฟกัสที่ช่องรหัสผ่านทันที
- Order Verify แสดงปุ่ม Verify เสมอ (เอา placeholder “waiting for requester or assignee” ออก); การตรวจสิทธิ์ยังอยู่ใน scan modal/server
- `recordHistory()` เขียน `History` จริงและมี record สรุปปิด Order หลัง Verify ครบ 2 role — History แยกเป็น 2 section (`Order` 1 ใบ/คำขอ, `PM และซ่อมบำรุง` 1 ใบ/PM run ผ่าน `pm_run_id` + fallback) และข้อความ detail ผ่าน `sm()` แปล TH/ENG ด้วย
- Request หน้า Change Model / Replace ใช้ `SearchableSelect` (พิมพ์ค้นหา) ทั้งช่อง Model เดิมและ Model ใหม่; ตัวเลือกยังมาจาก FAN2 `ModelNEW`
- Fixture List และ Edit มีช่อง SN ใน filter; Fixture List ใช้ได้ทั้ง tab ตารางและ matrix, Edit ใช้ได้ทั้ง Fixture และ Due Date
- `status: "Signed"` เห็นแค่หน้า order/request, landing = order; Admin เห็นทุกหน้า (กรอง nav + guard page ใน `App.jsx`)
- Change Model compare ว่าง → fallback จ่าย fixture ของ `changeModel` / คืน fixture ของ `currentModel` ทั้งหมด (มี `fallback:true` ใน plan)
- Fixture List table-only, Import mismatch modal, Fixture Base locked, Edit Status read-only, Process Type label คงเดิม
- Import/Register/Duplicate/Autofocus/FAN2 dropdown คงพฤติกรรมที่ตรวจสอบแล้ว
- ต้องให้ผู้ใช้ restart `npm run dev` ก่อน browser-verify API ใหม่
