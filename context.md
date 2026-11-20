# Fixture Management — Project Context

> เอกสารอ้างอิงของโปรเจค **Fixture Management / FAN2 Flow MM**  
> อัปเดตจากโค้ดปัจจุบัน (ยังไม่ commit) เมื่อ 2026-11-20  
> แหล่งความจริงของธุรกิจ: `Fixture MM.drawio` (อ้างอิงในหัวข้อ `server.js`)

---

## 1. ภาพรวมระบบ

ระบบบริหารจัดการ Fixture ของสายผลิต FAN2 (Delta) ครอบคลุมตั้งแต่ลงทะเบียน Fixture, สร้างคำขอ Change Model / Breakdown, รับงาน–สแกน–จ่าย/รับคืน, คืน Fixture, PM/ซ่อมบำรุง, ประวัติ และ Dashboard

**Stack**

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 (`@tailwindcss/vite`) |
| Icon | `lucide-react` |
| Font | `@fontsource/noto-sans-thai` (self-hosted, weights 400/500/600/700) |
| Excel | `xlsx` (lazy-load เฉพาะหน้า Fixture List) |
| QR/Print | `qrcode` + `window.print()` |
| Backend | Express 5 + Mongoose 9 + MongoDB |
| Upload | Multer (เก็บเอกสาร 4M ที่ `my-react-app/uploads/pm`) |
| Dev | `concurrently` รัน API :3000 + Vite :8000 |

**ไม่มี React Router** — การเปลี่ยนหน้าใช้ state `page` ใน `App.jsx` + `localStorage.currentPage` และ `navigate()` จะ scroll กลับด้านบนเสมอ

**Session** เก็บใน `localStorage` keys: `currentUser`, `currentUserID`, `currentLastName`, `userRole`, `currentDept`, `currentRequestId` (อ่านอย่างเดียว), `currentPage` และ `app_lang`

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
      │  ├─ constants.js              ← status/toning/nav-related constants
      │  ├─ navigation.js             ← NAV_GROUPS 4 กลุ่ม / 9 หน้า
      │  ├─ format.js                 ← วันที่, พ.ศ., daysUntil, initials
      │  ├─ fixtureImport.js          ← parse Excel → fixtureList import payload
      │  └─ print.js                  ← sticker 36×11 mm (ยังไม่ได้ใช้งาน)
      ├─ components/
      │  ├─ AppShell.jsx              ← sidebar, mobile drawer, user card, logout, switcher
      │  ├─ AuthCard.jsx
      │  ├─ LanguageSwitcher.jsx
      │  ├─ OrderScanModal.jsx        ← กล่องสแกน Complete/Scan
      │  └─ ui/                       ← Button, Card, Modal, Field, DataTable, Tabs, Toast, ...
      └─ pages/
         ├─ LoginPage.jsx
         ├─ DashboardPage.jsx
         ├─ RequestPage.jsx
         ├─ ReturnPage.jsx
         ├─ OrderPage.jsx
         ├─ FixtureListPage.jsx
         ├─ EditFixturePage.jsx
         ├─ PMPage.jsx
         ├─ RegisterFixturePage.jsx
         └─ HistoryPage.jsx
```

---

## 3. Environment & การรัน

### คำสั่ง

```bash
npm install
npm run dev        # API :3000 + Vite :8000 (ผู้ใช้รันเองใน VSCode)
npm run build      # vite build → dist/
npm start          # Express serve dist/ ที่ :3000
npm run lint       # eslint .
npm run reset-db -- --yes          # ล้าง fixturelist, request, history
npm run reset-db -- --all --yes    # + users (server จะ seed admin ใหม่)
```

> หมายเหตุ: ระหว่างการพัฒนา **ไม่ควร start server แทนผู้ใช้** — user รัน `npm run dev` เอง

### ตัวแปรสภาพแวดล้อม (`server.js`)

| ตัวแปร | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|
| `PORT` | `3000` | Express API |
| `MONGO_URL` | `mongodb://10.192.8.238:27017/Fixture_Management` | DB หลัก |
| `FAN2_MONGO_URL` | `mongodb://10.192.8.238:27017/FAN2` | DB ภายนอกสำหรับ dropdown Location/ModelNEW |
| `VITE_API_URL` (frontend) | `/api` | ใช้ตอน build/dev; Vite proxy ส่งต่อที่ `localhost:3000` |

DB หลักต้องเป็น **`Fixture_Management`** (มี underscore)  
ถ้า `users` ว่าง server จะ seed `admin / admin` (status `Admin`) อัตโนมัติ

---

## 4. Schema / Data Model

### 4.1 MongoDB collections (DB `Fixture_Management`)

#### `users`

| ฟิลด์ | ชนิด | ค่าเริ่มต้น / หมายเหตุ |
|---|---|---|
| `_id` | ObjectId | auto |
| `empId` | String | **required**, index, รหัสพนักงาน (ใช้ login/actor) |
| `pass` | String | **required**, เก็บเป็น plain text (ยังไม่ hash) |
| `name` | String | ชื่อ |
| `lastname` | String | นามสกุล |
| `dept` | String | `''` |
| `status` | String | `Pending` (index) — อนุญาต `Approved` / `Admin` เท่านั้นตอน login (`isApproved`) |
| `request_id` | String | `''` — request ล่าสุดที่ user กำลังดำเนินการ (อัปเดตตอนสร้าง request) |

⚠️ `register()` พยายามเขียน `username` แต่ **ไม่มีใน schema** → ถูก Mongoose strict ตัดทิ้ง ดังนั้น login ด้วย username ยังไม่ทำงานจริง

#### `fixtureDetail` — แหล่งความจริงของ Fixture แต่ละตัว

| ฟิลด์ | ชนิด | ค่าเริ่มต้น / หมายเหตุ |
|---|---|---|
| `_id` | ObjectId | auto |
| `sn` | String | **required, unique, index** — SN เต็ม เช่น `TB53AO0007-01` |
| `line` | String | `''` — Line ของตัวFixture (เก็บตอน Register/Import ยืนยัน; ใช้เป็นแหล่งความจริงของหน้า Edit) |
| `model` | String | `''` — Model ของตัว Fixture (เก็บตอน Register/Import ยืนยัน; แหล่งความจริงของหน้า Edit) |
| `status` | String | `In Stock` (index) — ดู enum §4.3 |
| `type` | String | **Process Type** — canonical `Mainline / Rotor / Winding / Function` ตามหน้า Request (ค่เก่า `mainline / winding / rotor / function` ยังอ่านได้และแสดงผลเป็น canonical; คีย์ใน DB/API ยังเป็น `type`) |
| `step` | String | `''` — Step ตาม Master (`src/lib/fixtureMeta.js`), เก็บตอน Register/Edit และอัปเดตตอน Import ยืนยัน |
| `process` | String | `''` — Process ตาม Master |
| `position` | String | `''` — Fixture position ตาม Master (ใช้ตรวจ Import) |
| `usage.current` | Number | `0` — จำนวนครั้งที่ใช้งานสะสม |
| `usage.max` | Number | `0` — กำหนด PM ที่ 80% |
| `usage.exp` | String | วันครบกำหนด PM (ISO `YYYY-MM-DD`) |
| `usage.storage` | String | ตำแหน่งเก็บ (จาก collection `storages`) |
| `usage.usedLine` | String | Line ที่ถูกจ่ายไปใช้งาน (อัปเดตตอน confirm-scan) |
| `usage.currentModel` | String | โมเดลที่ใช้งานอยู่ |
| `usage.changeModel` | String | โมเดลปลายทางของ Change Model |
| `registered.empId/name/lastname/date` | personSchema | ผู้ลงทะเบียน |
| `fixtureBase` | String | SN ตัด revision suffix ออก เช่น `TB53AO0007` |
| `revision` | String | `''` |
| `pmDate` | String | `''` — วันที่ Plan PM |

⚠️ โค้ดพยายาม `$set` `pmForms`, `orderStatus`, `orderNote` แต่ **ไม่ได้ประกาศใน schema** → ถูก strict ตัดทิ้ง (ดู §11)

