/* Landing.jsx — marketing landing page */
/* eslint-disable */

function Landing({ onGetStarted }) {
  useLang();
  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: 'var(--background)' }}>
      <DecoCircle size={288} color="rgba(244,114,182,0.20)" top={-80} right={-80} />
      <DecoCircle size={256} color="rgba(139,92,246,0.15)" bottom={-96} left={-96} />
      <DecoCircle size={16}  color="var(--quaternary)" top="50%" right="30%" />
      <DecoSquare size={64}  color="rgba(244,114,182,0.40)" rotate={12} bottom="30%" left="25%" dashed />

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 32px 80px', display: 'flex', gap: 64, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            <DecoCircle size={96} color="rgba(251,191,36,0.6)" top={-16} left={-16} />
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 96, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>Spool</h1>
          </div>
          <p style={{ maxWidth: 460, fontSize: 17, color: 'var(--muted-foreground)', marginTop: 16, lineHeight: 1.6 }}>
            {t(
              "See what's working, understand the algorithm, and know what to post next. Spool turns your Threads data into algorithm-aware insights and AI-powered content recommendations.",
              '看清楚什麼有用、讀懂演算法、知道下一步該發什麼。Spool 把你的 Threads 數據變成讀懂演算法的洞察,以及由 AI 驅動的內容建議。'
            )}
          </p>
          <div style={{ marginTop: 32 }}>
            <Button size="lg" trailingIcon onClick={onGetStarted}>{t('Get Started', '開始使用')}</Button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <LandingIllustration />
        </div>
      </section>

      <section style={{ maxWidth: 980, margin: '0 auto', padding: '0 32px 96px' }}>
        <h2 style={{ textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 700, margin: 0 }}>
          {t('Analytics that understand the algorithm', '懂演算法的數據分析')}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', maxWidth: 600, margin: '12px auto 48px', lineHeight: 1.6 }}>
          {t('Track what works, learn why it works, and create more of it.', '追蹤什麼有效、了解為什麼有效,然後做更多有效的事。')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginBottom: 28, paddingTop: 28 }}>
          <FeatureCard color="accent"     icon="chart-bar"   title={t('Weighted Performance', '加權表現')}>
            {t('See how the algorithm scores your posts — shares and comments matter far more than likes.', '看演算法怎麼幫你的貼文打分 — 分享與留言的權重遠高於讚。')}
          </FeatureCard>
          <FeatureCard color="secondary"  icon="clock"       title={t('Timing & Cadence', '時段與節奏')}>
            {t('Find your best posting times and optimal spacing to avoid the diversity filter.', '找出最佳發文時段與發文間隔,避開演算法的多樣性過濾器。')}
          </FeatureCard>
          <FeatureCard color="tertiary"   icon="users"       title={t('Audience Fit', '受眾契合度')}>
            {t('Track follower growth, demographics, and whether your audience actually matches your niche.', '追蹤追蹤者成長、人口輪廓,看看受眾是否真的對到你的主題。')}
          </FeatureCard>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32, paddingTop: 28 }}>
          <FeatureCard color="quaternary" icon="lightning"   title={t('Content Scanner', '內容檢視')} fill>
            {t('Analyze your posts for patterns the algorithm demotes — clickbait, engagement bait, and semantic duplicates.', '檢查貼文裡會被演算法降觸及的特徵 — 標題黨、互動釣魚、語意重複。')}
          </FeatureCard>
          <FeatureCard color="accent"     icon="pencil-line" title={t('AI Composer', 'AI 撰寫助手')}>
            {t("Draft algorithm-optimized posts based on what's already working for your audience. Powered by your own data.", '根據你受眾已經喜歡的內容,產生為演算法調過的草稿。由你自己的數據驅動。')}
          </FeatureCard>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ color, icon, title, children, fill }) {
  return (
    <StickerCard icon={<Icon name={icon} size={20} fill={fill} />} iconColor={color}>
      <div style={{ marginTop: 14 }}>
        <StickerCardTitle>{title}</StickerCardTitle>
        <StickerCardDescription>{children}</StickerCardDescription>
      </div>
    </StickerCard>
  );
}

function LandingIllustration() {
  return (
    <svg viewBox="0 0 480 360" style={{ width: '100%' }} aria-hidden>
      <defs>
        <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#E2E8F0" />
        </pattern>
        <clipPath id="blob">
          <ellipse cx="240" cy="180" rx="210" ry="160" />
        </clipPath>
      </defs>
      <rect width="480" height="360" fill="url(#dot-grid)" clipPath="url(#blob)" />
      <rect x="120" y="80" width="240" height="200" rx="16" fill="white" stroke="#1E293B" strokeWidth="2" />
      <rect x="150" y="200" width="24" height="60"  rx="4" fill="#8B5CF6" />
      <rect x="186" y="170" width="24" height="90"  rx="4" fill="#F472B6" />
      <rect x="222" y="150" width="24" height="110" rx="4" fill="#FBBF24" />
      <rect x="258" y="180" width="24" height="80"  rx="4" fill="#34D399" />
      <rect x="294" y="160" width="24" height="100" rx="4" fill="#8B5CF6" />
      <rect x="150" y="105" width="80"  height="8" rx="4" fill="#E2E8F0" />
      <rect x="150" y="122" width="120" height="6" rx="3" fill="#F1F5F9" />
    </svg>
  );
}

Object.assign(window, { Landing });
