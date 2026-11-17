export const cn = (...parts) => parts.filter(Boolean).join(' ')

export function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const raw = String(value).trim()
  if (!raw) return null

  // Gregorian ISO first
  const iso = new Date(raw)
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(raw)) return iso

  // Buddhist Era "2568-05-20" -> Gregorian
  const beMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (beMatch && Number(beMatch[1]) > 2400) {
    const year = Number(beMatch[1]) - 543
    const parsed = new Date(`${year}-${beMatch[2]}-${beMatch[3]}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  // DD/MM/YYYY (Thai style)
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) {
    let year = Number(dmy[3])
    if (year > 2400) year -= 543
    const parsed = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]))
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return Number.isNaN(iso.getTime()) ? null : iso
}

export function formatDate(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(value, fallback = '-') {
  const date = parseDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '-'
  const totalMinutes = Math.floor(ms / 60000)
  if (totalMinutes < 1) return `${Math.max(1, Math.round(ms / 1000))} วิ`
  if (totalMinutes < 60) return `${totalMinutes} นาที`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return `${hours} ชม. ${minutes} น.`
  const days = Math.floor(hours / 24)
  return `${days} วัน ${hours % 24} ชม.`
}

export function daysUntil(value) {
  const date = parseDate(value)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.round((date - today) / 86400000)
}

export function expiryState(value) {
  const days = daysUntil(value)
  if (days === null) return 'none'
  if (days < 0) return 'expired'
  if (days <= 3) return 'near'
  return 'valid'
}

export function toDateInput(value) {
  const date = parseDate(value)
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export function safeImage(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path
  return `/images/${path}`
}

export function employeeLabel(employee) {
  if (!employee) return ''
  return [employee.Name, employee.name, employee.LastName, employee.lastname]
    .filter(Boolean)
    .join(' ')
}

/** person object per flow: { empId, name, lastname, date } */
export function personLabel(person) {
  if (!person) return '-'
  const name = [person.name, person.lastname].filter(Boolean).join(' ')
  if (name) return person.empId ? `${name} (${person.empId})` : name
  return person.empId || '-'
}
