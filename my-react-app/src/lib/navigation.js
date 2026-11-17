import {
  Boxes,
  FilePlus2,
  History,
  LayoutDashboard,
  PencilLine,
  ScanLine,
  ShoppingCart,
  Timer,
  Undo2,
} from 'lucide-react'

export const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { key: 'dashboard', label: 'Dashboard', hint: 'ภาพรวม Fixture', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Report',
    items: [
      { key: 'order', label: 'Order', hint: 'Need Scrape · PR · Replacement', icon: ShoppingCart },
      { key: 'request', label: 'Request', hint: 'Change Model / Breakdown', icon: FilePlus2 },
      { key: 'return', label: 'Return', hint: 'ME/TE Return → Fixture confirm', icon: Undo2 },
    ],
  },
  {
    label: 'Data',
    items: [
      { key: 'register', label: 'Register fixture', hint: 'ลงทะเบียน Fixture ใหม่', icon: ScanLine },
      { key: 'fixtures', label: 'Fixture list', hint: 'รายการ Fixture ทั้งหมด', icon: Boxes },
      { key: 'edit', label: 'Edit', hint: 'แก้ไขข้อมูล Fixture', icon: PencilLine },
      { key: 'pm', label: 'PM', hint: 'PM date ต่อ Fixture', icon: Timer },
    ],
  },
  {
    label: 'History',
    items: [
      { key: 'history', label: 'History', hint: 'ประวัติการทำรายการ', icon: History },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
export const DEFAULT_PAGE = 'dashboard'
