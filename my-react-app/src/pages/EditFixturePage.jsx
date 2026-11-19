import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Database,
  Info,
  PencilLine,
  Plus,
  Save,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import api from '../lib/api'
import { FIXTURE_STATUS_OPTIONS, fixtureTone } from '../lib/constants'
import {
  Card,
  EmptyState,
  InfoRow,
  PageHeader,
  SectionHeader,
  Spinner,
} from '../components/ui/Card'
import { FormField, Input, NativeSelect } from '../components/ui/Field'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import SearchableSelect from '../components/ui/SearchableSelect'
import Tabs from '../components/ui/Tabs'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { cn, formatDate, formatDateTime, toDateInput } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const emptyForm = {
  status: 'In Stock',
  type: '',
  fixtureBase: '',
  revision: '',
  step: '',
  process: '',
  position: '',
  current: 0,
  max: 0,
  exp: '',
  usageStorage: '',
  desc: '',
  registeredDate: '',
}

const formFromFixture = (fixture) => ({
  status: fixture.status || 'In Stock',
  type: fixture.type || '',
  fixtureBase: fixture.fixtureBase || '',
  revision: fixture.revision || '',
  step: fixture.step || '',
  process: fixture.process || '',
  position: fixture.position || '',
  current: Number(fixture.usage?.current) || 0,
  max: Number(fixture.usage?.max) || 0,
  exp: toDateInput(fixture.usage?.exp),
  usageStorage: fixture.usage?.storage || fixture.storage || '',
  desc: fixture.desc || '',
  registeredDate: toDateInput(fixture.registered?.date),
})

/* Mirrors the shared status chip markup, with a translated label. */
const StatusBadge = ({ status, label }) => {
  const tone = fixtureTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        tone.chip,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {label}
    </span>
  )
}