#### `fixtureList` — Master matrix ตาม Line/Model/Position

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `_id` | ObjectId | auto |
| `line` | String | required, index |
| `model` | String | required, index |
| `fixtureInfo[]` | subdoc (`_id:false`) | รายการ position |
| `fixtureInfo[].step` | String | STEP1 / STEP2 / ... |
| `fixtureInfo[].process` | String | Rotor Assy / Winding / ... |
| `fixtureInfo[].position` | String | ตำแหน่งใน Line (key ของ compare A→B) |
| `fixtureInfo[].sn` | [String] | **base SN** ที่ผูกกับposition (อาจมีหลาย unit ต่อ base เดียวกัน) |
| `fixtureInfo[].count` | Number | จำนวนมาตรฐานจาก Excel (import เท่านั้น; ไม่ได้ประกาศใน schema → ถูกตัดทิ้ง *ในคำสั่ง import* แม้ code พยายามส่ง) |

> `findFixture()` ค้น `fixtureDetail` ก่อน ถ้าไม่เจอจะ resolve base → `^base-`; ค่า `line/model/step/process/position` ใช้จาก `fixtureDetail` ก่อนเสมอ และดึงจาก `fixtureList.fixtureInfo` มาเป็น fallback เฉพาะเมื่อ detail ยังไม่มีค่า

#### `storages`

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `_id` | ObjectId | auto |
| `location` | String | required, index, ไม่ซ้ำ |
| `desc` | String | `''` |

#### `request` — ใบงาน / Order

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `_id` | ObjectId | auto |
| `request_id` | String | required, unique, index — `REQ` + YYMMDD + running 3 หลัก |
| `line` | String | index |
| `currentModel` | String | Model A |
| `changeModel` | String | Model B (Change Model) |
| `type` | String | index — `Change Model` / `Breakdown` |
| `status` | String | `Waiting` (index) — ดู state machine §7.5 |
| `desc` | String | `''` — Change Model auto = `A → B` |
| `breakdownItems[]` | `{ sn, symptom }` | รายการFixtureเสียที่ต้องรับคืน |
| `requestInfo` | personSchema | ผู้ขอ (**คนนี้เท่านั้นที่ Verify ได้**) |
| `acceptInfo` | personSchema | ช่างที่รับงาน (**คนนี้เท่านั้นที่ scan/reset/confirm ได้**) |
| `issueInfo` | personSchema | ผู้จ่าย/ดำเนินการ |
| `verifyInfo` | personSchema | ผู้ Verify |
| `issueDone` / `returnDone` | Boolean | `false` |
| `scannedIssue[]` | [String] | SN ที่จ่ายแล้วหลังกด ตกลง |
| `returnedItems[]` | [String] | SN ที่รับคืนแล้วหลังกด ตกลง |
| `scanMatches[]` | array | ผลสแกนชั่วคราวก่อนกด ตกลง |
| `scanMatches[].sn` | String | SN จริงที่สแกน (resolved) |
| `scanMatches[].scannedSn` | String | SN ที่ผู้ใช้สแกน(raw) |
| `scanMatches[].planSn` | String | SN ใน plan ที่ถูก match |
| `scanMatches[].planIndex` | Number | index ใน plan — ใช้แยก base ซ้ำ |
| `scanMatches[].action` | String | `issue` / `return` |
| `scanMatches[].position/process` | String | ข้อมูลจาก plan |

⚠️ โค้ด breakdown/maintenance พยายามเขียน `request.items`, `request.action`, `request.orderStatus` แต่ **ไม่มีใน schema** → ไม่ persist

#### `history`

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `sn`, `request_id`, `action`, `detail`, `line`, `model`, `empId`, `name`, `lastname` | String | index บน `sn`, `request_id`, `action`, `date` |
| `date` | Date | `Date.now` (index) |

⚠️ **สำคัญ:** `recordHistory()` ใน `server.js:261` คือ `() => Promise.resolve()` — **ไม่เขียน collection จริง** หน้า History อ่านได้แต่ข้อมูลอาจว่างหรือมาจากข้อมูลเก่า/ migration

### 4.2 External DB `FAN2` (read-only)

| Collection | ฟิลด์ที่ใช้ | ใช้ทำอะไร |
|---|---|---|
| `Location` | `location` | dropdown Line/ตำแหน่งใน Register |
| `ModelNEW` | `model` | dropdown Model ใน Register |

เชื่อมผ่าน `mongoose.createConnection(FAN2_MONGO_URL)` แยกจาก DB หลัก

### 4.3 Enum / ค่าที่ใช้บ่อย

**Fixture status** (`constants.js` / `i18n.js`)

| ค่าใน DB | ภาษาไทย | อังกฤษ |
|---|---|---|
| `In Stock` | ในสต็อก | In Stock |
| `In Use` | ใช้งานที่ไลน์ | In Use |
| `Maintenance` | ซ่อมบำรุง | Maintenance |
| `Scrape` | ต้อง Scrape | Need Scrape |
| `PR` | ต้อง PR | Need PR |
| `PR Ready` | มี PR แล้ว | Already have PR |
| `Replaced` | เปลี่ยนตัวใหม่ | New One Replacement |

**Request status**: `Waiting → Progress → Hold → Verify → Done` (+ `Rejected`)

**Request type**: `Change Model`, `Breakdown`

**PM states** (derive จาก `usage.exp` และ `current/max`)

- `tracked` (> 7 วัน)
- `pre-alert` (1–7 วัน)
- `on-due` (วันครบกำหนด)
- `overdue-remind` (เกิน 0–3 วัน)
- `over-due` (เกิน > 3 วัน)
- `usage-remind` (`current/max ≥ 0.8`)

**Order/NG lifecycle**: `Scrape → PR → PR Ready → Replaced` + `Restock`;  sub-status `Pending / Accepted / Rejected / Hold / Issued / Verified` *(sub-status ยังไม่ persist — ดู §11)*

---

## 5. ข้อมูลต่ำสุดที่ต้องมี (Data prerequisites)

| หน้า / Flow | ต้องมีข้อมูลอะไร |
|---|---|
| Login | user ใน `users` ที่ `status = Approved` หรือ `Admin`; default `admin/admin` ถูก seed ถ้า collection ว่าง |
| Request (Create) | `fixtureList` อย่างน้อย 1 doc เพื่อให้ `/fixturelist/options` มี Line/Model; Change Model ต้องมี fixtureList ของทั้ง Model A และ B |
| Register Fixture | FAN2 `Location` + `ModelNEW` มีข้อมูล, `storages` มีข้อมูล; SN ต้องเป็น **SN เต็ม** ที่ยังไม่มีใน `fixtureDetail` |
| Order / Scan | request ต้องมี `acceptInfo.empId` ตรงกับ user; plan มาจาก compare A→B หรือ `breakdownItems`; SN ที่สแกนต้องมีใน `fixtureDetail` แบบเต็ม |
| Breakdown return list | `request.breakdownItems[].sn` ต้องระบุ SN (ระบบ enrich position/process ผ่าน `findFixture`) |
| Return | fixture ต้องอยู่ใน status `In Use` หรือ `Maintenance` |
| PM | fixture ต้องมี `usage.exp` / `usage.max` / `usage.current`; อยู่ใน `In Use` หรือ `Maintenance` |
| Maintenance | fixture ต้องอยู่ใน status `Maintenance` |
| Dashboard/History | อ่าน aggregate จาก fixtureDetail, request, history — history อาจว่างเพราะ `recordHistory` เป็น no-op |
| Sticker/4M | เอกสารอัปโหลดไปที่ `uploads/pm` และ serve ที่ `/uploads/pm/<file>` |

---

## 6. API Surface

### 6.1 Auth / User

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| POST | `/api/login` | รับ `empId\|username` + `pass`; 401 ถ้า credentials ผิด, 403 ถ้า status ไม่ Approved/Admin; คืน `userId/name/lastName/dept/role/requestId` |
| POST | `/api/register` | สร้าง user status `Pending`; 409 ถ้า empId ซ้ำ |
| GET | `/api/me?empId=` | ข้อมูล user (frontend ยังไม่เรียก) |
| GET | `/api/users` | รายชื่อ user ไม่รวม `pass` (ยังไม่มี UI) |
| PUT | `/api/users/:id` | แก้ `status` / `dept` (ยังไม่มี UI) |
| DELETE | `/api/users/:id` | ลบ user (ยังไม่มี UI) |

