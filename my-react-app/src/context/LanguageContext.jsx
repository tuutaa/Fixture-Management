/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

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

  const setLang = (next) => {
    const value = normalize(next)
    setLangState(value)
    try {
      localStorage.setItem('app_lang', value)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang === 'TH' ? 'th' : 'en'
  }, [lang])

  const t = (th, en) => (lang === 'TH' ? th : (en ?? th))

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
