/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getUiText } from '../lib/translations'

const LanguageContext = createContext()

const normalize = (value) => {
  if (value === 'EN' || value === 'en' || value === 'ENG' || value === 'eng') return 'ENG'
  return 'TH'
}

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      return normalize(localStorage.getItem('app_lang') || 'TH')
    } catch {
      return 'TH'
    }
  })

  const setLang = useCallback((next) => {
    const value = normalize(next)
    setLangState(value)
    try {
      localStorage.setItem('app_lang', value)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'TH' ? 'th' : 'en'
  }, [lang])

  const t = useCallback((th, en) => (lang === 'TH' ? th : (en ?? th)), [lang])

  // Key-based copy for common labels that were previously hardcoded English.
  const ui = useCallback((key) => getUiText(key, lang), [lang])

  const value = useMemo(() => ({ lang, setLang, t, ui }), [lang, setLang, t, ui])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