### 6.2 Fixture master / register / edit

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| GET | `/api/fixturelist/options` | `{ lines, models, modelsByLine }` |
| GET | `/api/fixturelist?line=&model=` | raw fixtureList docs |
| POST | `/api/fixturelist/import` | `{ items, confirm }` จาก Excel → validate step/process/position ก่อน upsert ตาม line+model; ถ้าไม่ตรง/ไม่มี → `409 { needsConfirm, issues }` ให้ modal ยืนยัน แล้วส่ง `confirm:true` เพื่ออัปเดต `fixtureDetail` + import ต่อ |
| GET | `/api/fixture-stats` | `{ total, counts }` |
| GET | `/api/fixture-details` | ทุก fixtureDetail |
| GET | `/api/fixtures?line=&model=&status=&sn=&type=&step=&process=&position=&storage=&fixtureBase=&revision=&q=` | flatten + filter (ทุกตัวกรองเป็น contains ไม่ตรงตัว ยกเว้น `status` ที่รองรับ comma-separated exact) |
| GET | `/api/fixtures/options` | distinct values จาก `fixtureDetail + fixtureList + storages` สำหรับ filter zone/dropdown ในหน้า Edit: `lines/models/statuses/types(Process Type — canonical ตาม Request)/steps/processes/positions/fixtureBases/revisions/storages` (ต้องอยู่ก่อน `/api/fixtures/:sn`) |
| GET | `/api/fixtures/detail/options` | **แหล่งข้อมูลของหน้า Edit**: options ทุกช่องจาก `fixtureDetail` + Master `fixtureMeta.js` + FAN2 (Location/ModelNEW) + `storages`; มี `sns`, `lines`, `models`, `statuses`, `types` (Process Type — canonical `Mainline/Rotor/Winding/Function` เหมือน Request; ค่า lowercase เดิมถูก map ก่อนส่งออก), `steps`, `processes`, `positions`, `fixtureBases`, `revisions`, `storages`, `positionByProcess` |
| GET | `/api/fixtures/detail?line=&model=&status=&sn=&type=&step=&process=&position=&storage=&fixtureBase=&revision=&q=` | **Edit rows** — อ่าน `fixtureDetail` ก่อน, `fixtureList` เป็น fallback เฉพาะเมื่อยังไม่มี `line/model/step/process/position` ใน detail |
| GET | `/api/fixtures/:sn` | 404 ถ้าไม่มี — ใช้เช็คซ้ำตอน Register; `findFixture()` ตอนนี้ให้ `fixtureDetail` มีความสำคัญสูงกว่า `fixtureInfo` |
| POST | `/api/fixtures` | 409 `Serial Number ... มีในระบบแล้ว (If Exist)` พร้อม `fixture`; ถ้าไม่มี → create detail + push SN เข้า fixtureList |
| PUT | `/api/fixtures/:sn` | แก้ detail (`step/process/position` รวมถึงใน `fixtureDetail`) + `fixtureInfo[].step/process/position` |
| DELETE | `/api/fixtures/:sn` | ลบ detail + `$pull` SN ออกจากทุก fixtureList |
| GET | `/api/fixturelist/compare?line=&from=&to=` | `{ issue, return, keep, total, missing }` |
| GET | `/api/fan2/locations`, `/api/fan2/models` | dropdown ภายนอก |
| GET/POST/PUT/DELETE | `/api/storages[/:id]` | CRUD ตำแหน่งเก็บ |

### 6.3 Request / Order / Scan

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| GET | `/api/requests?status=&type=&empId=` | รายการคำขอ |
| GET | `/api/requests/:requestId` | ยังไม่มี UI เรียก |
| POST | `/api/requests` | กัน request ซ้ำ (ดู §7.3) → สร้าง `REQ...`; อัปเดต `users.request_id` |
| PUT | `/api/requests/:id/accept` | Waiting/Hold → Progress; กันรับงานใหม่ถ้ามี Progress/Verify อยู่ |
| PUT | `/api/requests/:id/hold` | Progress → Hold |
| PUT | `/api/requests/:id/reject` | Waiting/Hold → Rejected |
| PUT | `/api/requests/:id/complete` | Progress/Hold → Verify (API มี แต่ UI ใช้ scan flow แทน) |
| GET | `/api/requests/:id/scan-plan` | `{ plan, matches }` |
| POST | `/api/requests/:id/reset-scan` | ล้าง `scanMatches` **อย่างเดียว** (ไม่แตะ status/fixture) |
| POST | `/api/requests/:id/scan` | ตรวจ SN → บันทึก match **อย่างเดียว** (ยังไม่เปลี่ยน fixture) |
| POST | `/api/requests/:id/confirm-scan` | ตรวจครบ → update fixture status + ตั้ง Verify |
| PUT | `/api/requests/:id/breakdown` | `action = Maintenance \| Issue Spare` |
| PUT | `/api/requests/:id/verify` | Verify → Done; **เฉพาะ requestor** |
| DELETE | `/api/requests/:id` | ลบคำขอ (ยังไม่มี UI) |

**Guard ข้อความสำคัญ**

- ไม่พบ request → `404 ไม่พบคำขอนี้`
- status ไม่ใช่ Progress/Hold → `409 คำขอนี้ไม่สามารถสแกนได้อีก`
- ไม่ใช่ช่างที่รับงาน → `403 เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้`
- ไม่ใช่ผู้ขอตอน Verify → `403 มีเพียงผู้ขอ (Requestor) เท่านั้นที่ Verify ได้`
- Breakdown SN ซ้ำกับคำขอที่ยังค้าง → `409 มีคำขอ <REQ...> ที่ยังดำเนินการอยู่สำหรับ Fixture <SN>`
- Change Model ซ้ำกับคู่ Line/Model เดิม→ใหม่ที่ยังค้าง → `409 มีคำขอ <REQ...> ที่ยังดำเนินการอยู่สำหรับ Change Model <line> · <A> → <B>`
- Import พบ fixture ไม่ตรง Master/Base → `409 พบ Fixture ที่ต้องอัปเดต step/process/position <n> รายการ — กดยืนยันเพื่ออัปเดตและนำเข้าไฟล์` พร้อม `issues[]`

### 6.4 Issue / Return / PM / Maintenance / Order(NG)

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| POST | `/api/issue` | `{ sn, line, model, note, user }` — รับเฉพาะ `In Stock` → `In Use`, `usage.current +1`, ตั้ง `usedLine/currentModel`, ล้าง `changeModel` |
| GET | `/api/return` | fixture status `In Use,Maintenance` |
| POST | `/api/return` | `{ sn, target: 'In Stock'\|'Maintenance', user }` — รับเฉพาะ status ไม่ใช่ `In Stock` → reset `usage.current/usedLine/currentModel/changeModel` |
| GET | `/api/pm` | worklist + `pmStates` + `usagePercent` |
| POST | `/api/pm/plan` | → `Maintenance` + `pmDate` |
| POST | `/api/pm/extend` | 4M approve +XX days (บังคับเอกสารถ้า > 7 วัน) — ยังไม่มี UI |
| POST | `/api/pm/forms` | multipart เอกสาร 4M → `/uploads/pm/...` — ยังไม่มี UI |
| POST | `/api/pm/assign` | management assign QA/ME/TE/PD — ยังไม่มี UI |
| GET | `/api/maintenance` | fixture status `Maintenance` |
| POST | `/api/maintenance/verify` | `result OK` → Reset Due + In Use; `result NG` → Scrape/PR/PR Ready/Replaced; ทั้ง 2 กรณีล้าง `pmDate` |
| GET | `/api/orders` | fixture ใน status NG chain |
| POST | `/api/orders/:sn/action` | Accept/Reject/Hold/Issue/Verify/Reopen หรือเลือก chain/Restock |

### 6.5 Dashboard / History / Health

| Method | Endpoint | หมายเหตุ |
|---|---|---|
| GET | `/api/dashboard` | KPI, request stats, PM alerts, recent requests/history |
| GET | `/api/history?sn=&action=&request_id=&q=&limit=` | limit สูงสุด 1000 (UI ใช้ 300) |
| GET | `/api/health` | `{ ok, mongo, time }` |

Frontend wrapper ทั้งหมดอยู่ใน `src/lib/api.js` (ส่งออก `api`, `ApiError`)

---

## 7. Business Flow ละเอียด

### 7.1 Authentication

