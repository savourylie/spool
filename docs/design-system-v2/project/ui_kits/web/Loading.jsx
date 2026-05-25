/* Loading.jsx — first-run /loading page */
/* eslint-disable */

function Loading({ onDone }) {
  useLang();
  const [pct, setPct] = React.useState(8);
  React.useEffect(() => {
    const t = setInterval(() => setPct(p => Math.min(100, p + Math.random() * 12)), 800);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => { if (pct >= 100 && onDone) setTimeout(onDone, 600); }, [pct]);

  const stage =
    pct < 30 ? t('Fetching post insights',         '正在抓取貼文資料') :
    pct < 60 ? t('Analyzing your best posts',      '正在分析你最好的貼文') :
    pct < 90 ? t('Building your audience profile', '正在建立你的受眾輪廓') :
               t('Almost there',                    '快好了');

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--background)' }}>
      <DecoCircle size={288} color="rgba(244,114,182,0.20)" top={-80} right={-80} />
      <DecoCircle size={256} color="rgba(139,92,246,0.15)" bottom={-96} left={-96} />
      <DecoSquare size={64}  color="rgba(244,114,182,0.40)" rotate={12} top="20%" left="22%" dashed />
      <DecoCircle size={16}  color="var(--quaternary)" top="30%" right="28%" />

      <StickerCard padded={false} hoverable={false} style={{ maxWidth: 420, width: '100%', margin: '0 16px' }}>
        <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <IconCircle color="accent" size="lg" style={{ animation: 'spool-spin 1s linear infinite' }}>
            <Icon name="spinner" size={28} />
          </IconCircle>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, margin: 0, textAlign: 'center' }}>
            {t('Analyzing your posts', '正在分析你的貼文')}
          </h2>
          <div style={{ width: '100%' }}>
            <ProgressBar percentage={pct} />
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>{stage}…</p>
          <div style={{
            width: '100%', padding: '12px 14px',
            background: 'var(--muted)', borderRadius: 'var(--radius-md)',
            border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--accent)', animation: 'spool-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{stage}</span>
            <span className="muted tabular" style={{ fontSize: 12 }}>{Math.round(pct)}%</span>
          </div>
        </div>
      </StickerCard>
    </div>
  );
}

(function inj(){
  if (document.getElementById('__spool_loading_kf')) return;
  const s = document.createElement('style'); s.id='__spool_loading_kf';
  s.textContent = `@keyframes spool-spin{to{transform:rotate(360deg)}}@keyframes spool-pulse{0%,100%{opacity:.4}50%{opacity:1}}`;
  document.head.appendChild(s);
})();

Object.assign(window, { Loading });
