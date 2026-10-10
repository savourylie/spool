/* ComposerScreen.jsx */
/* eslint-disable */

const STYLE_PRESETS_TW = {
  'Professional': '專業',
  'Casual':       '隨性',
  'Provocative':  '挑釁',
  'Educational':  '知識',
  'Humorous':     '幽默',
};

const STYLES = ['Professional', 'Casual', 'Provocative', 'Educational', 'Humorous'];

const DRAFT_TEMPLATES_TW = {
  Casual: [
    "我最喜歡的、沒人在講的一件事:你會把同一份工作重做三次才搞定。很無聊。很不上鏡。但事情就是這樣。",
    "今天把那個東西上線了。比我當初提案的規模小,但比我預期得好。沒人發現。我把這算成一勝。",
  ],
  Professional: [
    "過去 90 天做產品學到的三件事:\n1. 第一版應該讓你自己有點臉紅。\n2. 每週固定跟同樣那五位客戶聊。第三週就會浮現規律。\n3. 定價也是功能,要像功能一樣測試。",
    "大部分的產品回顧都死在「再多收集一點資料」這一步。解法:60 分鐘會議、每次都用同樣的四個問題、任何人離開房間前先把決議寫下來。",
  ],
  Provocative: [
    "「先 ship 再說」那一派是錯的。把沒想清楚的東西丟出來,雖然消耗信任的速度比不上「完全不發布」,但它還是會消耗。發之前先想一下。",
    "如果你的產品需要一段 90 秒的影片才能讓人聽懂,那你不是有產品,是有一份偽裝成產品的提案簡報。",
  ],
  Educational: [
    "WES(加權互動分數)會把回覆與分享的權重提高到「讚」的 8–10 倍。所以一篇拿 200 個讚加 50 則回覆的貼文,有時會贏過 800 個讚但只有 4 則回覆的貼文 — 而且贏不少。",
    "光看互動率是很雜訊的訊號。把它跟觸及(觀看數)、有意義回覆的比例一起看,才比較貼近演算法真正在獎勵什麼。",
  ],
  Humorous: [
    "每個個人創辦人最後都會寫一樣的 Threads 貼文:「過去這個安靜的一個月學到的三件事」。然後刪掉。然後再發出來。我這篇就是。團結一下。",
    "一個創辦人能做的最成熟的事,就是公開承認自己的產品路線圖大部分是憑感覺。這點我們可以接受。",
  ],
};

const DRAFT_TEMPLATES = {
  Professional: [
    "Three things I've learned launching a product in the last 90 days:\n1. The first version should embarrass you a little.\n2. Talk to the same 5 customers every week — patterns emerge by week 3.\n3. Pricing is a feature. Test it like one.",
    "Most product reviews die in the 'gather more data' phase. The fix: a 60-minute meeting, the same 4 questions every time, and a written decision before anyone leaves the room.",
  ],
  Casual: [
    "my favorite thing nobody talks about: the part where you redo the same task three times before it sticks. boring. unposeable. exactly how it works.",
    "shipped a thing today. it's smaller than i pitched. better than i thought. nobody noticed. i count that as a win.",
  ],
  Provocative: [
    "the 'just ship it' crowd is wrong. shipping a half-considered thing burns trust slower than not shipping at all — but it does burn it. consider before you blast.",
    "if your product requires a 90-second explainer video to make sense, you do not have a product. you have a pitch deck pretending to be one.",
  ],
  Educational: [
    "WES (Weighted Engagement Score) re-weights replies and shares 8–10× over likes. That's why a post with 200 likes and 50 replies will out-rank one with 800 likes and 4 replies — sometimes by a wide margin.",
    "Engagement rate alone is a noisy signal. Pair it with reach (views) and substantive-reply ratio for a much better picture of what the algorithm rewards.",
  ],
  Humorous: [
    "every founder eventually writes the same threads post: 'three lessons from a quiet month'. then they delete it. then they post it. i'm posting mine. solidarity.",
    "the most senior thing a founder can do is admit publicly that their roadmap is mostly vibes. love that for us.",
  ],
};

