/* AudienceScreen.jsx */
/* eslint-disable */

const FOLLOWER_HISTORY = [
  { d: 'Feb 1',  f: 1240 }, { d: 'Feb 5',  f: 1278 }, { d: 'Feb 10', f: 1322 },
  { d: 'Feb 15', f: 1410 }, { d: 'Feb 20', f: 1486 }, { d: 'Feb 22', f: 1620, spike: true },
  { d: 'Feb 26', f: 1702 }, { d: 'Mar 2',  f: 1768 }, { d: 'Mar 6',  f: 1825 },
  { d: 'Mar 10', f: 1980, spike: true }, { d: 'Mar 14', f: 2040 }, { d: 'Mar 18', f: 2112 },
];

function AudienceScreen() {
  const [showFocus, setShowFocus] = React.useState(false);
  const [showFit, setShowFit] = React.useState(false);

  return (
    <div className="col" style={{ gap: 24 }}>
      <StickerCard icon={<Icon name="trend-up" size={20} fill />} iconColor="quaternary">
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <StickerCardTitle>Follower Growth</StickerCardTitle>
              <StickerCardDescription><b className="tabular">+872</b> followers in the last 30 days · 2 viral spikes</StickerCardDescription>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {['7d','30d','90d','All'].map((r,i) => (
                <span key={r} className={`chip-filter${i === 1 ? ' active' : ''}`} style={{ height: 30, padding: '0 10px', fontSize: 12 }}>{r}</span>
              ))}
            </div>
          </div>
          <FollowerChart />
        </div>
      </StickerCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, paddingTop: 8 }}>
        <DemographicCard color="accent" icon="users" title="Country">
          <Bars items={[
            { label: 'United States',  pct: 48 },
            { label: 'United Kingdom', pct: 14 },
            { label: 'Canada',         pct: 9 },
            { label: 'Australia',      pct: 7 },
            { label: 'Germany',        pct: 5 },
          ]} />
        </DemographicCard>
        <DemographicCard color="secondary" icon="compass" title="City">
          <Bars items={[
            { label: 'New York', pct: 12 },
            { label: 'London',   pct: 9 },
            { label: 'Los Angeles', pct: 7 },
            { label: 'Toronto',  pct: 5 },
            { label: 'Berlin',   pct: 3 },
          ]} />
        </DemographicCard>
        <DemographicCard color="tertiary" icon="users" title="Gender">
          <Donut />
        </DemographicCard>
      </div>

      <CollapsibleCard
        open={showFocus} onToggle={() => setShowFocus(s => !s)}
        icon="crosshair" iconColor="accent"
        title="Semantic Focus"
        badge={{ label: 'Focused', score: 72, color: 'quaternary' }}>
        <div className="row" style={{ gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          <TopicCluster label="freelancing" share={34} />
          <TopicCluster label="creator economy" share={22} />
          <TopicCluster label="product design" share={18} />
          <TopicCluster label="off-topic" share={26} />
        </div>
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted-foreground)' }}>
          Your three clearest topics drive most of the engagement. Posts tagged "off-topic" get 41% fewer views.
        </p>
      </CollapsibleCard>

      <CollapsibleCard
        open={showFit} onToggle={() => setShowFit(s => !s)}
        icon="users" iconColor="secondary"
        title="Audience Fit"
        badge={{ label: 'Moderate', score: 58, color: 'tertiary' }}>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted-foreground)' }}>
          Your audience skews toward people who follow business and tech creators. Your top three topics align with this — but <b>"off-topic"</b> posts cost an average of 38% engagement.
        </p>
      </CollapsibleCard>
    </div>
  );
}