1. User กรอก empId + pass ใน `LoginPage` → `POST /api/login`
2. Server ตรวจ `pass` และ `status` ต้อง `Approved`/`Admin`
3. Frontend เก็บ session ลง `localStorage` แล้วเข้า `dashboard`
4. สมัครใหม่ → `POST /api/register` → status `Pending` → รอ admin อนุมัติ (ยังไม่มี UI อนุมัติ)
5. **Password gate** ของ Order/PM ไม่มี endpoint พิเศษ — ใช้ `api.login({ empId: user.userId, pass })` เช็คซ้ำก่อนเรียก action จริง

### 7.2 Register Fixture (หน้า Register)

1. โหลด options: `fan2Locations` + `fan2Models` + `storages` (`Promise.allSettled`)
2. กรอก Line/Model/Step/Process/Position/**Process Type**/Storage/Revision/Status/Exp/Current/Max/Description
3. `fixtureBase` คำนวณอัตโนมัติจาก SN (ข้อความก่อน `-`)
4. พิมพ์/สแกน SN แล้วกด Enter → `addToQueue()`
   - เรียก `api.fixture(sn)` เพื่อเช็คซ้ำ
   - `404` = ใหม่ → เพิ่มเข้า queue ตามปกติ
   - เจอ = เพิ่มเข้า queue แต่แถวเป็น **สีแดง** + ป้าย `⚠ มีในระบบแล้ว`
   - ข้อมูลเดิมจากระบบจะแสดง **ตัวแดงอยู่ในคอลัมน์ของตัวเอง** (Line, Model, Step, Process, Position, Process Type, Storage, Rev., Status, Exp, Cur., Max, Description, Base) พร้อม `≠` ถ้าค่าที่กรอกไม่ตรง
   - SN ซ้ำใน queue เพิ่มไม่ได้ (case-insensitive)
   - กล่อง SN ไม่ถูก disabled ขณะเช็ค → focus กลับด้วย `requestAnimationFrame` หลังเพิ่ม/ล้างฟอร์ม เพื่อสแกนต่อเนื่อง
5. ถ้ามีแถวซ้ำอยู่ → ปุ่ม **ลงทะเบียนทั้งหมด** disabled + คำเตือนสีแดง
6. กดลงทะเบียน → `POST /api/fixtures` ทีละตัว; ตัวที่สำเร็จจะหลุดจาก queue, ตัวที่ fail แจ้ง reason

### 7.3 สร้างคำขอ (Request Page)

- **Change Model**: เลือก Line, Model A, Model B → `POST /api/requests` พร้อม desc `A → B`
- **Breakdown**: เพิ่มหลายแถว `{ sn, symptom }` → กรองแถว SN ว่างออก
- **กัน request ซ้ำฝั่ง server** ก่อนสร้างเสมอ:
  - นับเฉพาะ status `Waiting / Progress / Hold / Verify` — `Rejected` และ `Done` **ไม่นับ** สามารถขอใหม่ได้
  - Breakdown: ถ้า SN ใดใน `breakdownItems[].sn` เคยอยู่ในคำขอที่ค้างอยู่ → `409`
  - Change Model: ถ้าเคยมีคำขอค้างกับคู่ `line + currentModel + changeModel` เดียวกัน → `409` (ไม่สนว่าเป็น Line อื่น — ต้องตรง Line ด้วย)
  - UI แสดง toast จาก `useServerMessage()` ที่แปลข้อความ 409 เป็น TH/ENG
- Server สร้าง `request_id = REQ + YYMMDD + running` และเซ็ต `users.request_id`
- Request เริ่ม status `Waiting`

### 7.4 Compare Model A→B (`compareModels`)

- ดึง `fixtureList` ของ `line+from` และ `line+to`
- group ตาม `position` (normalize whitespace/lowercase)
- `issue` = SN ที่มีใน B แต่ไม่มีใน A → ต้องเบิก/เตรียม
- `return` = SN ที่มีใน A แต่ไม่มีใน B → ต้องคืน
- `keep` = SN ที่ใช้ร่วมกัน
- `missing.from/to` บอกถ้า master ของฝั่งใดฝั่งหนึ่งไม่มี

### 7.5 Order / Complete–Scan (หัวใจของระบบ)

```
Waiting ──Accept──► Progress ──Complete/Scan + ตกลง──► Verify ──Verify(requestor)──► Done
   │                   │
   └──Reject──► Rejected└──Hold──► Hold ──Accept──► Progress
```

**กติกา**

- Accept/Hold/Reject/Verify ผ่าน password gate (`api.login` เช็คก่อน)
- **Verify เฉพาะ `requestInfo.empId`** เท่ากับ user ปัจจุบัน
- **Scan/Reset/Confirm เฉพาะ `acceptInfo.empId`**
- `Progress` และ `Verify` ถือเป็น "งานค้าง" → กันรับงานอื่น; `Hold` ไม่กัน (พักงานได้พร้อมงานอื่น)
- Hold คง status `Hold` จนกว่าจะ Accept อีกครั้ง

**Scan plan**

- Change Model → ใช้ `compareModels` เป็น plan (`issue` + `return`)
- Breakdown → ใช้ `breakdownItems` แปลงเป็น **return rows** (position fallback = symptom)
- UI แนบ `planIndex` ให้ทุก item เพื่อรองรับหลาย unit ที่ base เดียวกัน

**ขั้นตอนสแกน**

1. `GET scan-plan` โหลด plan + matches เดิม (แถวยังเป็นสีแดง/เขียวตาม matches)
2. `POST scan` ด้วย **SN เต็ม**:
   - base-only ถูกปฏิเสธ (ต้องมี `fixtureDetail` ตรง SN)
   - match ด้วย `fixtureBase` (uppercase, ตัด `-\d+$`) เทียบกับ plan
   - ถ้า base เดียวกันมีหลาย plan row ใช้ `planIndex` ที่ยังไม่ใช้
   - issue ต้องการ status `In Stock`; return ต้องการ status ไม่ใช่ `In Stock`
   - **บันทึกแค่ `scanMatches`** ยังไม่เปลี่ยน fixture
3. `POST reset-scan` ล้าง `scanMatches` → ทุกแถวกลับเป็นสีแดง (status/fixture ไม่เปลี่ยน)
4. `POST confirm-scan` (“ตกลง”):
   - ตรวจว่าครบ plan (หรือถ้าไม่มี plan ต้องมีทั้ง issue และ return)
   - issue → `In Use`, `usage.current +1`, `usedLine`, `currentModel/changeModel`
   - return → `In Stock`, `usage.current = 0`, เคลียร์ model/line
   - ตั้ง `issueDone/returnDone`, `issueInfo`, `scannedIssue/returnedItems`, status = `Verify`
5. กล่อง SN จะถูกล้างทุกครั้งที่กด Enter (ทั้งกรณีสำเร็จและผิด) และ focus กลับอัตโนมัติหลัง scan/reset เพื่อสแกนต่อเนื่อง

**Complete/Scan modal ไม่มี password** — password ถูกเช็คตอน Accept ไปแล้ว

### 7.6 Breakdown

- Request type `Breakdown` ต้องการ `breakdownItems`
- Plan ของหน้า Complete คือรายการ **รับคืนเข้าคลัง** จาก breakdownItems เสมอ
- Endpoint `PUT /requests/:id/breakdown` รองรับ `Maintenance` (SN เสีย → status Maintenance) หรือ `Issue Spare` (SN อะไหล่ต้อง In Stock → In Use) แล้วตั้ง Verify *(frontend ยังไม่เรียกโดยตรง)*

### 7.7 Issue / Return (ทางเลือกสำรอง ไม่ผ่าน Order)

หน้าเดิม `return` ถูกเปลี่ยนเป็น **Issue / Return** (คง nav key เดิมเพื่อไม่ให้ `localStorage.currentPage` เสีย) มี 2 mode:

**Issue (จ่ายจาก Stock)**

- Tab `Issue` → สแกน SN → `api.fixture(sn)` → รับเฉพาะ `In Stock`
- เพิ่มเข้า issue list พร้อมฟิลด์ `Line` / `Model` ที่แก้ได้ต่อแถว (default ตาม fixture)
- กด **Confirm Issue** → `POST /api/issue` ทีละตัว:
  - status → `In Use`
  - `usage.current + 1`, `usage.usedLine`, `usage.currentModel` = ค่าที่กรอก (ล้าง `changeModel`)
  - บันทึก history `action: Issue`
- กล่องสแกนล้างค่าทุกครั้งที่กด Enter และ focus กลับอัตโนมัติ (เหมือน Return เดิม)

