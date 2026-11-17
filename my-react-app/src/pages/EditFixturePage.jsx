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
import { FIXTURE_STATUS_OPTIONS } from '../lib/constants'
import {
  Card,
  EmptyState,
  InfoRow,
  PageHeader,
  SectionHeader,
  Spinner,
} from '../components/ui/Card'
import { FixtureStatusBadge } from '../components/ui/Badge'
import { FormField, Input, NativeSelect } from '../components/ui/Field'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import SearchableSelect from '../components/ui/SearchableSelect'
import Tabs from '../components/ui/Tabs'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { formatDate, formatDateTime, toDateInput } from '../lib/format'

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
  currentModel: '',
  changeModel: '',
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
  currentModel: fixture.usage?.currentModel || '',
  changeModel: fixture.usage?.changeModel || '',
  desc: fixture.desc || '',
  registeredDate: toDateInput(fixture.registered?.date),
})

export default function EditFixturePage({ user, onNavigate }) {
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
      toast.error(err.message || 'โหลด Storage ไม่สำเร็จ')
    } finally {
      setStorageLoading(false)
    }
  }, [toast])

  const loadList = useCallback(async () => {
    try {
      setLoadingList(true)
      setListError('')
      const data = await api.fixtures()
      setAll(Array.isArray(data) ? data : [])
    } catch (err) {
      setListError(err.message)
    } finally {
      setLoadingList(false)
    }
  }, [])

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
        toast.error('กรุณาระบุ Serial Number')
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
          toast.error(err.message)
        }
      } finally {
        setLoading(false)
      }
    },
    [toast],
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
          currentModel: form.currentModel,
          changeModel: form.changeModel,
        },
        user,
      }
      const data = await api.updateFixture(fixture.sn, payload)
      setFixture(data.fixture)
      setForm(formFromFixture(data.fixture))
      toast.success(`บันทึก ${fixture.sn} สำเร็จ`, { title: 'Edit saved' })
      await loadList()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const askDelete = () => {
    if (!fixture) return
    setConfirm({
      title: `ลบ ${fixture.sn}`,
      message: `ต้องการลบ Fixture ${fixture.sn} ออกจากระบบหรือไม่ — การลบจะถูกบันทึกใน History`,
      tone: 'red',
      confirmLabel: 'ลบ Fixture',
      onConfirm: async () => {
        setBusy(true)
        try {
          await api.deleteFixture(fixture.sn, user)
          toast.success(`ลบ ${fixture.sn} แล้ว`)
          setConfirm(null)
          setFixture(null)
          setForm(emptyForm)
          setSn('')
          await loadList()
        } catch (err) {
          toast.error(err.message)
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
      toast.error('กรุณาระบุ Storage Location')
      return
    }
    setStorageBusy(true)
    try {
      if (storageModal?.mode === 'create') {
        await api.createStorage({ location, desc: storageForm.desc })
        toast.success(`เพิ่ม Storage ${location} เรียบร้อยแล้ว`)
      } else if (storageModal?.mode === 'edit' && storageModal.data?._id) {
        await api.updateStorage(storageModal.data._id, { location, desc: storageForm.desc })
        toast.success(`แก้ไข Storage ${location} เรียบร้อยแล้ว`)
      }
      setStorageModal(null)
      await loadStorages()
    } catch (err) {
      toast.error(err.message || 'บันทึก Storage ไม่สำเร็จ')
    } finally {
      setStorageBusy(false)
    }
  }

  const askDeleteStorage = (item) => {
    setConfirm({
      title: `ลบ Storage ${item.location}`,
      message: `ต้องการลบ Storage Location "${item.location}" หรือไม่?`,
      tone: 'red',
      confirmLabel: 'ลบ Storage',
      onConfirm: async () => {
        setStorageBusy(true)
        try {
          await api.deleteStorage(item._id)
          toast.success(`ลบ Storage ${item.location} เรียบร้อยแล้ว`)
          setConfirm(null)
          await loadStorages()
        } catch (err) {
          toast.error(err.message || 'ลบ Storage ไม่สำเร็จ')
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
      header: 'Storage Location',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.location}</span>
      ),
    },
    {
      key: 'desc',
      header: 'Description',
      render: (row) => (
        <span className="text-xs text-slate-600">{row.desc || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'จัดการ',
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
            แก้ไข
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            icon={Trash2}
            onClick={() => askDeleteStorage(row)}
          >
            ลบ
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fixture"
        icon={PencilLine}
        title="Edit"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          tabs={[
            { value: 'fixture', label: 'Fixture', icon: Boxes },
            { value: 'storage', label: 'Storage', icon: Database },
          ]}
        />
        <span className="text-[11px] font-semibold text-slate-400">
          {activeTab === 'fixture'
            ? `${all.length.toLocaleString()} Fixtures`
            : `${storages.length.toLocaleString()} Storages`}
        </span>
      </div>

      {activeTab === 'fixture' ? (
        <>
          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <FormField label="ค้นหา Serial Number">
                <div className="flex gap-2">
                  <Input
                    className="font-mono"
                    placeholder="เช่น RTR-0001"
                    value={sn}
                    onChange={(event) => setSn(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') load(sn)
                    }}
                  />
                  <Button icon={Search} onClick={() => load(sn)} disabled={loading} className="shrink-0">
                    ค้นหา
                  </Button>
                </div>
              </FormField>
              <FormField label="หรือเลือกจาก Fixture ทั้งหมด">
                {loadingList ? (
                  <div className="field-input text-xs text-slate-400">กำลังโหลดรายการ…</div>
                ) : (
                  <SearchableSelect
                    value={fixture?.sn || ''}
                    onChange={pick}
                    options={pickOptions}
                    placeholder="เลือก SN"
                    clearable
                  />
                )}
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={loadList} disabled={loadingList}>
                  รีเฟรชรายการ
                </Button>
                <Button variant="secondary" icon={Info} onClick={() => onNavigate('register')}>
                  Register Fixture
                </Button>
              </div>
            </div>
            {listError ? <p className="mt-3 text-[11px] font-semibold text-red-600">{listError}</p> : null}
          </Card>

          {loading ? (
            <Card>
              <Spinner label="กำลังโหลดข้อมูล Fixture…" />
            </Card>
          ) : notFound ? (
            <Card>
              <EmptyState
                icon={TriangleAlert}
                title={`If Not Exist — ไม่พบ ${notFound}`}
                action={
                  <Button icon={ArrowRight} onClick={() => onNavigate('register')}>
                    ไปที่ Register Fixture
                  </Button>
                }
              />
            </Card>
          ) : !fixture ? (
            <Card>
              <EmptyState
                icon={PencilLine}
                title="เลือก Fixture ที่ต้องการแก้ไข"
                action={
                  <Button variant="secondary" icon={Boxes} onClick={() => onNavigate('fixtures')}>
                    ดู Fixture List
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
                  <FixtureStatusBadge status={fixture.status} />
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {fixture.type || '-'}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    Rev {fixture.revision || '-'}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  <InfoRow label="Line" value={fixture.line} />
                  <InfoRow label="Model" value={fixture.model} />
                  <InfoRow label="Step" value={fixture.step} />
                  <InfoRow label="Process" value={fixture.process} />
                  <InfoRow label="Position" value={fixture.position} />
                  <InfoRow label="Storage" value={fixture.usage?.storage || fixture.storage} />
                  <InfoRow label="Fixture Base" value={fixture.fixtureBase} mono />
                  <InfoRow label="Usage" value={`${fixture.usage?.current || 0} / ${fixture.usage?.max || 0}`} />
                  <InfoRow label="Exp" value={formatDate(fixture.usage?.exp)} />
                  <InfoRow label="Current Model" value={fixture.usage?.currentModel} />
                  <InfoRow label="Change Model" value={fixture.usage?.changeModel} />
                  <InfoRow
                    label="Registered"
                    value={[fixture.registered?.name, fixture.registered?.lastname].filter(Boolean).join(' ') || '-'}
                  />
                  <InfoRow label="Registered Date" value={formatDateTime(fixture.registered?.date)} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    ประวัติของ Fixture นี้
                  </p>
                  {historyLoading ? (
                    <p className="text-[11px] text-slate-400">กำลังโหลด…</p>
                  ) : fixtureHistory.length === 0 ? (
                    <p className="text-[11px] text-slate-400">ยังไม่มีประวัติ</p>
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
                    <TriangleAlert className="h-3.5 w-3.5" /> Danger zone
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-red-600">
                    ลบ Fixture ออกจากระบบ (บันทึก History) — ไม่สามารถย้อนกลับได้
                  </p>
                  <Button variant="danger" size="sm" icon={Trash2} className="mt-3" onClick={askDelete} disabled={busy}>
                    ลบ Fixture นี้
                  </Button>
                </div>
              </Card>

              <Card className="p-5 sm:p-7">
                <SectionHeader
                  icon={PencilLine}
                  title="Edit Fixture Info"
                  className="mb-5"
                />
                <form onSubmit={save} className="space-y-5" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Status">
                      <NativeSelect value={form.status} onChange={(event) => setField('status', event.target.value)}>
                        {FIXTURE_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField label="Type">
                      <Input value={form.type} onChange={(event) => setField('type', event.target.value)} />
                    </FormField>
                    <FormField label="Step">
                      <Input value={form.step} onChange={(event) => setField('step', event.target.value)} />
                    </FormField>
                    <FormField label="Process">
                      <Input value={form.process} onChange={(event) => setField('process', event.target.value)} />
                    </FormField>
                    <FormField label="Position">
                      <Input value={form.position} onChange={(event) => setField('position', event.target.value)} />
                    </FormField>
                    <FormField label="Storage (Usage Storage)">
                      <Input
                        value={form.usageStorage}
                        onChange={(event) => setField('usageStorage', event.target.value)}
                        placeholder="เช่น B301"
                      />
                    </FormField>
                    <FormField label="Fixture Base">
                      <Input
                        className="font-mono"
                        value={form.fixtureBase}
                        onChange={(event) => setField('fixtureBase', event.target.value)}
                      />
                    </FormField>
                    <FormField label="Revision">
                      <Input
                        className="font-mono"
                        value={form.revision}
                        onChange={(event) => setField('revision', event.target.value)}
                      />
                    </FormField>
                    <FormField label="Usage Current">
                      <Input
                        type="number"
                        min="0"
                        value={form.current}
                        onChange={(event) => setField('current', event.target.value)}
                      />
                    </FormField>
                    <FormField label="Usage Max">
                      <Input
                        type="number"
                        min="0"
                        value={form.max}
                        onChange={(event) => setField('max', event.target.value)}
                      />
                    </FormField>
                    <FormField label="Exp (PM Due)">
                      <Input type="date" value={form.exp} onChange={(event) => setField('exp', event.target.value)} />
                    </FormField>
                    <FormField label="Registered Date">
                      <Input
                        type="date"
                        value={form.registeredDate}
                        onChange={(event) => setField('registeredDate', event.target.value)}
                      />
                    </FormField>
                    <FormField label="desc" className="sm:col-span-2">
                      <Input
                        value={form.desc}
                        onChange={(event) => setField('desc', event.target.value)}
                        placeholder="รายละเอียดเพิ่มเติม"
                      />
                    </FormField>
                    <FormField label="Current Model">
                      <Input
                        value={form.currentModel}
                        onChange={(event) => setField('currentModel', event.target.value)}
                      />
                    </FormField>
                    <FormField label="Change Model">
                      <Input
                        value={form.changeModel}
                        onChange={(event) => setField('changeModel', event.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <Button type="submit" icon={Save} disabled={busy}>
                      {busy ? 'กำลังบันทึก…' : 'Save changes'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setForm(formFromFixture(fixture))}
                      disabled={busy}
                    >
                      ย้อนกลับ
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      icon={CheckCircle2}
                      onClick={() => onNavigate('history')}
                    >
                      ดู History
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
                  placeholder="ค้นหา Storage / Description..."
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
                  รีเฟรช
                </Button>
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={openCreateStorage}
                >
                  Add Storage
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {storageLoading ? (
              <Spinner label="กำลังโหลด Storage..." />
            ) : (
              <DataTable
                columns={storageColumns}
                rows={filteredStorages}
                rowKey={(row) => row._id}
                pageSize={20}
                dense
                emptyIcon={Database}
                emptyTitle="ไม่พบ Storage"
                emptyDescription="ยังไม่มี Storage หรือไม่พบตามคำค้นหา"
                emptyAction={
                  <Button size="sm" icon={Plus} onClick={openCreateStorage}>
                    เพิ่ม Storage แรก
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
        title={storageModal?.mode === 'create' ? 'Add Storage' : 'Edit Storage'}
        subtitle={storageModal?.mode === 'create' ? 'เพิ่มตำแหน่งจัดเก็บใหม่' : `แก้ไขตำแหน่ง ${storageModal?.data?.location || ''}`}
        icon={Database}
        size="md"
      >
        <form onSubmit={saveStorage} className="space-y-4 pt-2">
          <FormField label="Storage Location" required>
            <Input
              value={storageForm.location}
              onChange={(e) => setStorageForm((c) => ({ ...c, location: e.target.value }))}
              placeholder="เช่น A-01-01 หรือ Rack A"
              autoFocus
              required
            />
          </FormField>
          <FormField label="Description">
            <Input
              value={storageForm.desc}
              onChange={(e) => setStorageForm((c) => ({ ...c, desc: e.target.value }))}
              placeholder="รายละเอียดตำแหน่ง (ไม่บังคับ)"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStorageModal(null)}
              disabled={storageBusy}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              icon={Save}
              disabled={storageBusy}
            >
              {storageBusy ? 'กำลังบันทึก…' : 'บันทึก Storage'}
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
