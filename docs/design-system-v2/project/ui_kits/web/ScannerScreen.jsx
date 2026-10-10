/* ScannerScreen.jsx */
/* eslint-disable */

function ScannerScreen({ onCrossToCompose }) {
  useLang();
  const [text, setText] = React.useState('');
  const [analysis, setAnalysis] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!text.trim()) { setAnalysis(null); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      setAnalysis(fakeAnalysis(text));
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [text]);

  const hasText = text.trim().length > 0;

  return (
    <StickerCard hoverable={false} padded={false}>
      <div style={{ padding: '28px 24px 24px' }}>
        <StickerCardTitle>{t('Content Scanner', '內容檢視')}</StickerCardTitle>
        <StickerCardDescription>
          {t(
            "We'll check for patterns the algorithm demotes and suggest improvements as you type.",
            '我們會檢查演算法會降觸及的特徵,並隨著你輸入即時給出改寫建議。'
          )}
        </StickerCardDescription>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, marginTop: 18, alignItems: 'flex-start' }}>
          <div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('Type or paste a draft post to analyze...', '輸入或貼上想分析的草稿…')}
              rows={6}
            />
            <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <Button variant="outline" size="sm"><Icon name="note" size={14} /> {t('Analyze an existing post', '分析已發布的貼文')}</Button>
              <span className="muted tabular" style={{ fontSize: 12 }}>{text.length} / 500</span>
            </div>
          </div>

          {hasText ? (
            <div className="col" style={{ alignItems: 'center', gap: 8 }}>
              <QualityGauge score={analysis ? analysis.score : 0} />
              {loading && (
                <p className="muted" style={{ fontSize: 12 }}>
                  {t('AI analysis in progress', 'AI 正在分析')}
                  <span className="cursor" />
                </p>
              )}
              {analysis && (
                <div style={{ textAlign: 'center' }}>
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}><b>{t('Tone:', '語氣:')}</b> {analysis.tone}</p>
                  <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {t('Predicted engagement:', '預期互動率:')} <b className="tabular">{analysis.predicted}%</b>
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {hasText && analysis ? (
          <div style={{ marginTop: 24 }}>
            <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Eyebrow>{t('Issues', '問題')}</Eyebrow>
                <div className="col" style={{ marginTop: 8, gap: 8 }}>
                  {analysis.issues.map((it, i) => (
                    <div key={i} className="row" style={{ gap: 10, padding: 12, border: '2px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <IconCircle color={it.severity === 'red' ? 'accent' : 'tertiary'} size="sm" style={it.severity === 'red' ? { background: 'var(--destructive)' } : {}}>
                        <Icon name="warning" size={14} />
                      </IconCircle>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{it.label}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{it.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1.2 }}>
                <Eyebrow>{t('Suggested rewrites', '改寫建議')}</Eyebrow>
                <div className="col" style={{ marginTop: 8, gap: 10 }}>
                  {analysis.rewrites.map((r, i) => (
                    <div key={i} style={{ padding: 14, border: '2px solid var(--foreground)', borderRadius: 'var(--radius-md)', background: 'rgba(52,211,153,0.06)' }}>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{r}</p>
                      <div className="row" style={{ marginTop: 10 }}>
                        <Button variant="outline" size="sm" onClick={() => setText(r)}><Icon name="check" size={14} /> {t('Apply', '套用')}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 18, justifyContent: 'center', gap: 12 }}>
              <Button size="sm" trailingIcon onClick={onCrossToCompose}>{t('Generate a better version', '產生更好的版本')}</Button>
              <Button variant="outline" size="sm"><Icon name="check" size={14} /> {t('Mark as published', '標記為已發布')}</Button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <EmptyState
              icon={<Icon name="magnifier" size={26} />}
              iconColor="quaternary"
              title={t('Type or paste a draft post to analyze', '輸入或貼上想分析的草稿')}
              description={t(
                "We'll check for patterns the algorithm demotes — clickbait, engagement bait, and semantic duplicates.",
                '我們會檢查演算法會降觸及的特徵 — 標題黨、互動釣魚、語意重複等。'
              )}
            />
          </div>
        )}
      </div>
    </StickerCard>
  );
}

function fakeAnalysis(text) {
  const len = text.trim().length;
  const tw = getLang() === 'tw';
  const hasCapsBait = /(YOU WON'T BELIEVE|MUST READ|RT IF|FOLLOW ME|快來|跟我說|快追蹤|轉發抽)/i.test(text);
  const hasQuestion = /[?\uff1f]\s*$/.test(text);
  const hasNumbers  = /\d/.test(text);
  // For CJK text each char carries more weight; threshold for "short" drops.
  const isCJK = /[\u4e00-\u9fff]/.test(text);
  const shortThreshold = isCJK ? 24 : 60;
  const longThreshold  = isCJK ? 180 : 280;

  let score = 70;
  if (hasCapsBait) score -= 25;
  if (len < shortThreshold) score -= 18;
  if (len > longThreshold)  score -= 8;
  if (hasQuestion) score += 6;
  if (hasNumbers)  score += 6;
  score = Math.max(8, Math.min(95, score));

  const issues = [];
  if (hasCapsBait) issues.push({
    severity: 'red',
    label: tw ? '偵測到互動釣魚' : 'Engagement bait detected',
    detail: tw ? 'Threads 會降低互動釣魚貼文的觸及。' : 'Threads down-ranks posts that ask for follows or RTs.',
  });
  if (len < shortThreshold) issues.push({
    severity: 'yellow',
    label: tw ? '貼文偏短' : 'Post is short',
    detail: tw ? `平均來說,短於 ${shortThreshold} 字的貼文互動率會少約三成。` : 'Posts under 60 chars get 32% less engagement on average.',
  });
  if (!hasQuestion) issues.push({
    severity: 'yellow',
    label: tw ? '沒有對話鉤子' : 'No conversational hook',
    detail: tw ? '結尾加一個問題能讓回覆數翻倍。' : 'Ending with a question doubles reply rate.',
  });

  let rewrites;
  if (tw) {
    rewrites = [
      (text || '').replace(/[!!]+/g, '。').trim() + (hasQuestion ? '' : ' 你怎麼看?'),
      '小碎念:沒人在講的那部分其實是 ' + (text || '').replace(/^["「『]/, '').slice(0, 80) + '\n你會加什麼?',
    ];
  } else {
    rewrites = [
      (text || '').replace(/!+/g, '.').replace(/(?:^|\s)(YOU WON'T BELIEVE[^.!?]*[.!?])/gi, '').trim()
        + (hasQuestion ? '' : ' What\u2019s your take?'),
      'tiny rant: the part nobody talks about is ' + (text || '').replace(/^["\u201c]?/, '').slice(0, 220) + '\nwhat would you add?',
    ];
  }
  rewrites = rewrites.map(s => s.trim()).filter(Boolean);

  const tone = hasCapsBait
    ? (tw ? '叫賣式 / 推廣' : 'shouty / promotional')
    : (len > longThreshold ? (tw ? '分析型' : 'analytical') : (tw ? '對話式' : 'conversational'));

  const niceFallback = tw
    ? { severity: 'yellow', label: '整體還不錯', detail: '微調幾處應該能再提升觸及。' }
    : { severity: 'yellow', label: 'Looks good overall', detail: 'Minor tweaks could improve reach further.' };

  return {
    score,
    tone,
    predicted: (4 + score / 40).toFixed(1),
    issues: issues.length ? issues : [niceFallback],
    rewrites,
  };
}

Object.assign(window, { ScannerScreen });
