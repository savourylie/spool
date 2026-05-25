/* Shell.jsx — dashboard layout (sidebar + header + content) */
/* eslint-disable */

function ThemeToggle() {
  const get = () => document.documentElement.dataset.theme === 'dark';
  const [dark, setDark] = React.useState(() => {
    try {
      const stored = localStorage.getItem('spool-theme');
      if (stored) {
        document.documentElement.dataset.theme = stored;
        return stored === 'dark';
      }
    } catch {}
    return get();
  });
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('spool-theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="btn ghost"
      style={{ width: 36, height: 36, padding: 0, border: '2px solid var(--border)' }}>
      <Icon name={dark ? 'sun' : 'moon'} size={16} fill />
    </button>
  );
}

function Shell({ active, onNavigate, title, eyebrow, children, banner }) {
  useLang();
  return (
    <div className="shell">
      <Sidebar active={active} onNavigate={onNavigate} />
      <main className="shell-main">
        <header className="shell-header">
          <div className="shell-header-row">
            <div className="col" style={{ gap: 2 }}>
              {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
              <div className="shell-title">{title}</div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Button variant="outline" size="sm">
                <Icon name="plus" size={14} /> {t('Connect another account', '連接其他帳號')}
              </Button>
              <LangToggle />
              <ThemeToggle />
              <span className="muted" style={{ fontSize: 13 }}>@maya.makes</span>
            </div>
          </div>
        </header>
        <div className="shell-content">
          {banner ? <div style={{ marginBottom: 18 }}>{banner}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { Shell, ThemeToggle });
