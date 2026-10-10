/* i18n.jsx — minimal in-place translator + a top-level re-render hook.
   Usage:  const lang = useLang();      // subscribes to changes
           <h1>{t("Spool", "Spool")}</h1>
   Switch via setLang('tw'|'en'). Persisted in localStorage. */
/* eslint-disable */

const LANG_LISTENERS = new Set();
let LANG = (() => {
  try {
    const stored = localStorage.getItem('spool-lang');
    if (stored === 'tw' || stored === 'en') return stored;
  } catch {}
  return 'en';
})();

document.documentElement.lang = LANG === 'tw' ? 'zh-Hant' : 'en';

function setLang(next) {
  if (next !== 'tw' && next !== 'en') return;
  LANG = next;
  document.documentElement.lang = next === 'tw' ? 'zh-Hant' : 'en';
  try { localStorage.setItem('spool-lang', next); } catch {}
  LANG_LISTENERS.forEach(fn => fn(LANG));
}

function useLang() {
  const [v, setV] = React.useState(LANG);
  React.useEffect(() => {
    LANG_LISTENERS.add(setV);
    return () => LANG_LISTENERS.delete(setV);
  }, []);
  return v;
}

function getLang() { return LANG; }

// t(en, tw) — string switcher. Both expected; if tw missing, falls back to en.
function t(en, tw) {
  if (LANG === 'tw') return tw == null ? en : tw;
  return en;
}

function LangToggle() {
  const lang = useLang();
  return (
    <div role="group" style={{
      display: 'inline-flex', height: 36, border: '2px solid var(--border)',
      borderRadius: 9999, overflow: 'hidden',
    }}>
      {[
        { id: 'en', label: 'EN' },
        { id: 'tw', label: '中' },
      ].map(opt => (
        <button key={opt.id}
          onClick={() => setLang(opt.id)}
          aria-pressed={lang === opt.id}
          style={{
            border: 0, cursor: 'pointer',
            padding: '0 12px',
            background: lang === opt.id ? 'var(--foreground)' : 'transparent',
            color: lang === opt.id ? 'var(--background)' : 'var(--foreground)',
            fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { t, setLang, getLang, useLang, LangToggle });
