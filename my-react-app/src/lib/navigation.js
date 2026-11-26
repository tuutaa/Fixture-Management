import {
  Boxes,
  FilePlus2,
  History,
  LayoutDashboard,
  PencilLine,
  ScanLine,
  ShoppingCart,
  Wrench,
} from 'lucide-react'
import { ROLE } from './constants'

export const NAV_GROUPS = [
  {
    labelTh: 'ติดตามงาน',
    labelEn: 'MONITOR',
    items: [
      {
        key: 'dashboard',
        labelTh: 'แดชบอร์ด',
        labelEn: 'Dashboard',
        hintTh: 'ภาพรวม Fixture',
        hintEn: 'Fixture overview',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelTh: 'รายงานงาน',
    labelEn: 'REPORT',
    items: [
      {
        key: 'order',
        labelTh: 'ออเดอร์',
        labelEn: 'Order',
        hintTh: 'ต้อง Scrape · PR · เปลี่ยนรุ่น',
        hintEn: 'Need Scrape · PR · Replacement',
        icon: ShoppingCart,
      },
      {
        key: 'request',
        labelTh: 'คำขอ',
        labelEn: 'Request',
        hintTh: 'เปลี่ยนรุ่น / Fixture เสีย',
        hintEn: 'Change Model / Breakdown',
        icon: FilePlus2,
      },
    ],
  },
  {
    labelTh: 'ข้อมูล',
    labelEn: 'DATA',
    items: [
      {
        key: 'register',
        labelTh: 'ลงทะเบียน Fixture',
        labelEn: 'Register fixture',
        hintTh: 'ลงทะเบียน Fixture ใหม่',
        hintEn: 'Register a new fixture',
        icon: ScanLine,
      },
      {
        key: 'fixtures',
        labelTh: 'Fixture Detail',
        labelEn: 'Fixture Detail',
        hintTh: 'รายการ Fixture ทั้งหมด',
        hintEn: 'All fixtures',
        icon: Boxes,
      },
      {
        key: 'edit',
        labelTh: 'แก้ไข',
        labelEn: 'Edit',
        hintTh: 'แก้ไขข้อมูล Fixture',
        hintEn: 'Edit fixture data',
        icon: PencilLine,
      },
      {
        key: 'pm',
        labelTh: 'PM และซ่อมบำรุง',
        labelEn: 'PM & Maintenance',
        hintTh: 'วางแผน PM · ตรวจ OK / NG',
        hintEn: 'Plan PM · Verify OK / NG',
        icon: Wrench,
      },
    ],
  },
  {
    labelTh: 'ประวัติ',
    labelEn: 'HISTORY',
    items: [
      {
        key: 'history',
        labelTh: 'ประวัติ',
        labelEn: 'History',
        hintTh: 'ประวัติการทำรายการ',
        hintEn: 'Transaction history',
        icon: History,
      },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
export const DEFAULT_PAGE = 'dashboard'

/* Signed users are shop-floor operators: Order + Request only. Admins keep
 * the full navigation. Status comes from /api/login and is persisted locally. */
export const SIGNED_ONLY_PAGES = ['order', 'request']
export const SIGNED_DEFAULT_PAGE = 'order'

export const isAdminUser = (user) =>
  ROLE.isAdmin(user?.role) || /^admin$/i.test(String(user?.status || '').trim())

export const isSignedOnlyUser = (user) =>
  !isAdminUser(user) && /^signed$/i.test(String(user?.status || '').trim())

export const allowedPagesFor = (user) =>
  isSignedOnlyUser(user)
    ? SIGNED_ONLY_PAGES
    : ALL_NAV_ITEMS.map((item) => item.key)

export const isPageAllowed = (page, user) => allowedPagesFor(user).includes(page)

export const defaultPageFor = (user) =>
  isSignedOnlyUser(user) ? SIGNED_DEFAULT_PAGE : DEFAULT_PAGE
