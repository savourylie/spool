/* app.jsx — top-level router for the Spool UI kit */
/* eslint-disable */

const ROUTES = {
  landing:   { kind: 'standalone', component: Landing },
  loading:   { kind: 'standalone', component: Loading },
  today:     { kind: 'dashboard',  title: 'Today',            eyebrow: 'overview',   screen: 'TodayScreen' },
  posts:     { kind: 'dashboard',  title: 'Post Performance', eyebrow: 'understand', screen: 'PostsScreen' },
  timing:    { kind: 'dashboard',  title: 'Timing',           eyebrow: 'create',     screen: 'TimingScreen' },
  audience:  { kind: 'dashboard',  title: 'Audience',         eyebrow: 'understand', screen: 'AudienceScreen' },
  voice:     { kind: 'dashboard',  title: 'Your Brand Voice', eyebrow: 'understand', screen: 'VoiceScreen' },
  scanner:   { kind: 'dashboard',  title: 'Content Scanner',  eyebrow: 'create',     screen: 'ScannerScreen' },
  composer:  { kind: 'dashboard',  title: 'AI Composer',      eyebrow: 'create',     screen: 'ComposerScreen' },
  settings:  { kind: 'dashboard',  title: 'Settings',         eyebrow: 'account',    screen: 'PlaceholderScreen' },
};

function getRoute() {
  const h = location.hash.replace('#', '').split('?')[0];
  return ROUTES[h] ? h : 'landing';
}

function getQuery() {
  const i = location.hash.indexOf('?');
  if (i < 0) return {};
  return Object.fromEntries(new URLSearchParams(location.hash.slice(i + 1)));
}

