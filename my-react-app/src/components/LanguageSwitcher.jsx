import { useLanguage } from '../context/LanguageContext'

const baseClass = 'flex h-11 items-center justify-center px-4 text-xs font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/70'
const activeClass = 'bg-blue-600 text-white shadow-inner'
const inactiveClass = 'text-slate-400 hover:bg-slate-50 hover:text-blue-600'

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage()

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex max-[400px]:bottom-24 overflow-hidden rounded-2xl border-2 border-slate-100 bg-white shadow-lg"
      role="group"
      aria-label={t('เลือกภาษา', 'Select language')}
    >
      <button
        type="button"
        onClick={() => setLang('TH')}
        aria-pressed={lang === 'TH'}
        title={t('สลับเป็นภาษาไทย', 'Switch to Thai')}
        className={`${baseClass} ${lang === 'TH' ? activeClass : inactiveClass} border-r border-slate-100`}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => setLang('ENG')}
        aria-pressed={lang === 'ENG'}
        title={t('สลับเป็นภาษาอังกฤษ', 'Switch to English')}
        className={`${baseClass} ${lang === 'ENG' ? activeClass : inactiveClass}`}
      >
        ENG
      </button>
    </div>
  )
}
