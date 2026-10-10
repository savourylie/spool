/* app-print.jsx — renders all dashboard screens as stacked print pages */
/* eslint-disable */

function PrintShell({ active, title, eyebrow, sectionLabel, banner, children }) {
  return (
    <div className="shell">
      <Sidebar active={active} onNavigate={() => {}} />
      <main className="shell-main">
        <header className="shell-header">
          <div className="shell-header-row">
            <div className="col" style={{ gap: 2 }}>
              {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
              <div className="shell-title">{title}</div>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>@maya.makes</span>
          </div>
        </header>
        <div className="shell-content">
          {sectionLabel ? <div className="print-section-label">{sectionLabel}</div> : null}
          {banner ? <div style={{ marginBottom: 18 }}>{banner}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}

function PrintApp() {
  useLang();
  return (
    <>
      {/* Cover — landing */}
      <section className="print-page">
        <Landing onGetStarted={() => {}} />
      </section>

      {/* Loading splash */}
      <section className="print-page">
        <Loading onDone={() => {}} />
      </section>

      {/* Dashboard surfaces */}
      <section className="print-page">
        <PrintShell active="today" title={t('Today', '今天')} eyebrow={t('overview', '總覽')}
          sectionLabel="01 · Today">
          <TodayScreenStatic />
        </PrintShell>
      </section>

      <section className="print-page">
        <PrintShell active="posts" title={t('Post Performance', '貼文成效')} eyebrow={t('understand', '了解')}
          sectionLabel="02 · Posts"
          banner={<BackfillBanner done={142} total={260} />}>
          <PostsScreen />
        </PrintShell>
      </section>

      <section className="print-page">
        <PrintShell active="timing" title={t('Timing', '發文時段')} eyebrow={t('create', '創作')}
          sectionLabel="03 · Timing">
          <TimingScreen />
        </PrintShell>
      </section>

      <section className="print-page">
        <PrintShell active="audience" title={t('Audience', '受眾')} eyebrow={t('understand', '了解')}
          sectionLabel="04 · Audience"
          banner={<ViralRecoveryCard onDismiss={() => {}} />}>
          <AudienceScreen />
        </PrintShell>
      </section>

      <section className="print-page">
        <PrintShell active="voice" title={t('Your Brand Voice', '你的品牌語氣')} eyebrow={t('understand', '了解')}
          sectionLabel="05 · Voice">
          <VoiceScreen />
        </PrintShell>
      </section>

      <section className="print-page">
        <PrintShell active="scanner" title={t('Content Scanner', '內容檢視')} eyebrow={t('create', '創作')}
          sectionLabel="06 · Scanner">
          <ScannerScreen onCrossToCompose={() => {}} />
        </PrintShell>
      </section>

      <section className="print-page">
        <PrintShell active="composer" title={t('AI Composer', 'AI 撰寫助手')} eyebrow={t('create', '創作')}
          sectionLabel="07 · Composer"
          banner={<TokenExpiringBanner daysLeft={6} />}>
          <ComposerScreen
            initialTopic={t(
              "what i wish i knew about building a side project in public",
              "我希望當初做副業時就有人告訴我的事"
            )}
          />
        </PrintShell>
      </section>
    </>
  );
}

// Static version of the "Today" screen — no onNavigate behaviour, no hover.
function TodayScreenStatic() {
  useLang();
  return (
    <div className="col" style={{ gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, paddingTop: 8 }}>
        <StickerCard icon={<Icon name="trend-up" size={18} fill />} iconColor="quaternary" hoverable={false}>
          <div style={{ marginTop: 12 }}>
            <Eyebrow>{t('Followers', '追蹤者')}</Eyebrow>
            <div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 36, marginTop: 4 }}>2,112</div>
            <div className="muted" style={{ fontSize: 12 }}>{t('+128 this week', '本週 +128')}</div>
          </div>
        </StickerCard>
        <StickerCard icon={<Icon name="chart-bar" size={18} fill />} iconColor="accent" hoverable={false}>
          <div style={{ marginTop: 12 }}>
            <Eyebrow>{t('Avg WES', '平均 WES')}</Eyebrow>
            <div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 36, marginTop: 4 }}>1.74</div>
            <div className="muted" style={{ fontSize: 12 }}>{t('↑ 0.21 vs last week', '↑ 0.21 較上週')}</div>
          </div>
        </StickerCard>
        <StickerCard icon={<Icon name="clock" size={18} fill />} iconColor="secondary" hoverable={false}>
          <div style={{ marginTop: 12 }}>
            <Eyebrow>{t('Last posted', '最近發文')}</Eyebrow>
            <div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 36, marginTop: 4 }}>{t('3h ago', '3 小時前')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t('Tue 4 PM · in your slot', '週二下午 4 點 · 你的時段')}</div>
          </div>
        </StickerCard>
      </div>

      <StickerCard featured hoverable={false} icon={<Icon name="lightning" size={18} fill />} iconColor="secondary">
        <div style={{ marginTop: 12 }}>
          <StickerCardTitle>{t('One of your posts is taking off.', '有一篇貼文開始爆紅。')}</StickerCardTitle>
          <StickerCardDescription>
            {t(
              <>"what nobody tells you about freelancing" has <b>4.6× your average WES</b>. Don't drop a follow-up too soon — the algorithm is still rewarding it.</>,
              <>〈關於接案沒人會告訴你的事〉的 WES 是平均的 <b>4.6 倍</b>。先別急著發後續貼文 — 演算法還在加權它。</>
            )}
          </StickerCardDescription>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Button size="sm" trailingIcon>{t('See the post', '查看貼文')}</Button>
            <Button variant="outline" size="sm">{t('View playbook', '查看操作手冊')}</Button>
          </div>
        </div>
      </StickerCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <StickerCard hoverable={false} icon={<Icon name="pencil-line" size={18} fill />} iconColor="accent">
          <div style={{ marginTop: 12 }}>
            <StickerCardTitle>{t('What to post next', '接下來該發什麼')}</StickerCardTitle>
            <StickerCardDescription>{t('Your audience responded best to short, opinionated posts this week.', '本週你的受眾對簡短、有觀點的貼文反應最好。')}</StickerCardDescription>
            <div className="col" style={{ marginTop: 10, gap: 6 }}>
              <div style={{ padding: '8px 12px', background: 'var(--muted)', borderRadius: 9999, fontSize: 13 }}>{t("tiny rant about a word you can't stand in product copy", '對產品文案中你受不了的某個字眼的一段小碎念')}</div>
              <div style={{ padding: '8px 12px', background: 'var(--muted)', borderRadius: 9999, fontSize: 13 }}>{t('one thing you redid three times this month before it stuck', '這個月你重做了三次才搞定的一件事')}</div>
              <div style={{ padding: '8px 12px', background: 'var(--muted)', borderRadius: 9999, fontSize: 13 }}>{t('the bad advice you almost took, and what you did instead', '你差點採納的爛建議,以及最後怎麼處理的')}</div>
            </div>
            <Button size="sm" style={{ marginTop: 14 }}>{t('Open composer', '開啟撰寫助手')}</Button>
          </div>
        </StickerCard>
        <StickerCard hoverable={false} icon={<Icon name="clock" size={18} fill />} iconColor="tertiary">
          <div style={{ marginTop: 12 }}>
            <StickerCardTitle>{t('When to post next', '何時發文最好')}</StickerCardTitle>
            <StickerCardDescription>{t('Your three highest-engagement windows this week.', '本週你互動最高的三個時段。')}</StickerCardDescription>
            <div className="col" style={{ marginTop: 14, gap: 8 }}>
              <SlotRowS day={t('Tue','週二')} time={t('9:00 AM','上午 9:00')} eng="6.4%" />
              <SlotRowS day={t('Thu','週四')} time={t('7:00 PM','晚上 7:00')} eng="5.9%" />
              <SlotRowS day={t('Sat','週六')} time={t('10:00 AM','上午 10:00')} eng="5.6%" />
            </div>
            <Button variant="outline" size="sm" style={{ marginTop: 14 }}>{t('See full heatmap', '查看完整熱力圖')}</Button>
          </div>
        </StickerCard>
      </div>
    </div>
  );
}

function SlotRowS({ day, time, eng }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '10px 14px', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, width: 32 }}>{day}</span>
        <span style={{ fontSize: 13 }}>{time}</span>
      </div>
      <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--quaternary)' }}>{eng}</span>
    </div>
  );
}

// ── Mount, then auto-print once fonts + Phosphor icons + initial render settle ──

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<PrintApp />);

(async function maybeAutoPrint() {
  // Only auto-print if requested via ?print=1 (the open_for_print tool sets this)
  const params = new URLSearchParams(location.search);
  const auto = params.get('print') === '1' || params.has('print');

  // Wait for fonts (Outfit, Plus Jakarta Sans, Noto Sans TC)
  try { await document.fonts.ready; } catch {}

  // Wait for all Phosphor icon fetches in flight to settle
  const cache = window._phosphorCache;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (cache && cache.size > 30) break;       // pretty much all loaded
  }
  // A tiny buffer for any final React commit
  await new Promise(r => setTimeout(r, 500));

  if (auto) {
    window.print();
  }
})();
