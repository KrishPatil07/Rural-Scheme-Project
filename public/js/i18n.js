// i18n.js — Zero dependency, fully scalable translation engine
const I18n = (function() {
  let currentLocale = 'en';
  let translations = {};
  let fallbackTranslations = {};
  const localeCache = {};

  // Supported locales registry — ADD NEW LANGUAGES HERE ONLY
const SUPPORTED_LOCALES = {
  'en': { name: 'English', dir: 'ltr' },
  'mr': { name: 'मराठी', dir: 'ltr' },
  'hi': { name: 'हिंदी', dir: 'ltr' },       
  'vah': { name: 'वऱ्हाडी', dir: 'ltr' },    
  'khn': { name: 'खान्देशी', dir: 'ltr' },    
  'kok': { name: 'कोंकणी', dir: 'ltr' },     
  'vav': { name: 'वारली', dir: 'ltr' },     
  'kfq': { name: 'कोरकू', dir: 'ltr' },     
  'gon': { name: 'गोंडी', dir: 'ltr' },      
  'bhb': { name: 'भीली', dir: 'ltr' }       
};

  async function loadLocale(localeCode) {
    if (localeCache[localeCode]) {
      return localeCache[localeCode];
    }
    try {
      const resp = await fetch(`/locales/${localeCode}.json`);
      if (!resp.ok) throw new Error(`Locale ${localeCode} not found`);
      const data = await resp.json();
      localeCache[localeCode] = data;
      return data;
    } catch (e) {
      console.warn(`Failed to load locale ${localeCode}:`, e);
      return null;
    }
  }

  async function init() {
    // Detect user preference: saved > browser language > English
    const saved = localStorage.getItem('preferred_locale');
    const browserLang = navigator.language.split('-')[0];
    const targetLocale = saved || (SUPPORTED_LOCALES[browserLang] ? browserLang : 'en');

    fallbackTranslations = await loadLocale('en') || {};
    translations = await loadLocale(targetLocale) || fallbackTranslations;
    currentLocale = targetLocale;

    document.documentElement.lang = currentLocale;
    document.documentElement.dir = SUPPORTED_LOCALES[currentLocale]?.dir || 'ltr';
  }

  /**
   * Translate a key. Supports {{variable}} interpolation.
   * Falls back to English if key missing in current locale.
   */
  function t(key, vars = {}) {
    let text = translations[key] || fallbackTranslations[key] || key;
    // Interpolation: replace {{name}} with vars.name
    Object.keys(vars).forEach(k => {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), vars[k]);
    });
    return text;
  }

  async function switchLocale(localeCode) {
    if (!SUPPORTED_LOCALES[localeCode]) {
      console.warn(`Unsupported locale: ${localeCode}`);
      return;
    }
    const data = await loadLocale(localeCode);
    if (data) {
      translations = data;
      currentLocale = localeCode;
      localStorage.setItem('preferred_locale', localeCode);
      document.documentElement.lang = localeCode;
      document.documentElement.dir = SUPPORTED_LOCALES[localeCode].dir;
      // Re-render the entire UI
      document.dispatchEvent(new CustomEvent('localeChanged'));
    }
  }

  function getCurrentLocale() { return currentLocale; }
  function getSupportedLocales() { return SUPPORTED_LOCALES; }

  return { init, t, switchLocale, getCurrentLocale, getSupportedLocales };
})();