function App() {
  useLang();
  const [route, setRoute] = React.useState(getRoute);
  const [query, setQuery] = React.useState(getQuery);

  React.useEffect(() => {
    const onHash = () => { setRoute(getRoute()); setQuery(getQuery()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next, params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    location.hash = next + qs;
  };

  // Recompute route metadata each render so titles re-translate.
  const ROUTES_I18N = {
    landing:  { kind: 'standalone' },
    loading:  { kind: 'standalone' },
    today:    { kind: 'dashboard',  title: t('Today',           '今天'),            eyebrow: t('overview',   '總覽'),   screen: 'TodayScreen' },
    posts:    { kind: 'dashboard',  title: t('Post Performance','貼文成效'),       eyebrow: t('understand', '了解'),   screen: 'PostsScreen' },
    timing:   { kind: 'dashboard',  title: t('Timing',          '發文時段'),       eyebrow: t('create',     '創作'),   screen: 'TimingScreen' },
    audience: { kind: 'dashboard',  title: t('Audience',        '受眾'),           eyebrow: t('understand', '了解'),   screen: 'AudienceScreen' },
    voice:    { kind: 'dashboard',  title: t('Your Brand Voice','你的品牌語氣'),   eyebrow: t('understand', '了解'),   screen: 'VoiceScreen' },
    scanner:  { kind: 'dashboard',  title: t('Content Scanner', '內容檢視'),       eyebrow: t('create',     '創作'),   screen: 'ScannerScreen' },
    composer: { kind: 'dashboard',  title: t('AI Composer',     'AI 撰寫助手'),    eyebrow: t('create',     '創作'),   screen: 'ComposerScreen' },
    settings: { kind: 'dashboard',  title: t('Settings',        '設定'),           eyebrow: t('account',    '帳號'),   screen: 'PlaceholderScreen' },
  };
  const def = ROUTES_I18N[route] || ROUTES_I18N.landing;

  if (def.kind === 'standalone') {
    if (route === 'landing') return <Landing onGetStarted={() => go('loading')} />;
    if (route === 'loading') return <Loading onDone={() => go('posts')} />;
  }

  // Dashboard
  const screenMap = {
    TodayScreen: () => <TodayScreen onNavigate={go} />,
    PostsScreen: () => <PostsScreen />,
    TimingScreen: () => <TimingScreen />,
    AudienceScreen: () => <AudienceScreen />,
    ScannerScreen: () => <ScannerScreen onCrossToCompose={() => go('composer', { topic: 'the part of freelancing nobody talks about' })} />,
    ComposerScreen: () => <ComposerScreen initialTopic={query.topic || ''} />,
    VoiceScreen: () => <VoiceScreen />,
    PlaceholderScreen: () => <PlaceholderScreen name={def.title} />,
  };

  const banner = route === 'posts' ? <BackfillBanner done={142} total={260} /> :
                 route === 'audience' ? <ViralRecoveryCard /> :
                 route === 'composer' ? <TokenExpiringBanner daysLeft={6} /> :
                 null;

  return (
    <Shell
      active={route}
      onNavigate={(r) => { if (r === 'landing') go('landing'); else go(r); }}
      title={def.title}
      eyebrow={def.eyebrow}
      banner={banner}
    >
      {screenMap[def.screen]()}
    </Shell>
  );
}

function TodayScreen({ onNavigate }) {
  return (
    <div className="col" style={{ gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, paddingTop: 8 }}>
        <StatCard icon="trend-up"  color="quaternary" title={t('Followers',  '追蹤者')}   value="2,112"  delta={t('+128 this week',           '本週 +128')} />
        <StatCard icon="chart-bar" color="accent"     title={t('Avg WES',    '平均 WES')} value="1.74"   delta={t('↑ 0.21 vs last week',     '↑ 0.21 較上週')} />
        <StatCard icon="clock"     color="secondary"  title={t('Last posted','最近發文')} value={t('3h ago', '3 小時前')} delta={t('Tue 4 PM · in your slot', '週二下午 4 點 · 你的時段')} />
      </div>

      <StickerCard featured icon={<Icon name="lightning" size={18} fill />} iconColor="secondary">
        <div style={{ marginTop: 12 }}>
          <StickerCardTitle>
            {t('One of your posts is taking off.', '有一篇貼文開始爆紅。')}
          </StickerCardTitle>
          <StickerCardDescription>
            {t(
              <>"what nobody tells you about freelancing" has <b>4.6× your average WES</b>. Don't drop a follow-up too soon — the algorithm is still rewarding it.</>,
              <>〈關於接案沒人會告訴你的事〉的 WES 是平均的 <b>4.6 倍</b>。先別急著發後續貼文 — 演算法還在加權它。</>
            )}
          </StickerCardDescription>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Button size="sm" trailingIcon onClick={() => onNavigate('posts')}>{t('See the post', '查看貼文')}</Button>
            <Button variant="outline" size="sm">{t('View playbook', '查看操作手冊')}</Button>
          </div>
        </div>
      </StickerCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <StickerCard icon={<Icon name="pencil-line" size={18} fill />} iconColor="accent">
          <div style={{ marginTop: 12 }}>
            <StickerCardTitle>{t('What to post next', '接下來該發什麼')}</StickerCardTitle>
            <StickerCardDescription>{t('Your audience responded best to short, opinionated posts this week.', '本週你的受眾對簡短、有觀點的貼文反應最好。')}</StickerCardDescription>
            <div className="col" style={{ marginTop: 10, gap: 6 }}>
              <TopicLine>{t("tiny rant about a word you can't stand in product copy", '對產品文案中你受不了的某個字眼的一段小碎念')}</TopicLine>
              <TopicLine>{t('one thing you redid three times this month before it stuck', '這個月你重做了三次才搞定的一件事')}</TopicLine>
              <TopicLine>{t('the bad advice you almost took, and what you did instead', '你差點採納的爛建議,以及最後怎麼處理的')}</TopicLine>
            </div>
            <Button size="sm" style={{ marginTop: 14 }} onClick={() => onNavigate('composer')}>{t('Open composer', '開啟撰寫助手')}</Button>
          </div>
        </StickerCard>
        <StickerCard icon={<Icon name="clock" size={18} fill />} iconColor="tertiary">
          <div style={{ marginTop: 12 }}>
            <StickerCardTitle>{t('When to post next', '何時發文最好')}</StickerCardTitle>
            <StickerCardDescription>{t('Your three highest-engagement windows this week.', '本週你互動最高的三個時段。')}</StickerCardDescription>
            <div className="col" style={{ marginTop: 14, gap: 8 }}>
              <SlotRow day={t('Tue','週二')} time={t('9:00 AM','上午 9:00')} eng="6.4%" />
              <SlotRow day={t('Thu','週四')} time={t('7:00 PM','晚上 7:00')} eng="5.9%" />
              <SlotRow day={t('Sat','週六')} time={t('10:00 AM','上午 10:00')} eng="5.6%" />
            </div>
            <Button variant="outline" size="sm" style={{ marginTop: 14 }} onClick={() => onNavigate('timing')}>{t('See full heatmap', '查看完整熱力圖')}</Button>
          </div>
        </StickerCard>
      </div>
    </div>
  );
}

function StatCard({ icon, color, title, value, delta }) {
  return (
    <StickerCard icon={<Icon name={icon} size={18} fill />} iconColor={color} hoverable={false}>
      <div style={{ marginTop: 12 }}>
        <Eyebrow>{title}</Eyebrow>
        <div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 36, marginTop: 4 }}>{value}</div>
        <div className="muted" style={{ fontSize: 12 }}>{delta}</div>
      </div>
    </StickerCard>
  );
}

function TopicLine({ children }) {
  return <div style={{ padding: '8px 12px', background: 'var(--muted)', borderRadius: 9999, fontSize: 13, fontWeight: 500 }}>{children}</div>;
}

function SlotRow({ day, time, eng }) {
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

function PlaceholderScreen({ name }) {
  return (
    <StickerCard hoverable={false}>
      <EmptyState
        icon={<Icon name="lightbulb" size={26} fill />}
        iconColor="tertiary"
        title={`${name} — not in this kit`}
        description="This surface is referenced in the codebase but the prototype focuses on Posts, Timing, Audience, Scanner, and Composer."
      />
    </StickerCard>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