**Return (รับคืน)**

- Tab `Return` → สแกน SN → รับเฉพาะ `In Use` / `Maintenance`
- แยกเข้าถัง `stock` หรือ `pm` (drag/drop ได้)
- กด **Confirm Return** → `POST /api/return` ทีละตัว:
  - `target In Stock` → status `In Stock`
  - `target Maintenance` → status `Maintenance`
  - ทั้งสองกรณี reset `usage.current = 0` + ล้าง `usedLine/currentModel/changeModel`
- ไม่มี password gate (เหมือนหน้า Return เดิม) — password ยังอยู่เฉพาะ Order actions + PM Plan/Verify

### 7.7.1 Import Fixture List + ตรวจ step/process/position

Master อยู่ที่ **`src/lib/fixtureMeta.js`** (`FIXTURE_POSITION_MASTER` 49 row ตามที่ผู้ใช้ให้มา) พร้อม helper `normalizeMeta()`, `canonicalPosition()`, `checkPositionMeta()`

1. `handleImportFile()` อ่าน Excel → `buildFixtureListItems(rows)` → `api.importFixtureList(items)`
2. Server normalize step/process/position ทุกแถวเทียบ Master ด้วย position (collapse whitespace, ตัดช่องว่างก่อน `)`)
3. เก็บ base SN จาก `fixtureInfo[].sn` → หา `fixtureDetail` ที่ `fixtureBase` ตรง (case-insensitive)
4. ถ้า detail ตัวใด **ไม่มีข้อมูล** หรือ **ไม่ตรง Master/Base** → ตอบ `409 needsConfirm` พร้อม `issues[]`
   - แต่ละ issue มี `base, sn, current, desired, imported, reason` (`missing | mismatch | master`)
5. หน้า Fixture List เปิด Modal แสดง current → desired แล้วให้กด **Update and import**
6. กดยืนยัน → `api.importFixtureList(items, true)` → server `$set` line/model/step/process/position ให้ detail เหล่านั้น แล้ว upsert `fixtureList` ต่อ
7. ถ้าไม่มีปัญหา import ปกติทันที; ข้อความสำเร็จมีจำนวน fixture ที่ถูกอัปเดตด้วย

### 7.7.2 Fixture List เป็นตารางอย่างเดียว

- ปุ่ม SN ใน matrix เปลี่ยนเป็น `<span>` แล้ว — **ไม่มี detail modal** เมื่อคลิกแถว/SN
- หน้าแสดงได้แค่ตารางแบน (`view = fixture`) หรือ matrix ตาม Line×Position (`view = list`) + filters/KPI
- **Filter ของ `view = fixture` ทำเหมือนหน้า Edit แล้ว**: 10 dropdown (`Line, Model, Status, Process Type, Step, Process, Position, Storage, Fixture Base, Revision`) จาก `/api/fixtures/detail/options` + `storages`, ไม่มีช่องค้นหา SN, มี **Search / Clear filters**, Process→Position dependency เหมือน Register/Edit, และตารางมาจาก `/api/fixtures/detail` (`api.editFixtures`) แทนการกรอง client-side
- **Filter zone: สูง/padding/font เท่า Register แต่แคบกว่าเพื่อลดพื้นที่**: ตัด icon/caption ของหัว section ออก, `px-3`, `SearchableSelect` ไม่ส่ง `size="sm"` → **สูง 42px, padding `10px 14px`, font `14px` เท่าฟอร์ม Register**; ใช้ grid `gap-4 sm:grid-cols-3 md:grid-cols-5` → **10 dropdown อยู่ 2 แถวพอดี** (~166px ที่ viewport ทดสอบ; sm ใช้ 3 คอลัมน์เพื่อไม่แคบเกินไป); ระยะจากช่องกรอกถึงปุ่มใช้ `mt-4` **เท่ากับ `gap-4` ของช่องกรอก**; **ปุ่ม Search/Clear ใช้ `Button` size ปกติแบบ Register** (สูง 42px, `gap-2.5` ระหว่างปุ่ม)
- `view = list` ยังใช้ Line/Model + ช่องค้นหา SN/Model/Position แยกต่างหาก (แสดงเฉพาะ tab นี้)
- Modal ที่เหลืออยู่ของหน้านี้คือ Import confirmation เท่านั้น

### 7.8 PM Checklist Phase 2

- `GET /api/pm` อ่านจาก **`flattenFixtureDetails({ status: 'In Use,Maintenance' })`** (fixtureDetail เป็นหลัก) แล้วคำนวณ `pmStates` + `usagePercent`
- Pre-alert / overdue 3 วัน / 80% usage แสดงบน Dashboard และ PMPage
- **PM workflow strip** ด้านบนหน้า (4 การ์ดกดได้) แสดง `1 Pre-Alert / 80% → 2 Plan PM → 3 Maintenance → 4 Verify + Record` พร้อมจำนวนจริงจาก `rows`/`mRows`; กดแล้ว scroll ไปยัง section ที่เกี่ยวข้อง (`#pm-worklist` / `#pm-maintenance`) — ไม่ใช่แค่ของตกแต่ง
- **PM calendar** อยู่ใน PMPage สร้างจาก `rows` เดียวกับ worklist (ไม่ fetch เพิ่ม):
  - กลุ่ม according to `dateKey(usage.exp)` (รองรับ ISO / พ.ศ. / DD-MM-YYYY) + วันที่ `pmDate` เป็นตัว marks เพิ่ม
  - กรอง `tracked` ออก; ใช้ state `over-due / overdue-remind / on-due / usage-remind / pre-alert` + `planned`
  - **Layout**: KPI box อยู่ฝั่งซ้าย, calendar ขนาดกะทัดรัดอยู่ **มุมขวา** บน `xl` (`grid-cols-[minmax(0,1fr)_380px]`); ถ้า KPI ไม่พอจะ wrap ลงแถวใหม่เอง ไม่ทับกัน
  - month grid 6×7 แบบย่อ (`min-h-[56px]`, โชว์ 2 SN ต่อเซลล์ + `+N`), header เดือนแบบย่อ, legend Badge, ปุ่ม ◀ ▶, กด SN → `setQuery(sn)` + scroll ไป worklist
- **Worklist table** เพิ่มคอลัมน์ **PM signal** (Badge จาก `pmStates`) และ **Usage** (progress bar + %) ต่อจาก Status/Exp/PM date → เห็นเหตุผลที่ต้อง Plan PM ได้ทันที
- **Plan PM** (password gate) → `POST /pm/plan` → status Maintenance + pmDate (ปุ่ม disabled เฉพาะตัวที่อยู่ใน Maintenance แล้ว)
- 4M approve/extend/assign/upload มี API แล้วแต่ยังไม่มี UI
- เอกสาร 4M เก็บที่ `/uploads/pm/...` (max 15 MB ต่อไฟล์)

### 7.9 PM & Maintenance Verify

- `GET /api/maintenance` → คิว status Maintenance (อ่านจาก **`flattenFixtureDetails({ status: 'Maintenance' })`** เช่นกัน)
- การ์ด Maintenance แสดง SN/Line/Model/Position, วัน PM, days-left/overdue, แถบ usage และปุ่ม **Verify OK / NG**
- **Verify + Record** (password gate)
  - **OK** → `status In Use`, **`pmDate: ''`**, `usage.exp = newExp`, `usage.current = 0`, Reset Due + พิมพ์ sticker (`.pm-sticker` + `window.print()`)
  - **NG** → เลือก outcome → status `Scrape / PR / PR Ready / Replaced` + **`pmDate: ''`** (ล้างวัน Plan เก่าทั้ง 2 กรณี ไม่ให้ calendar ค้าง)

### 7.10 Order (NG chain)

- หน้า Order ของโปรเจคนี้คือ **Order งานคำขอ (Request workflow)** ตาม §7.5
- ยังมี API `/api/orders` + `/api/orders/:sn/action` สำหรับ NG chain แยกต่างหาก (Scrape → PR → PR Ready → Replaced → Restock) แต่ frontend ไม่ได้เรียก

### 7.11 Edit Fixture — filter → table → editor

