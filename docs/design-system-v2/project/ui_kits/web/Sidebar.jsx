/* Sidebar.jsx */
/* eslint-disable */

function Sidebar({ active, onNavigate, username = 'maya.makes' }) {
  useLang();
  const nav = [
    { kind: 'item',    href: 'today',     label: t('Today', '今天'),               icon: 'house' },
    { kind: 'section', label: t('UNDERSTAND', '了解') },
    { kind: 'item',    href: 'posts',     label: t('Performance', '貼文成效'),     icon: 'chart-bar' },
    { kind: 'item',    href: 'audience',  label: t('Audience', '受眾'),            icon: 'users' },
    { kind: 'item',    href: 'voice',     label: t('Voice', '語氣'),               icon: 'speaker' },
    { kind: 'section', label: t('CREATE', '創作') },
    { kind: 'item',    href: 'timing',    label: t('Timing', '發文時段'),         icon: 'clock' },
    { kind: 'item',    href: 'scanner',   label: t('Scanner', '內容檢視'),         icon: 'magnifier' },
    { kind: 'item',    href: 'composer',  label: t('Compose', '撰寫'),             icon: 'pencil-line' },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="name">Spool</div>
        <div className="h">@{username}</div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {nav.map((n, i) => {
          if (n.kind === 'section') return <div key={i} className="seclbl">{n.label}</div>;
          const isActive = active === n.href;
          return (
            <div key={i}
              className={`navitem${isActive ? ' active' : ''}`}
              onClick={() => onNavigate?.(n.href)}
              role="button" tabIndex={0}>
              <span className="ico"><Icon name={n.icon} size={18} /></span>
              {n.label}
            </div>
          );
        })}
      </nav>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="navitem" onClick={() => onNavigate?.('settings')} style={{ fontSize: 13 }}>
          <span className="ico"><Icon name="gear" size={16} /></span>
          {t('Settings', '設定')}
        </div>
        <div className="navitem" style={{ fontSize: 13 }} onClick={() => onNavigate?.('landing')}>
          <span className="ico"><Icon name="sign-out" size={16} /></span>
          {t('Sign out', '登出')}
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
