/* Banners.jsx */
/* eslint-disable */

function TokenExpiringBanner({ daysLeft = 6, onReconnect }) {
  useLang();
  return (
    <div className="banner warn">
      <IconCircle color="tertiary" size="sm"><Icon name="clock" size={14} /></IconCircle>
      <div className="body">
        <b>{t('Reconnect by Apr 12.', '請於 4 月 12 日前重新連接。')}</b>{' '}
        <span className="muted">{t(`Your Threads token expires in ${daysLeft} days.`, `你的 Threads 授權將於 ${daysLeft} 天後到期。`)}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onReconnect}>{t('Reconnect', '重新連接')}</Button>
    </div>
  );
}

function TokenExpiredBanner({ onReconnect }) {
  useLang();
  return (
    <div className="banner danger">
      <IconCircle color="accent" size="sm" style={{ background: 'var(--destructive)' }}><Icon name="warning" size={14} /></IconCircle>
      <div className="body">
        <b>{t('Your Threads connection has expired.', '你的 Threads 連線已過期。')}</b>{' '}
        <span className="muted">{t('Reconnect to keep your insights up to date.', '請重新連接,讓分析資料保持最新。')}</span>
      </div>
      <Button variant="destructive" size="sm" onClick={onReconnect}>{t('Reconnect', '重新連接')}</Button>
    </div>
  );
}

function BackfillBanner({ done = 142, total = 260, stage }) {
  useLang();
  stage = stage || t('Fetching post insights', '正在抓取貼文資料');
  const pct = Math.round((done / total) * 100);
  return (
    <div className="banner ok">
      <IconCircle color="accent" size="sm"><Icon name="refresh" size={14} /></IconCircle>
      <div className="body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <b>{t(`Importing your posts… ${done} of ${total}`, `正在匯入貼文… ${done} / ${total}`)}</b>
          <span className="muted tabular" style={{ fontSize: 12 }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--muted)', borderRadius: 9999, border: '1.5px solid var(--foreground)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 500ms var(--ease-bounce)' }} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{stage} · {t('last update 30s ago', '30 秒前更新')}</div>
      </div>
    </div>
  );
}

function ViralRecoveryCard({ onDismiss }) {
  useLang();
  return (
    <StickerCard featured padded={false} hoverable={false}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 20 }}>
        <IconCircle color="secondary"><Icon name="lightning" size={18} fill /></IconCircle>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, margin: 0 }}>
            {t('One of your posts is taking off.', '有一篇貼文開始爆紅。')}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '4px 0 12px' }}>
            {t(
              '"what nobody tells you about freelancing" has 4.6× your average WES. Don\'t drop a follow-up too soon — the algorithm is still rewarding it.',
              '〈關於接案沒人會告訴你的事〉的 WES 是平均的 4.6 倍。先別急著發後續貼文 — 演算法還在加權它。'
            )}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="outline" size="sm">{t('View playbook', '查看操作手冊')}</Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>{t('Dismiss for 7 days', '7 天內不再顯示')}</Button>
          </div>
        </div>
        <button onClick={onDismiss} className="btn ghost" style={{ width: 32, height: 32, padding: 0 }} aria-label={t('Dismiss', '關閉')}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </StickerCard>
  );
}

Object.assign(window, { TokenExpiringBanner, TokenExpiredBanner, BackfillBanner, ViralRecoveryCard });