1. **แหล่งข้อมูล = `fixtureDetail`** — หน้า Edit เรียก `/api/fixtures/detail` + `/api/fixtures/detail/options` (ไม่ได้ใช้ `/api/fixtures` แบบเดิมอีกต่อไป)
   - `fixtureDetail` ถูกเพิ่ม `line`/`model` และถูกเขียนตอน Register + Import ยืนยัน
   - `findFixture()` และ `flattenFixtureDetails()` ให้ค่าจาก detail ก่อน; `fixtureList.fixtureInfo` เป็น fallback เฉพาะข้อมูลเก่าที่ยังไม่มีค่าใน detail
   - FAN2 `Location`/`ModelNEW` ถูก merges เข้า `Line`/`Model` options เหมือนหน้า Register (ถ้า FAN2 ไม่พร้อมใช้ค่าจาก detail อย่างเดียว)
2. **Filter zone** ทุกช่องเป็น `SearchableSelect` ที่มีข้อมูล (ไม่มี text input): `Line, Model, Status, Process Type, Step, Process, Position, Storage, Fixture Base, Revision`
   - **ไม่มี SN filter** — SN หาจากตารางผลลัพธ์ (API ยังรองรับ `sn` แต่ UI ไม่แสดงแล้ว)
   - ตัวเลือกมาจาก `/api/fixtures/detail/options` — `fixtureBases/revisions` มาจาก fixtureDetail จริง, statuses/types (Process Type)/steps/processes/positions มาจาก Master + ค่าจริงใน DB
   - เหมือน Register: เมื่อเลือก **Process** ตัวเลือก **Position** จะกรองตาม `positionByProcess` และ position เดิมจะถูกล้างถ้าไม่ตรง process ใหม่
   - ปุ่ม **Search** เรียก `/api/fixtures/detail`; ปุ่ม **Clear filters** รีเซ็ตแล้วโหลดทุกตัว
3. **Layout แนวนอน + สูงเท่ากัน**: filter zone (ซ้าย `320–400px`) และ result zone (ขวา `min-w-0`) อยู่ใน `grid items-stretch lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]` — ทั้ง 2 การ์ดใช้ `lg:h-[500px]` เท่ากัน
   - result card เป็น `flex min-w-0 flex-col overflow-hidden`; **ไม่มีส่วนหัวการ์ด** อีกต่อไป — มีเพียงตารางใน `min-h-0 flex-1 overflow-y-auto` → ตารางยาว/มี many rows ไม่ดันการ์ดให้สูงเกิน filter
   - ทั้ง 2 result table ใช้ `DataTable embedded`: ไม่มี `table-shell` border/shadow/rounded ซ้อนอยู่ใน Card, ตาราง/empty state สูงเต็มพื้นที่และ footer อยู่ล่างสุด → **ตอนไม่เจอข้อมูลไม่มีการ์ดลอย**
4. **ตารางผลลัพธ์ = เฉพาะตาราง Fixture** ใช้คอลัมน์แบบเรียบชุดเดียวกับ **Fixture List → Fixture**: `Serial Number, Process Type, Line, Model, Step, Process, Position, Storage, Fixture Base, Status` (`DataTable dense`, `pageSize={50}`, `emptyIcon={Boxes}`)
   - **เอาคอลัมน์ Edit/Select ออกแล้ว** และเอา header “ผลลัพธ์ Fixture / Fixture results” ออกแล้ว — เหลือแค่ตารางในหน้า Edit
   - คลิกแถว/SN → `GET /api/fixtures/:sn` → โหลด fixture + history เข้า edit zone **แล้วเลื่อนหน้าเว็บลงไปที่ editor อัตโนมัติ (`scrollIntoView`, ไม่ต้อง scroll mouse)**
   - edit zone จะยังไม่แสดงจนกว่าจะเลือกแถว (มี EmptyState แนะนำให้เลือกจากตาราง)
5. **Tab Storage กลับมาแบบเดิมที่ง่ายแล้ว** (ผู้ใช้เปลี่ยนใจ): การ์ดบนมีช่องค้นหา + ปุ่ม **Refresh/Add storage** อยู่แถวเดียวกัน, การ์ดล่างเป็น `overflow-hidden` + `DataTable dense pageSize={20}` (มี empty-state CTA `เพิ่มตำแหน่งเก็บแรก`) — ไม่ได้ใช้ grid ซ้าย/ขวาแบบ Fixture อีกต่อไป; คอลัมน์ edit/delete และ modal create/edit เดิมยังอยู่, แต่ยังใช้ `embedded` เพื่อไม่ให้ตารางลอยตอนไม่เจอข้อมูล
6. **Edit zone** ใช้ `form` เทียบกับ `originalForm` ทุกครั้ง:
   - ช่องที่เปลี่ยนจะได้ `border-amber-300 bg-amber-50/70 ring-2 ring-amber-400`
   - มีแถบสรุป “Unsaved changes” รายชื่อฟิลด์ที่เปลี่ยนก่อนกด Save
   - **Line / Model / Process Type / Step / Process / Position / Storage** เป็น `SearchableSelect` (dropdown search) ที่ดึง options จาก db ผ่าน `/api/fixtures/detail/options` (Storage รวม `storages` collection ด้วย); **Process Type ใช้ `PROCESS_TYPES` จาก `src/lib/constants.js` ตัวเดียวกับหน้า Request** (`Mainline/Rotor/Winding/Function`)
   - **Status แก้ไม่ได้ในหน้า Edit** — แสดงเป็น `StatusBadge` ใน card ซ้ายและใช้เป็นตัวกรองได้อย่างเดียว; ออกจากฟอร์มและออกจาก payload แล้ว (สถานะยังเปลี่ยนผ่าน flow Issue/Return, PM, Order เหมือนเดิม)
   - **Line/Model แก้ได้แล้ว** ใน edit zone และถูกส่งไป `PUT /api/fixtures/:sn`; server เพิ่ม `line/model` เข้า `$set` แล้ว ขณะที่คีย์ `type` ใน DB/API ยังใช้ชื่อเดิมแต่แสดงผลเป็น **Process Type**
   - Process→Position dependency ใช้เหมือนหน้า Register ทั้งใน filter zone และ edit zone
   - **Fixture Base** ถูก `readOnly + disabled` และมีไอคอนล็อก — ส่งกลับไปใน payload เฉพาะค่าตั้งต้น ห้ามแก้จาก UI
   - **ปุ่ม Save changes / Reset ถูกดันไปล่างสุดของ editor card** (`form flex-1` + `mt-auto border-t pt-5`); **เอาปุ่ม View history ออกแล้ว** (ประวัติยังแสดงใน card ซ้าย)
   - ปุ่ม Save จะ disabled ถ้าไม่มีฟิลด์เปลี่ยน; Reset กลับไปใช้ `originalForm`
7. หลัง Save/Delete → reload ทั้งตารางผลลัพธ์และ(options) เพื่อให้ dropdown/tabular ข้อมูลตรงกับ db

---

## 8. หน้าแต่ละหน้าทำอะไรได้บ้าง