export default function EditFixturePage({ user, onNavigate }) {
  const { t, fixtureStatus } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('fixture')
  const [all, setAll] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [sn, setSn] = useState('')
  const [fixture, setFixture] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [fixtureHistory, setFixtureHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Storage management state
  const [storages, setStorages] = useState([])
  const [storageLoading, setStorageLoading] = useState(false)
  const [storageSearch, setStorageSearch] = useState('')
  const [storageModal, setStorageModal] = useState(null) // null | { mode: 'create' | 'edit', data?: object }
  const [storageForm, setStorageForm] = useState({ location: '', desc: '' })
  const [storageBusy, setStorageBusy] = useState(false)

  const loadStorages = useCallback(async () => {
    try {
      setStorageLoading(true)
      const data = await api.storages()
      setStorages(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(
        err.message ? sm(err.message) : t('โหลดตำแหน่งเก็บไม่สำเร็จ', 'Failed to load storage locations'),
      )
    } finally {
      setStorageLoading(false)
    }
  }, [sm, t, toast])

  const loadList = useCallback(async () => {
    try {
      setLoadingList(true)
      setListError('')
      const data = await api.fixtures()
      setAll(Array.isArray(data) ? data : [])
    } catch (err) {
      setListError(sm(err.message))
    } finally {
      setLoadingList(false)
    }
  }, [sm])

  useEffect(() => {
    loadList()
    loadStorages()
  }, [loadList, loadStorages])


  const pickOptions = useMemo(
    () =>
      all.map((item) => ({
        value: item.sn,
        label: item.sn,
        group: `${item.line || '-'} · ${item.model || '-'}`,
      })),
    [all],
  )

  const load = useCallback(
    async (target) => {
      const value = String(target || '').trim()
      if (!value) {
        toast.error(t('กรุณาระบุ Serial Number', 'Please specify a serial number'))
        return
      }
      setLoading(true)
      setNotFound('')
      try {
        const data = await api.fixture(value)
        setFixture(data.fixture)
        setForm(formFromFixture(data.fixture))
        setSn(value)
        setHistoryLoading(true)
        api.history({ sn: value, limit: 50 })
          .then((events) => setFixtureHistory(Array.isArray(events) ? events : []))
          .catch(() => setFixtureHistory([]))
          .finally(() => setHistoryLoading(false))
      } catch (err) {
        setFixture(null)
        if (err.status === 404) {
          setNotFound(value)
        } else {
          toast.error(sm(err.message))
        }
      } finally {
        setLoading(false)
      }
    },
    [sm, t, toast],
  )

  const pick = (value) => {
    setSn(value)
    if (value) load(value)
  }

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const save = async (event) => {
    event.preventDefault()
    if (!fixture) return
    setBusy(true)
    try {
      const payload = {
        status: form.status,
        type: form.type,
        fixtureBase: form.fixtureBase,
        revision: form.revision,
        step: form.step,
        process: form.process,
        position: form.position,
        desc: form.desc,
        registeredDate: form.registeredDate || null,
        usage: {
          current: Number(form.current) || 0,
          max: Number(form.max) || 0,
          exp: form.exp,
          storage: form.usageStorage,
        },
        user,
      }
      const data = await api.updateFixture(fixture.sn, payload)
      setFixture(data.fixture)
      setForm(formFromFixture(data.fixture))
      toast.success(
        t(`บันทึก ${fixture.sn} สำเร็จ`, `Saved ${fixture.sn} successfully`),
        { title: t('บันทึกการแก้ไขแล้ว', 'Edit saved') },
      )
      await loadList()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const askDelete = () => {
    if (!fixture) return
    setConfirm({
      title: t(`ลบ ${fixture.sn}`, `Delete ${fixture.sn}`),
      message: t(
        `ต้องการลบ Fixture ${fixture.sn} ออกจากระบบหรือไม่ — การลบจะถูกบันทึกใน History`,
        `Delete fixture ${fixture.sn} from the system? — the deletion will be recorded in history`,
      ),
      tone: 'red',
      confirmLabel: t('ลบ Fixture', 'Delete fixture'),
      onConfirm: async () => {
        setBusy(true)
        try {
          await api.deleteFixture(fixture.sn, user)
          toast.success(t(`ลบ ${fixture.sn} แล้ว`, `Deleted ${fixture.sn}`))
          setConfirm(null)
          setFixture(null)
          setForm(emptyForm)
          setSn('')
          await loadList()
        } catch (err) {
          toast.error(sm(err.message))
        } finally {
          setBusy(false)
        }
      },
    })
  }

  // Storage actions
  const openCreateStorage = () => {
    setStorageForm({ location: '', desc: '' })
    setStorageModal({ mode: 'create' })
  }

  const openEditStorage = (item) => {
    setStorageForm({ location: item.location || '', desc: item.desc || '' })
    setStorageModal({ mode: 'edit', data: item })
  }

  const saveStorage = async (e) => {
    e?.preventDefault?.()
    const location = storageForm.location.trim()
    if (!location) {
      toast.error(t('กรุณาระบุตำแหน่งเก็บ', 'Please specify a storage location'))
      return
    }
    setStorageBusy(true)
    try {
      if (storageModal?.mode === 'create') {
        await api.createStorage({ location, desc: storageForm.desc })
        toast.success(t(`เพิ่มตำแหน่งเก็บ ${location} เรียบร้อยแล้ว`, `Added storage ${location} successfully`))
      } else if (storageModal?.mode === 'edit' && storageModal.data?._id) {
        await api.updateStorage(storageModal.data._id, { location, desc: storageForm.desc })
        toast.success(t(`แก้ไขตำแหน่งเก็บ ${location} เรียบร้อยแล้ว`, `Updated storage ${location} successfully`))
      }
      setStorageModal(null)
      await loadStorages()
    } catch (err) {
      toast.error(
        err.message
          ? sm(err.message)
          : t('บันทึกตำแหน่งเก็บไม่สำเร็จ', 'Failed to save storage location'),
      )
    } finally {
      setStorageBusy(false)
    }
  }

  const askDeleteStorage = (item) => {
    setConfirm({
      title: t(`ลบตำแหน่งเก็บ ${item.location}`, `Delete storage ${item.location}`),
      message: t(
        `ต้องการลบตำแหน่งเก็บ "${item.location}" หรือไม่?`,
        `Delete storage location "${item.location}"?`,
      ),
      tone: 'red',
      confirmLabel: t('ลบตำแหน่งเก็บ', 'Delete storage'),
      onConfirm: async () => {
        setStorageBusy(true)
        try {
          await api.deleteStorage(item._id)
          toast.success(t(`ลบตำแหน่งเก็บ ${item.location} เรียบร้อยแล้ว`, `Deleted storage ${item.location} successfully`))
          setConfirm(null)
          await loadStorages()
        } catch (err) {
          toast.error(
            err.message
              ? sm(err.message)
              : t('ลบตำแหน่งเก็บไม่สำเร็จ', 'Failed to delete storage location'),
          )
        } finally {
          setStorageBusy(false)
        }
      },
    })
  }

  const filteredStorages = useMemo(() => {
    const q = storageSearch.trim().toLowerCase()
    if (!q) return storages
    return storages.filter(
      (s) =>
        (s.location && s.location.toLowerCase().includes(q)) ||
        (s.desc && s.desc.toLowerCase().includes(q)),
    )
  }, [storages, storageSearch])

  const storageColumns = [
    {
      key: 'location',
      header: t('ตำแหน่งเก็บ', 'Storage location'),
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.location}</span>
      ),
    },
    {
      key: 'desc',
      header: t('คำอธิบาย', 'Description'),
      render: (row) => (
        <span className="text-xs text-slate-600">{row.desc || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: t('จัดการ', 'Actions'),
      align: 'right',
      sortable: false,
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={PencilLine}
            onClick={() => openEditStorage(row)}
          >
            {t('แก้ไข', 'Edit')}
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            icon={Trash2}
            onClick={() => askDeleteStorage(row)}
          >
            {t('ลบ', 'Delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Fixture', 'Fixture')}
        icon={PencilLine}
        title={t('แก้ไข', 'Edit')}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          tabs={[
            { value: 'fixture', label: t('Fixture', 'Fixture'), icon: Boxes },
            { value: 'storage', label: t('ตำแหน่งเก็บ', 'Storage'), icon: Database },
          ]}
        />
        <span className="text-[11px] font-semibold text-slate-400">
          {activeTab === 'fixture'
            ? t(`${all.length.toLocaleString()} Fixture`, `${all.length.toLocaleString()} fixtures`)
            : t(`${storages.length.toLocaleString()} ตำแหน่งเก็บ`, `${storages.length.toLocaleString()} storage locations`)}
        </span>
      </div>

      {activeTab === 'fixture' ? (
        <>
          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <FormField label={t('ค้นหา Serial Number', 'Search serial number')}>
                <div className="flex gap-2">
                  <Input
                    className="font-mono"
                    placeholder={t('เช่น RTR-0001', 'e.g. RTR-0001')}
                    value={sn}
                    onChange={(event) => setSn(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') load(sn)
                    }}
                  />
                  <Button icon={Search} onClick={() => load(sn)} disabled={loading} className="shrink-0">
                    {t('ค้นหา', 'Search')}
                  </Button>
                </div>
              </FormField>
              <FormField label={t('หรือเลือกจาก Fixture ทั้งหมด', 'Or select from all fixtures')}>
                {loadingList ? (
                  <div className="field-input text-xs text-slate-400">{t('กำลังโหลดรายการ…', 'Loading list…')}</div>
                ) : (
                  <SearchableSelect
                    value={fixture?.sn || ''}
                    onChange={pick}
                    options={pickOptions}
                    placeholder={t('เลือก SN', 'Select SN')}
                    clearable
                  />
                )}
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={loadList} disabled={loadingList}>
                  {t('รีเฟรชรายการ', 'Refresh list')}
                </Button>
                <Button variant="secondary" icon={Info} onClick={() => onNavigate('register')}>
                  {t('ลงทะเบียน Fixture', 'Register fixture')}
                </Button>
              </div>
            </div>
            {listError ? <p className="mt-3 text-[11px] font-semibold text-red-600">{listError}</p> : null}
          </Card>

          {loading ? (
            <Card>
              <Spinner label={t('กำลังโหลดข้อมูล Fixture…', 'Loading fixture data…')} />
            </Card>
          ) : notFound ? (
            <Card>
              <EmptyState
                icon={TriangleAlert}
                title={t(`If Not Exist — ไม่พบ ${notFound}`, `If Not Exist — ${notFound} not found`)}
                action={
                  <Button icon={ArrowRight} onClick={() => onNavigate('register')}>
                    {t('ไปที่ลงทะเบียน Fixture', 'Go to register fixture')}
                  </Button>
                }
              />
            </Card>
          ) : !fixture ? (
            <Card>
              <EmptyState
                icon={PencilLine}
                title={t('เลือก Fixture ที่ต้องการแก้ไข', 'Select the fixture you want to edit')}
                action={
                  <Button variant="secondary" icon={Boxes} onClick={() => onNavigate('fixtures')}>
                    {t('ดูรายการ Fixture', 'View fixture list')}
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
              <Card className="p-5 sm:p-6">
                <SectionHeader
                  icon={Info}
                  title={fixture.sn}
                  desc={`${fixture.line || '-'} · ${fixture.model || '-'}`}
                  className="mb-3"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={fixture.status} label={fixtureStatus(fixture.status)} />
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {fixture.type || '-'}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {t('Rev', 'Rev')} {fixture.revision || '-'}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  <InfoRow label={t('Line', 'Line')} value={fixture.line} />
                  <InfoRow label={t('Model', 'Model')} value={fixture.model} />
                  <InfoRow label={t('Step', 'Step')} value={fixture.step} />
                  <InfoRow label={t('Process', 'Process')} value={fixture.process} />
                  <InfoRow label={t('Position', 'Position')} value={fixture.position} />
                  <InfoRow label={t('ตำแหน่งเก็บ', 'Storage')} value={fixture.usage?.storage || fixture.storage} />
                  <InfoRow label={t('Fixture Base', 'Fixture Base')} value={fixture.fixtureBase} mono />
                  <InfoRow label={t('Usage', 'Usage')} value={`${fixture.usage?.current || 0} / ${fixture.usage?.max || 0}`} />
                  <InfoRow label={t('Exp', 'Exp')} value={formatDate(fixture.usage?.exp)} />
                  <InfoRow
                    label={t('ลงทะเบียนโดย', 'Registered by')}
                    value={[fixture.registered?.name, fixture.registered?.lastname].filter(Boolean).join(' ') || '-'}
                  />
                  <InfoRow label={t('วันที่ลงทะเบียน', 'Registered date')} value={formatDateTime(fixture.registered?.date)} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {t('ประวัติของ Fixture นี้', 'History of this fixture')}
                  </p>
                  {historyLoading ? (
                    <p className="text-[11px] text-slate-400">{t('กำลังโหลด…', 'Loading…')}</p>
                  ) : fixtureHistory.length === 0 ? (
                    <p className="text-[11px] text-slate-400">{t('ยังไม่มีประวัติ', 'No history yet')}</p>
                  ) : (
                    <ol className="space-y-2">
                      {fixtureHistory.map((item) => (
                        <li key={item._id} className="border-l-2 border-blue-200 pl-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700">{item.action}</span>
                            <span className="ml-auto text-[10px] text-slate-400">
                              {formatDateTime(item.date)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{item.detail || '-'}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-black text-red-700">
                    <TriangleAlert className="h-3.5 w-3.5" /> {t('โซนอันตราย', 'Danger zone')}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-red-600">
                    {t('ลบ Fixture ออกจากระบบ (บันทึก History) — ไม่สามารถย้อนกลับได้', 'Delete the fixture from the system (recorded in history) — this cannot be undone')}
                  </p>
                  <Button variant="danger" size="sm" icon={Trash2} className="mt-3" onClick={askDelete} disabled={busy}>
                    {t('ลบ Fixture นี้', 'Delete this fixture')}
                  </Button>
                </div>
              </Card>

              <Card className="p-5 sm:p-7">
                <SectionHeader
                  icon={PencilLine}
                  title={t('แก้ไขข้อมูล Fixture', 'Edit fixture info')}
                  className="mb-5"
                />
                <form onSubmit={save} className="space-y-5" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label={t('สถานะ', 'Status')}>
                      <NativeSelect value={form.status} onChange={(event) => setField('status', event.target.value)}>
                        {FIXTURE_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {fixtureStatus(option.value)}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField label={t('Type', 'Type')}>
                      <Input value={form.type} onChange={(event) => setField('type', event.target.value)} />
                    </FormField>
                    <FormField label={t('Step', 'Step')}>
                      <Input value={form.step} onChange={(event) => setField('step', event.target.value)} />
                    </FormField>
                    <FormField label={t('Process', 'Process')}>
                      <Input value={form.process} onChange={(event) => setField('process', event.target.value)} />
                    </FormField>
                    <FormField label={t('Position', 'Position')}>
                      <Input value={form.position} onChange={(event) => setField('position', event.target.value)} />
                    </FormField>
                    <FormField label={t('ตำแหน่งเก็บ (Usage Storage)', 'Storage (usage storage)')}>
                      <Input
                        value={form.usageStorage}
                        onChange={(event) => setField('usageStorage', event.target.value)}
                        placeholder={t('เช่น B301', 'e.g. B301')}
                      />
                    </FormField>
                    <FormField label={t('Fixture Base', 'Fixture Base')}>
                      <Input
                        className="font-mono"
                        value={form.fixtureBase}
                        onChange={(event) => setField('fixtureBase', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('Revision', 'Revision')}>
                      <Input
                        className="font-mono"
                        value={form.revision}
                        onChange={(event) => setField('revision', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('การใช้งานปัจจุบัน', 'Usage Current')}>
                      <Input
                        type="number"
                        min="0"
                        value={form.current}
                        onChange={(event) => setField('current', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('การใช้งานสูงสุด', 'Usage Max')}>
                      <Input
                        type="number"
                        min="0"
                        value={form.max}
                        onChange={(event) => setField('max', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('Exp (PM Due)', 'Exp (PM Due)')}>
                      <Input type="date" value={form.exp} onChange={(event) => setField('exp', event.target.value)} />
                    </FormField>
                    <FormField label={t('Registered Date', 'Registered date')}>
                      <Input
                        type="date"
                        value={form.registeredDate}
                        onChange={(event) => setField('registeredDate', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('รายละเอียด', 'Description')} className="sm:col-span-2">
                      <Input
                        value={form.desc}
                        onChange={(event) => setField('desc', event.target.value)}
                        placeholder={t('รายละเอียดเพิ่มเติม', 'Additional details')}
                      />
                    </FormField>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <Button type="submit" icon={Save} disabled={busy}>
                      {busy ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกการเปลี่ยนแปลง', 'Save changes')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setForm(formFromFixture(fixture))}
                      disabled={busy}
                    >
                      {t('ย้อนกลับ', 'Reset')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      icon={CheckCircle2}
                      onClick={() => onNavigate('history')}
                    >
                      {t('ดู History', 'View history')}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="field-input-sm pl-9"
                  placeholder={t('ค้นหาตำแหน่งเก็บ / คำอธิบาย...', 'Search storage / description...')}
                  value={storageSearch}
                  onChange={(e) => setStorageSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadStorages}
                  disabled={storageLoading}
                >
                  {t('รีเฟรช', 'Refresh')}
                </Button>
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={openCreateStorage}
                >
                  {t('เพิ่มตำแหน่งเก็บ', 'Add storage')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {storageLoading ? (
              <Spinner label={t('กำลังโหลดตำแหน่งเก็บ…', 'Loading storage locations…')} />
            ) : (
              <DataTable
                columns={storageColumns}
                rows={filteredStorages}
                rowKey={(row) => row._id}
                pageSize={20}
                dense
                emptyIcon={Database}
                emptyTitle={t('ไม่พบตำแหน่งเก็บ', 'No storage locations found')}
                emptyDescription={t('ยังไม่มีตำแหน่งเก็บ หรือไม่พบตามคำค้นหา', 'No storage locations yet or none match the search')}
                emptyAction={
                  <Button size="sm" icon={Plus} onClick={openCreateStorage}>
                    {t('เพิ่มตำแหน่งเก็บแรก', 'Add the first storage location')}
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      )}

      {/* Storage Create/Edit Modal */}
      <Modal
        open={Boolean(storageModal)}
        onClose={() => (storageBusy ? null : setStorageModal(null))}
        title={storageModal?.mode === 'create' ? t('เพิ่มตำแหน่งเก็บ', 'Add storage') : t('แก้ไขตำแหน่งเก็บ', 'Edit storage')}
        subtitle={storageModal?.mode === 'create'
          ? t('เพิ่มตำแหน่งจัดเก็บใหม่', 'Add a new storage location')
          : t(`แก้ไขตำแหน่ง ${storageModal?.data?.location || ''}`, `Edit location ${storageModal?.data?.location || ''}`)}
        icon={Database}
        size="md"
      >
        <form onSubmit={saveStorage} className="space-y-4 pt-2">
          <FormField label={t('ตำแหน่งเก็บ', 'Storage location')} required>
            <Input
              value={storageForm.location}
              onChange={(e) => setStorageForm((c) => ({ ...c, location: e.target.value }))}
              placeholder={t('เช่น A-01-01 หรือ Rack A', 'e.g. A-01-01 or Rack A')}
              autoFocus
              required
            />
          </FormField>
          <FormField label={t('คำอธิบาย', 'Description')}>
            <Input
              value={storageForm.desc}
              onChange={(e) => setStorageForm((c) => ({ ...c, desc: e.target.value }))}
              placeholder={t('รายละเอียดตำแหน่ง (ไม่บังคับ)', 'Location details (optional)')}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStorageModal(null)}
              disabled={storageBusy}
            >
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              type="submit"
              icon={Save}
              disabled={storageBusy}
            >
              {storageBusy ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกตำแหน่งเก็บ', 'Save storage')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone || 'red'}
        busy={busy}
      />
    </div>
  )
}