function ComposerScreen({ initialTopic = '' }) {
  useLang();
  const [topic, setTopic] = React.useState(initialTopic);
  const [style, setStyle] = React.useState('Casual');
  const [drafts, setDrafts] = React.useState([]);
  const [streaming, setStreaming] = React.useState(false);
  const timersRef = React.useRef([]);

  React.useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
  }, [initialTopic]);

  React.useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const stopStream = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStreaming(false);
  };

  const generate = () => {
    stopStream();
    setStreaming(true);
    const tplBank = getLang() === 'tw' ? DRAFT_TEMPLATES_TW : DRAFT_TEMPLATES;
    const picks = (tplBank[style] || tplBank.Casual).slice(0, 2);
    const next = picks.map((tpl, i) => ({
      i, text: '', complete: false, full: tpl, score: null,
    }));
    setDrafts(next);

    let charDelay = getLang() === 'tw' ? 36 : 12;  // slower for CJK since chars carry more weight
    let cursor = 0;
    next.forEach((d, di) => {
      for (let c = 1; c <= d.full.length; c++) {
        const t2 = setTimeout(() => {
          setDrafts((prev) => prev.map((x, idx) => idx === di ? { ...x, text: d.full.slice(0, c) } : x));
        }, cursor + di * 600);
        timersRef.current.push(t2);
        cursor += charDelay;
      }
      const done = setTimeout(() => {
        setDrafts((prev) => prev.map((x, idx) => idx === di ? { ...x, complete: true, score: scoreOf(d.full) } : x));
        if (di === next.length - 1) setStreaming(false);
      }, cursor + di * 600);
      timersRef.current.push(done);
    });
  };

  const surpriseMe = () => setTopic(t('what i wish i knew about building a side project in public', '我希望當初做副業時就有人告訴我的事'));
  const reset = () => { stopStream(); setDrafts([]); };

  const canGen = topic.trim().length > 0 && !streaming;
  const hasDrafts = drafts.length > 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 260px', gap: 20, alignItems: 'flex-start' }}>
      {/* LEFT */}
      <div className="col" style={{ gap: 14 }}>
        <div>
          <Eyebrow>{t('Topic', '主題')}</Eyebrow>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('What do you want to post about?', '你想發什麼主題?')}
            rows={5}
            disabled={streaming}
            style={{ marginTop: 6, minHeight: 110 }}
          />
          <div className="muted tabular" style={{ fontSize: 11, textAlign: 'right', marginTop: 4 }}>{topic.length} / 500</div>
        </div>
        <div>
          <Eyebrow>{t('Style', '風格')}</Eyebrow>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {STYLES.map(s => (
              <button key={s}
                onClick={() => setStyle(s)}
                disabled={streaming}
                style={{
                  cursor: streaming ? 'not-allowed' : 'pointer',
                  border: `2px solid ${style === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: style === s ? 'rgba(139,92,246,0.10)' : 'transparent',
                  color: style === s ? 'var(--accent)' : 'var(--muted-foreground)',
                  borderRadius: 9999, padding: '4px 12px',
                  fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
                }}>
                {t(s, STYLE_PRESETS_TW[s])}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={generate} disabled={!canGen}>
          <Icon name="pencil-line" size={14} /> {t('Generate Drafts', '產生草稿')}
        </Button>
        {!hasDrafts && !streaming && (
          <Button variant="outline" size="sm" onClick={surpriseMe}>
            <Icon name="sparkle" size={14} /> {t('Generate ideas for me', '幫我想點子')}
          </Button>
        )}
        {hasDrafts && !streaming && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <Icon name="x" size={14} /> {t('Start fresh', '重新開始')}
          </Button>
        )}
      </div>

      {/* CENTER */}
      <div className="col" style={{ gap: 16 }}>
        {!hasDrafts && !streaming && (
          <EmptyState
            icon={<Icon name="pencil-line" size={26} />}
            iconColor="accent"
            title={t('Draft something the algorithm will love', '寫一篇演算法會喜歡的貼文')}
            description={t(
              "Enter a topic and pick a style. Spool will generate two algorithm-tuned drafts based on what's worked for your audience.",
              '輸入主題、挑一個風格,Spool 會根據你的受眾過去喜歡的內容,產生兩份針對演算法調過的草稿。'
            )}
          />
        )}

        {drafts.map((d, i) => (
          <DraftCard key={d.i} d={d} active={i === 0} />
        ))}

        {streaming && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button variant="outline" size="sm" onClick={stopStream}>
              <Icon name="stop" size={14} /> {t('Stop generating', '停止產生')}
            </Button>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className="col" style={{ gap: 16 }}>
        {hasDrafts && (
          <>
            <SidePanel title={t('Quality', '品質')} icon="check" color="quaternary">
              <div style={{ marginTop: 4 }}>
                <QualityGauge score={drafts[0]?.score ?? 0} />
              </div>
            </SidePanel>
            <SidePanel title={t('Predicted reach', '預期觸及')} icon="trend-up" color="accent">
              <Stat label={t('P25 → P75', 'P25 → P75')} value={t('3.6K – 9.2K views', '3.6K – 9.2K 次觀看')} />
              <Stat label={t('Predicted eng.', '預期互動率')} value="6.4%" highlight />
            </SidePanel>
            <SidePanel title={t('Best times', '最佳時段')} icon="clock" color="secondary">
              <Stat label={t('Tue', '週二')} value={t('9 AM', '上午 9 點')} />
              <Stat label={t('Thu', '週四')} value={t('7 PM', '晚上 7 點')} />
              <Stat label={t('Sat', '週六')} value={t('10 AM', '上午 10 點')} />
              <div style={{ marginTop: 8 }}>
                <a className="muted" style={{ fontSize: 12, textDecoration: 'underline' }} href="#timing">{t('See full analysis →', '查看完整分析 →')}</a>
              </div>
            </SidePanel>
            <SidePanel title={t('Topic ideas', '主題點子')} icon="lightbulb" color="tertiary">
              <TopicSuggest label={t('solo founder pricing', '個人創辦人的定價策略')} />
              <TopicSuggest label={t('why notion templates flop', '為什麼 Notion 模板賣不動')} />
              <TopicSuggest label={t('bad onboarding patterns', '糟糕的新手引導模式')} />
            </SidePanel>
          </>
        )}
      </div>
    </div>
  );
}

function DraftCard({ d, active }) {
  useLang();
  const [copied, setCopied] = React.useState(false);
  return (
    <StickerCard featured={active} hoverable={false} padded={false} flat={!active && !d.complete}>
      <div style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Eyebrow>{t(`Draft ${d.i + 1}${active ? ' · selected' : ''}`, `草稿 ${d.i + 1}${active ? ' · 已選' : ''}`)}</Eyebrow>
          {d.score != null ? (
            <span style={{
              padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
              border: '1.5px solid',
              borderColor: d.score < 40 ? 'var(--destructive)' : d.score < 70 ? 'var(--tertiary)' : 'var(--quaternary)',
              color: d.score < 40 ? 'var(--destructive)' : d.score < 70 ? 'var(--tertiary)' : 'var(--quaternary)',
              background: d.score < 40 ? 'rgba(239,68,68,0.10)' : d.score < 70 ? 'rgba(251,191,36,0.10)' : 'rgba(52,211,153,0.10)',
            }}>
              {d.score}/100
            </span>
          ) : null}
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {d.text}
          {!d.complete ? <span className="cursor" /> : null}
        </p>
        {d.complete && (
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(d.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              <Icon name="clipboard" size={14} /> {copied ? t('Copied! Paste into Threads', '已複製 — 貼到 Threads 即可發布') : t('Copy', '複製')}
            </Button>
            <Button variant="ghost" size="sm"><Icon name="pencil" size={14} /> {t('Edit', '編輯')}</Button>
            <Button variant="ghost" size="sm"><Icon name="refresh" size={14} /> {t('Regenerate', '重新生成')}</Button>
          </div>
        )}
      </div>
    </StickerCard>
  );
}

function SidePanel({ title, icon, color, children }) {
  return (
    <div style={{ padding: 14, border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--card)' }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <IconCircle color={color} size="sm"><Icon name={icon} size={13} fill /></IconCircle>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 600, color: highlight ? 'var(--accent)' : 'var(--foreground)' }}>{value}</span>
    </div>
  );
}

function TopicSuggest({ label }) {
  return (
    <div style={{ padding: '6px 10px', borderRadius: 9999, background: 'var(--muted)', fontSize: 12, fontWeight: 600, marginTop: 6, cursor: 'pointer' }}>
      {label}
    </div>
  );
}

function scoreOf(text) {
  let s = 60;
  if (text.length > 100) s += 12;
  if (/\?/.test(text))    s += 6;
  if (/\d/.test(text))    s += 6;
  if (text.length > 240)  s += 4;
  if (/[A-Z]{4,}/.test(text)) s -= 18;
  return Math.max(20, Math.min(94, s));
}

Object.assign(window, { ComposerScreen });