| หน้า (key) | สิ่งที่ทำได้ | API หลัก | Password gate |
|---|---|---|---|
| Login (pre-auth) | Login, สมัครสมาชิก | `login`, `register` | ตัว login เอง |
| Dashboard (`dashboard`) | ดู KPI, สถานะ, PM alerts, ประวัติล่าสุด (read-only) | `dashboard` | ไม่ |
| Request (`request`) | สร้างคำขอ Change Model / Breakdown (กันซ้ำจาก server) | `fixtureOptions`, `createRequest` | ไม่ |
| Issue / Return (`return`) | Tab จ่ายจาก Stock / รับคืนเข้าคลังหรือ PM (ไม่ผ่าน Order) | `fixture`, `issueFixture`, `returnFixture` | ไม่ |
| Order (`order`) | กรองคำขอ, ดูรายละเอียด, Accept/Hold/Reject, เปิด Complete/Scan, Verify (requester) | `requests`, `compareFixtureList`, `login`, ทุก scan API | **Accept/Hold/Reject/Verify** |
| Fixture List (`fixtures`) | Import Excel พร้อม modal ยืนยัน step/process/position, ดูตารางแบน/ matrix ตาม Line×Position; **tab Fixture ใช้ filter เหมือน Edit (10 dropdown, ไม่มี SN search, Search/Clear), ช่องสูง 42px แบบ Register แต่แคบลงด้วย grid 3/5 คอลัมน์ (10 dropdown = 2 แถว), gap ช่อง→ปุ่ม `mt-4` เท่ากับ `gap-4`, ปุ่ม Search/Clear size ปกติแบบ Register, Process Type ตรงกับหน้า Request**; ไม่มี detail modal | `fixtureList`, `fixtures`, `fixtureDetails`, `fixtureStats`, `importFixtureList`, `editFixtures`, `editFixtureOptions`, `storages` | ไม่ |
| Edit Fixture (`edit`) | Filter แยกฟิลด์ → Search → ตารางเลือก Fixture → edit zone; **Status อ่านอย่างเดียว, Line/Model แก้ได้, Type แสดงเป็น Process Type**; ไฮไลต์ฟิลด์ที่เปลี่ยนก่อน Save; dropdown search จาก db; Fixture Base ล็อก; แก้/ลบ Fixture + Storage CRUD + history | `fixtureFieldOptions`, `fixtures`, `fixture`, `history`, `updateFixture`, `deleteFixture`, storages CRUD | ไม่ |
| PM (`pm`) | ดู **PM calendar** + worklist, Plan PM, Verify OK/NG + พิมพ์ sticker | `pm`, `maintenance`, `login`, `pmPlan`, `maintenanceVerify` | **Plan PM / Verify OK/NG** |
| Register (`register`) | ลงทะเบียน Fixture แบบ queue, ตรวจซ้ำ, แสดงข้อมูลเดิมสีแดงต่อคอลัมน์, สแกนต่อเนื่อง; field `Type` แสดงเป็น **Process Type** | `fan2Locations`, `fan2Models`, `storages`, `fixture`, `createFixture` | ไม่ |
| History (`history`) | ค้นประวัติตามข้อความ/action/SN/request_id, refresh | `history` | ไม่ |

> ทุกหน้าvisible สำหรับ user ที่ login แล้ว — **ไม่มี route-level authorization** (`role` ใช้แค่แสดงป้าย ADMIN)

---

## 9. Component / Library ที่ควรรู้

### UI kit (`src/components/ui/`)

- `Button` — variants `primary/secondary/ghost/danger/success/warning/yellow/purple/slate`; unknown variant fallback `primary`
- `Card` — `Card`, `PageHeader`, `SectionHeader`, `StatCard`, `InfoRow`, `Spinner`, `EmptyState`, `ErrorState`, `Skeleton`
- `Modal` — portal, ESC, Tab focus trap, body scroll lock, tone/size, focus ช่องแรกหลัง 40 ms
- `Field` — `FormField`, `Input`, `InputSm`, `Textarea`, `NativeSelect`
- `SearchableSelect` — combobox แบบ portal, filter/group/clearable, keyboard nav
- `DataTable` — sort + pagination + row click; `embedded` mode = ไม่มี border/shadow/rounded ซ้อน, สูงเต็ม container, empty state ชิดบน, footer อยู่ล่างสุด (ใช้ใน result card ของ Edit/Storage)
- `Tabs` / `FilterChip`
- `ConfirmDialog` — ยืนยันลบ (ใช้ใน EditFixture)
- `Toast` — `ToastProvider` + `useToast()` (`success/error/warning/info`)

### `src/lib/`

- `api.js` — wrapper ทุก endpoint, `ApiError` มี `status`/`payload`
- `i18n.js` — `LABELS`, `MESSAGES`, `useLabels()`, `useServerMessage()` (แปลข้อความ server แบบ exact + regex)
- `constants.js` — status, tone, PROCESS_TYPES, REQUEST_TYPES, USER_STATUSES, ORDER_LIFECYCLE, NG outcomes
- `navigation.js` — `NAV_GROUPS` 4 กลุ่ม: MONITOR / REPORT / DATA / HISTORY = 9 หน้า
- `format.js` — `parseDate` รองรับ พ.ศ., `formatDate`, `daysUntil`, `toDateInput`, `initials`
- `fixtureImport.js` — parse Excel matrix → `{ line, model, fixtureInfo[] }`
- `fixtureMeta.js` — Master 49 row `step/process/position` + `normalizeMeta`/`canonicalPosition`/`checkPositionMeta` (ใช้ทั้ง server import validation และ frontend ถ้าต้องการ)
- `print.js` — sticker 36×11 mm (ยังไม่ได้ import ใช้งาน)

---

## 10. i18n / Font / UX details

### ภาษา

- `localStorage.app_lang` ค่า `TH` / `ENG` (ยอมรับ `EN` legacy → normalize เป็น `ENG`)
- `<html lang>` ถูก set ทั้งก่อน hydrate (`index.html` inline script) และใน `LanguageContext` (`th` / `en`)
- `t(th, en)` ใน context; `useLabels()` แปลงค่าจาก DB เป็นภาษา; `useServerMessage()` / `sm()` แปลข้อความ server
- ฟังก์ชันใน context ถูก memoize เพื่อป้องกัน infinite reload/flicker (โดยเฉพาะหน้า Fixture List)

### Font

- import `@fontsource/noto-sans-thai/400.css, 500.css, 600.css, 700.css` ใน `main.jsx`
- `--fan2-font` ใน `index.css` ใช้ family นี้ + `--font-sans` ของ Tailwind
- ไม่มี Google Fonts link (self-hosted ทั้งหมด)

### UX ที่ปรับตามความต้องการล่าสุด

- กล่อง SN ใน Register, Complete/Scan และ Return เคลียร์ค่าทุกครั้งที่กด Enter และ focus กลับอัตโนมัติหลัง scan/add/reset
- ตาราง Register ขยาย (`min-w-[1280px]`, grid คอลัมน์ขวา `2fr/2.4fr`)
- ที่ breakpoint `xl` การ์ดลิสต์ถูกวาง `absolute inset-0` ใน grid row ที่สูงเท่าฟอร์ม Register → **ลิสต์ยาวเท่าฟอร์มและเลื่อนภายใน** แทนที่จะดันหน้าลงด้านล่าง
- Complete/Scan modal เป็นโทนฟ้า ไม่มี password, ไม่มี progress chip แยกโหมด, ไม่มี mode tab
- Reset อยู่ในหัวตาราง issue/return ไม่ใช่ในกล่องสแกน
- หน้า Request ใช้คอนเทนเนอร์ `max-w-4xl` **เฉพาะฟอร์ม**; `PageHeader` + icon อยู่นอกคอนเทนเนอร์ชิดซ้ายเหมือนหน้าอื่น (ไม่บังคับตรงขอบฟอร์ม), แบ่งเป็น 3 กลุ่มอ่านง่าย, ย่อฟอร์ม Change Model ให้ Model เดิม→ใหม่อยู่แถวเดียวกัน และจำกัดรายการ Breakdown ให้เลื่อนภายใน `max-h-[240px]` ไม่ดันการ์ดให้ยาวเกิน
- หน้า Issue / Return ใช้ mode tab, scanner เดียวกันทั้ง 2 โหมด, ล้างกล่องทุกEnter, แก้ Line/Model ได้ต่อแถวฝั่ง Issue
- Fixture List คลิก SN/แถวไม่มี modal แล้ว; modal เดียวคือ Import confirmation
- **Fixture List → tab Fixture ใช้ filter ชุดเดียวกับหน้า Edit**: dropdown จาก `/api/fixtures/detail/options` + storages, Process→Position dependency, Search/Clear, ไม่มีช่องค้นหา SN; tab รายการ Fixture ยังมีช่องค้นหา SN/Model/Position แยกต่างหาก; **ช่องกรอก filter สูง 42px, padding 10px 14px, font 14px เท่า Register แต่แคบลง** (grid `gap-4 sm:grid-cols-3 md:grid-cols-5` → 10 dropdown อยู่ 2 แถว, ไม่ใช้ `size="sm"`); **ระยะช่อง→ปุ่ม `mt-4` เท่ากับ `gap-4`; ปุ่ม Search/Clear ใช้ size ปกติแบบ Register (`gap-2.5` ระหว่างปุ่ม)**; **Process Type ใช้ canonical `Mainline/Rotor/Winding/Function` เหมือนหน้า Request**
- Edit หน้า Fixture: **filter zone อยู่ซ้าย / ตารางผลลัพธ์อยู่ขวาในแถวเดียวกันและสูงเท่ากัน (`lg:h-[500px]`)** — ตารางเลื่อนภายใน ไม่ดันการ์ดให้ยาว; edit zone อยู่เต็มกว้างด้านล่าง; **เอา SN filter ออก** (หา SN จากตาราง); ตารางใช้คอลัมน์แบบเรียบเดียวกับ Fixture List → Fixture **โดยไม่มี header และไม่มีคอลัมน์ Edit/Select (เหลือแค่ตาราง, คลิกแถว/SN เพื่อโหลดแก้ไข)**; ใช้ `DataTable embedded` ทั้ง 2 tab → ไม่มีการ์ดตารางลอยตอนไม่เจอข้อมูล; **Tab Storage กลับมาแบบเดิมที่ง่าย: search + Refresh/Add ด้านบน, ตารางด้านล่าง (pageSize 20), ไม่ใช้ grid เหมือน Fixture; ยังใช้ embedded ไม่ให้ลอย**; ทุกช่อง filter เป็น dropdown จาก fixtureDetail/FAN2/Master; Process→Position เหมือน Register; **Status อ่านอย่างเดียว (ไม่มีในฟอร์ม/payload), Line/Model แก้ได้และเซฟผ่าน `/api/fixtures/:sn`, ฟิลด์ `type` ทุกหน้าแสดงเป็น Process Type**; ฟิลด์ที่แก้ไฮไลต์เหลืองก่อน Save; Fixture Base ล็อกห้ามแก้; **คลิกแถวแล้วเลื่อนไป editor อัตโนมัติ; Save/Reset อยู่ล่างกล่อง; ไม่มีปุ่ม View history**
- PMPage เพิ่ม **flow strip 4 ขั้นตอน** ที่กดแล้ว scroll ไป worklist/maintenance จริง; มีปฏิทินกะทัดรัดมุมขวา + KPI wrap ไม่ทับกัน; worklist แสดง PM signal + usage bar; กด SN ในปฏิทินจะกรองตารางแล้ว scroll ไป worklist; verification ล้าง `pmDate` ทั้ง OK/NG

