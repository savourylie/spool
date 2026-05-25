/* TimingScreen.jsx */
/* eslint-disable */

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function makeHeatmapData() {
  // Pre-baked engagement-rate values; null = no data
  const m = [];
  const rng = mulberry(42);
  for (let d = 0; d < 7; d++) {
    const row = [];
    for (let h = 0; h < 24; h++) {
      // Make some hours empty, others gradient. Bias peak hours.
      const r = rng();
      const isOff = h < 6 || h > 22 || r < 0.45;
      if (isOff) row.push(null);
      else {
        const peak = (h >= 8 && h <= 11) || (h >= 18 && h <= 21);
        const v = peak ? 2 + r * 3 : 0.5 + r * 1.6;
        row.push(v);
      }
    }
    m.push(row);
  }
  return m;
}
function mulberry(a){ return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function interp(t) {
  const h = 210 + (263 - 210) * t;
  const s = 40 + (90 - 40) * t;
  const l = 96 + (66 - 96) * t;
  return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
}

function TimingScreen() {
  const data = React.useMemo(() => makeHeatmapData(), []);
  let min = Infinity, max = -Infinity;
  for (const row of data) for (const v of row) if (v != null) { min = Math.min(min, v); max = Math.max(max, v); }
  const range = max - min;

  return (
    <div className="col" style={{ gap: 24 }}>
      <StickerCard hoverable={false} padded={false}>
        <div style={{ padding: '28px 24px 24px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <StickerCardTitle>Best Time to Post</StickerCardTitle>
              <StickerCardDescription>Best times: Tue 9 AM · Thu 7 PM · Sat 10 AM</StickerCardDescription>
            </div>
            <select className="input" style={{ height: 36, width: 200, padding: '0 10px', fontSize: 13 }} defaultValue="America/Los_Angeles">
              <option>America/Los_Angeles</option>
              <option>America/New_York</option>
              <option>Europe/London</option>
              <option>UTC</option>
            </select>
          </div>

          <div className="banner warn" style={{ marginTop: 18 }}>
            <IconCircle color="tertiary" size="sm"><Icon name="warning" size={14} /></IconCircle>
            <div className="body">Post more to improve accuracy. Based on <b>14 posts</b> so far.</div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="heatmap" style={{ marginBottom: 4 }}>
              <div />
              {Array.from({length:24}, (_,i) => (
                <div key={i} className="hour-label">{hourLabel(i)}</div>
              ))}
            </div>
            {data.map((row, di) => (
              <div key={di} className="heatmap" style={{ marginBottom: 3 }}>
                <div className="day-label">{DAYS[di]}</div>
                {row.map((v, hi) => {
                  if (v == null) return <div key={hi} className="cell empty" />;
                  const t = (v - min) / (range || 1);
                  return <div key={hi} className="cell"
                    style={{ background: interp(t), color: t > 0.5 ? '#fff' : 'var(--foreground)' }}>
                      {Math.round(v * 10) / 10}
                    </div>;
                })}
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
            <span>Lower</span>
            <div style={{ height: 8, width: 100, borderRadius: 4, background: `linear-gradient(to right, ${interp(0)}, ${interp(0.5)}, ${interp(1)})` }} />
            <span>Higher</span>
          </div>
        </div>
      </StickerCard>

      <StickerCard icon={<Icon name="clock-history" size={20} />} iconColor="tertiary">
        <div style={{ marginTop: 12 }}>
          <StickerCardTitle>Cadence Optimizer</StickerCardTitle>
          <StickerCardDescription>Your posts spaced 4+ hours apart get <b>34%</b> more views on average.</StickerCardDescription>
          <div className="row" style={{ gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
            <CadenceTile label="< 2h apart"  views="1.2K" eng="3.1%" />
            <CadenceTile label="2–4h apart"  views="2.4K" eng="4.8%" highlight />
            <CadenceTile label="4–8h apart"  views="3.1K" eng="5.6%" highlight />
            <CadenceTile label="> 8h apart"  views="2.0K" eng="4.2%" />
          </div>
        </div>
      </StickerCard>
    </div>
  );
}

function hourLabel(i) {
  if (i === 0)  return '12a';
  if (i < 12)   return `${i}a`;
  if (i === 12) return '12p';
  return `${i - 12}p`;
}

function CadenceTile({ label, views, eng, highlight }) {
  return (
    <div style={{
      flex: '1 1 180px', padding: 16,
      border: '2px solid var(--foreground)', borderRadius: 'var(--radius-md)',
      background: highlight ? 'rgba(52,211,153,0.10)' : 'var(--card)',
      boxShadow: highlight ? '4px 4px 0 0 var(--quaternary)' : 'var(--shadow-default)',
    }}>
      <Eyebrow>{label}</Eyebrow>
      <div className="row" style={{ marginTop: 10, gap: 18 }}>
        <div><div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>{views}</div><div className="muted" style={{ fontSize: 11 }}>avg views</div></div>
        <div><div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>{eng}</div><div className="muted" style={{ fontSize: 11 }}>eng. rate</div></div>
      </div>
    </div>
  );
}

Object.assign(window, { TimingScreen });