function FollowerChart() {
  const W = 1000, H = 220, PAD = 16;
  const max = Math.max(...FOLLOWER_HISTORY.map(p => p.f));
  const min = Math.min(...FOLLOWER_HISTORY.map(p => p.f));
  const xs = (i) => PAD + (i / (FOLLOWER_HISTORY.length - 1)) * (W - PAD * 2);
  const ys = (v) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);
  const points = FOLLOWER_HISTORY.map((p, i) => `${xs(i)},${ys(p.f)}`).join(' ');
  const area = `${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', marginTop: 16 }} aria-hidden>
      <polygon points={area} fill="rgba(139,92,246,0.12)" />
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {FOLLOWER_HISTORY.map((p, i) => p.spike ? (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(p.f)} r={7} fill="var(--secondary)" stroke="var(--foreground)" strokeWidth={2} />
        </g>
      ) : null)}
      {FOLLOWER_HISTORY.map((p, i) => i % 2 === 0 ? (
        <text key={i} x={xs(i)} y={H - 2} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)" fontFamily="Plus Jakarta Sans">{p.d}</text>
      ) : null)}
    </svg>
  );
}

function DemographicCard({ color, icon, title, children }) {
  return (
    <StickerCard icon={<Icon name={icon} size={18} fill />} iconColor={color}>
      <div style={{ marginTop: 12 }}>
        <StickerCardTitle>{title}</StickerCardTitle>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </StickerCard>
  );
}

function Bars({ items }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {items.map(it => (
        <div key={it.label}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>{it.label}</span>
            <span className="muted tabular" style={{ fontSize: 12 }}>{it.pct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--muted)', borderRadius: 9999, marginTop: 4, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
            <div style={{ height: '100%', width: `${it.pct * 1.8}%`, background: 'var(--accent)', borderRadius: 9999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut() {
  const total = 100;
  const segs = [
    { l: 'Women',     v: 58, c: 'var(--secondary)' },
    { l: 'Men',       v: 36, c: 'var(--accent)' },
    { l: 'Non-binary',v: 6,  c: 'var(--tertiary)' },
  ];
  let cum = 0;
  const C = 2 * Math.PI * 50;
  return (
    <div className="row" style={{ alignItems: 'center', gap: 14 }}>
      <svg viewBox="0 0 140 140" width={120} height={120}>
        <circle cx="70" cy="70" r="50" fill="none" stroke="var(--muted)" strokeWidth="20" />
        {segs.map((s, i) => {
          const dash = (s.v / total) * C;
          const off = -cum;
          cum += dash;
          return <circle key={i} cx="70" cy="70" r="50" fill="none"
            stroke={s.c} strokeWidth="20"
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off}
            transform="rotate(-90 70 70)" />
        })}
      </svg>
      <div className="col" style={{ gap: 8 }}>
        {segs.map(s => (
          <div key={s.l} className="row" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: s.c, borderRadius: 4 }} />
            <span>{s.l}</span>
            <span className="muted tabular" style={{ marginLeft: 'auto' }}>{s.v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollapsibleCard({ open, onToggle, icon, iconColor, title, badge, children }) {
  const sc = badge ? { primary: 'accent', secondary: 'secondary', tertiary: 'tertiary', quaternary: 'quaternary' }[badge.color] : null;
  return (
    <StickerCard icon={<Icon name={icon} size={18} fill />} iconColor={iconColor} hoverable={false} padded={false}>
      <div style={{ padding: '24px 24px 4px' }}>
        <button
          type="button"
          onClick={onToggle}
          style={{ all: 'unset', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <StickerCardTitle>{title}</StickerCardTitle>
          </div>
          {badge ? (
            <span style={{
              padding: '4px 10px', borderRadius: 9999,
              background: `var(--${sc})`,
              color: sc === 'tertiary' ? 'var(--foreground)' : 'white',
              fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span className="tabular">{badge.score}</span>
              <span style={{ opacity: 0.85 }}>· {badge.label}</span>
            </span>
          ) : null}
          <Icon name={open ? 'caret-up' : 'caret-down'} size={18} />
        </button>
        <div style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 300ms var(--ease-bounce)',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: 4, paddingBottom: 20 }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </StickerCard>
  );
}

function TopicCluster({ label, share }) {
  return (
    <div style={{
      padding: '12px 16px',
      border: '2px solid var(--foreground)', borderRadius: 9999,
      background: 'var(--card)', display: 'inline-flex', gap: 8, alignItems: 'center',
    }}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
      <span className="muted tabular" style={{ fontSize: 12 }}>{share}%</span>
    </div>
  );
}

Object.assign(window, { AudienceScreen });