---

## 11. Known gaps / ข้อควรระวัง (ข้อมูลจริงในโค้ด)

1. **`recordHistory()` เป็น no-op** — ไม่มีการเขียน `history` collection จาก action ต่าง ๆ แม้หน้า History จะอ่านอยู่
2. **Password เก็บ plain text** และไม่มี JWT/session token จริง — ความปลอดภัยอยู่ที่ frontend + `api.login` re-check
3. **Mongoose strict ตัดฟิลด์ที่ไม่ได้ประกาศ**: `users.username`, `fixtureDetail.pmForms/orderStatus/orderNote`, `request.items/action/orderStatus`, `fixtureInfo.count` — บาง flow (4M, NG lifecycle) จึงยังไม่ persist จริง (`fixtureDetail.step/process/position` และ `line/model` ถูกเพิ่มเข้า schema แล้ว และไม่ถูกตัดอีกต่อไป)
4. **ไม่มี route-level auth** — ทุก nav item เห็นหมด; สิทธิ์จริงอยู่ที่ server guard + UI check เฉพาะจุด
5. **API ที่มีแต่ยังไม่มี UI**: `users CRUD`, `request`, `completeRequest`, `breakdownRequest`, `deleteRequest`, `returnList`, `pmExtend`, `pmAssign`, `pmUpload`, `orders`, `health`
6. `README.md` อ้างอิง schema/สถานะเก่า (เช่น `Waiting→Accepted→Issued→Done`) — ให้ถือ **context.md นี้ + server.js** เป็นความจริงปัจจุบัน
7. SN ใน `breakdownItems` ต้องเป็น **SN เต็มที่ลงทะเบียนแล้ว** ไม่งั้นสแกนไม่ผ่าน (เช่น `DEMO-NEW-008` มี symptom `ไฟไม่ติด` แต่ SN `TB53ZZ1327-04` ยังไม่มีใน fixtureDetail)
8. `printStickers()` ใน `lib/print.js` ยังไม่ถูกใช้งาน; PM ใช้ `.pm-sticker` print CSS แทน
9. `npm run reset-db` ล้างเฉพาะ `fixturelist`, `request`, `history` (และ `users` ถ้า `--all`) — **ไม่ลบ `fixtureDetail`/`storages`**
10. Import validation จับคู่ `fixtureDetail.fixtureBase` กับ base SN ใน Excel **แบบ case-insensitive ตาม string** — ถ้า base ใน Excel เปลี่ยนรูปแบบจริง (เช่น มี/ไม่มี prefix) modal จะไม่ขึ้นสำหรับตัวนั้น; ต้องแก้ `fixtureBase` ฝั่ง DB/Register (หน้า Edit ล็อกห้ามแก้ base แล้ว)
11. `fixtureInfo.count` ยังไม่ persist (strict) → matrix แสดง “ใช้ N” เป็น 0 จนกว่าจะเพิ่ม `count` ลง `fixtureListSchema`

---

## 12. สถานะการเปลี่ยนแปลงล่าสุด (สำหรับผู้พัฒนา)

- ภาษา TH/ENG ครบทุกหน้า, font ตรง reference, language switcher ทั้ง login และ shell
- Password gate คงไว้เฉพาะ Order actions + PM actions; Complete/Scan ไม่มีรหัส
- Scan: base-only match + ต้องเจอ SN เต็ม, รองรับ base ซ้ำด้วย `planIndex`, reset ฝั่ง server, ตกลงเป็นคนแตะ status
- Breakdown: `breakdownItems` ขึ้นมาในรายการ “ต้องคืน” อัตโนมัติ
- Register: duplicate highlight แดงต่อคอลัมน์, กันลงทะเบียนซ้ำ, ลิสต์กว้างขึ้น, auto-focus SN
- Fixture List: แก้ flicker ด้วยการ memoize context/t/sm; **filter tab Fixture ทำเหมือนหน้า Edit แล้ว** (10 dropdown, Search/Clear, อ่าน `/api/fixtures/detail` + options); **ปุ่ม Search/Clear size ปกติเท่า Register, ช่องสูง 42px แต่แคบลง (grid 3/5 คอลัมน์ = 2 แถว, gap ช่อง→ปุ่ม เท่ากัน), Process Type ตรงกับ Request**
- ฟิลด์ `type` ของ Fixture ทุกหน้า (Register/Edit/Fixture List) ใช้ชื่อแสดงว่า **Process Type** และใช้ค่าตรงกับหน้า Request (`Mainline/Rotor/Winding/Function`; ค่า lowercase เดิมถูก map ทั้งตอนอ่านและตอนเขียน) — คีย์ DB/API ยังเป็น `type`; Edit เอา Status ออกจากฟอร์ม/payload และเพิ่ม **Line/Model แก้ได้** (server `$set` รับ `line/model` แล้ว)
- กัน request ซ้ำเฉพาะ status ค้าง (`Waiting/Progress/Hold/Verify`) ทั้ง Breakdown SN และ Change Model คู่ Line/Model
- เปลี่ยนหน้า Return → Issue / Return (nav key `return`) + `POST /api/issue` + reset usage ตอน return
- Import Fixture List ตรวจ step/process/position กับ Master 49 row, มี modal ยืนยันอัปเดต `fixtureDetail`
- Fixture List ไม่มี detail modal; PM มี flow strip 4 ขั้น + ปฏิทินกะทัดรัดมุมขวา + KPI wrap + worklist signal/usage; Edit เป็น filter(ซ้าย, ไม่มี SN) → **ตาราง Fixture แบบ table-only (ขวา, สูงเท่ากับ filter, ไม่มี header ไม่มีคอลัมน์ Edit/Select, เลื่อนภายใน)** → editor เต็มกว้าง; **Storage tab กลับมาแบบเดิมที่ง่าย (search + Refresh/Add ด้านบน, ตารางด้านล่าง, ไม่ใช้ grid เหมือน Fixture; ยังไม่ลอยตอน empty)**; dirty-field highlight, DB dropdown, Fixture Base ล็อก, อ่านจาก `fixtureDetail` เป็นหลัก; เลือกแถว→auto-scroll ไป editor, Save/Reset ล่างกล่อง, ไม่มี View history; Request header/icon ชิดซ้ายนอกฟอร์ม
- ไฟล์ชั่วคราว `server.log`, `tmp-edges.mjs`, `tmp-nodes.mjs`, `tmp-parse.mjs` ถูกลบแล้ว
- **ทุกการเปลี่ยนแปลงยัง uncommitted** ตามความต้องการของผู้ใช้
