/* VoiceScreen.jsx — Brand Voice fingerprint, 11 dimensions × excerpts */
/* eslint-disable */

const VOICE_DIMENSIONS_BUILDER = () => ([
  { key: 'sentence_structure', label: t('Sentence Structure', '句構'), icon: 'text-t', color: 'accent',
    pattern: t(
      'Short declarative leads, then one elaborating clause separated by an em-dash. Rarely more than two sentences per beat.',
      '短句開頭點題,再用破折號接上一個延伸說明。一個段落幾乎不會超過兩句。'
    ),
    excerpts: [
      { text: t(
          "the real cost of context-switching isn't the switch — it's the 15 minutes you spend pretending you didn't.",
          '切換工作的真正代價,不是切換那一下 — 是你後面花十五分鐘假裝沒切換的時間。'
        ), post: 'p1' },
      { text: t(
          "shipped a thing today. it's smaller than i pitched. better than i thought.",
          '今天上線了一個東西。比我當初提案時小。比我想像中好。'
        ), post: 'p7' },
    ],
  },
  { key: 'tone_switching', label: t('Tone Switching', '語氣轉換'), icon: 'arrows-lr', color: 'secondary',
    pattern: t(
      'You start clinical and end personal — three sentences of data, then a single first-person admission to land it.',
      '你習慣從理性數據開頭,以一句第一人稱的自白收尾 — 三句數據,然後一句「我也是」。'
    ),
    excerpts: [
      { text: t(
          "62% of solo founders report 'isolation' as the worst part. i'm in that 62%. i think most of us are.",
          '62% 的個人創辦人覺得「孤獨」是最痛的部分。我就在那 62% 裡。我猜大多數人也都是。'
        ), post: 'p3' },
    ],
  },
  { key: 'emotional_expression', label: t('Emotional Expression', '情緒表達'), icon: 'heart', color: 'tertiary',
    pattern: t(
      "Restrained. You name a feeling once per post, never twice. The word 'tired' shows up more often than any other emotion.",
      '克制。每篇貼文只點名一次情緒,絕不重複。「累」出現的頻率比其他情緒詞都高。'
    ),
    excerpts: [
      { text: t('tired but in the good way. the way that means it mattered.', '累,但是那種好的累。代表這件事有意義的那種累。'), post: 'p2' },
    ],
  },
  { key: 'knowledge_presentation', label: t('Knowledge Presentation', '知識呈現'), icon: 'graduation', color: 'quaternary',
    pattern: t(
      "You teach by reframing, not by listing. 'The real thing about X is Y' is your most-used construction.",
      "你用『重新定義』來教學,而不是『列點』。最常用的句型是『X 真正的重點其實是 Y』。"
    ),
    excerpts: [
      { text: t(
          "the real thing about positioning isn't being different — it's being different in a way customers can repeat to their boss.",
          '定位真正的重點不是「跟別人不一樣」 — 是要不一樣到讓客戶能轉述給他老闆聽。'
        ), post: 'p4' },
    ],
  },
  { key: 'fan_vs_critic', label: t('Fan vs. Critic Reply Tone', '對粉絲與批評者的回覆語氣'), icon: 'chats', color: 'accent',
    pattern: t(
      'With fans: warm and brief. With critics: longer, plainly disagreeing, but never sarcastic. You name the disagreement explicitly.',
      '對粉絲:溫暖、簡短。對批評者:篇幅較長、清楚表達不同意,但絕不諷刺。你會把分歧點明說出來。'
    ),
    excerpts: [
      { text: t("i hear you and i still don't agree — here's why:", '我聽到了,但我還是不同意 — 原因是這樣的:'), post: 'p5' },
    ],
  },
  { key: 'analogies', label: t('Analogies', '比喻'), icon: 'tree', color: 'secondary',
    pattern: t('Almost always domestic — kitchens, gardens, laundry. Rarely sports, never finance.', '幾乎都用居家生活的比喻 — 廚房、園藝、洗衣服。很少用運動,從不用金融。'),
    excerpts: [
      { text: t(
          "you can't keep adding ingredients to a soup that's already done. taste, then change one thing.",
          '湯已經煮好了就別再加料。先嚐一口,再決定要動哪一樣。'
        ), post: 'p6' },
    ],
  },
  { key: 'humor', label: t('Humor', '幽默'), icon: 'smiley', color: 'tertiary',
    pattern: t('Dry and self-deprecating. The punchline is almost always you, never the audience.', '冷面、自嘲。笑點幾乎都在你自己身上,從不在聽眾身上。'),
    excerpts: [
      { text: t("i made a roadmap. then i made a roadmap for the roadmap. don't be me.", '我做了一份產品路線圖。然後又做了一份「給路線圖的路線圖」。別學我。'), post: 'p8' },
    ],
  },
  { key: 'self_reference', label: t('Self-Reference', '自我指涉'), icon: 'user-circle', color: 'quaternary',
    pattern: t(
      "You say 'i' freely but rarely 'me'. Almost never 'myself'. The most common reference is 'i'm not sure'.",
      "你很常用「我」當主詞,但很少把自己當受詞。最常出現的自我指涉是「我也不太確定」。"
    ),
    excerpts: [
      { text: t("i'm not sure i'm doing this right. ship anyway. note what surprised you.", '我不確定自己有沒有做對。先發出去再說,然後記下哪裡讓你意外。'), post: 'p9' },
    ],
  },
  { key: 'taboo_phrases', label: t('Taboo Phrases', '不會用的字眼'), icon: 'prohibit', color: 'accent',
    pattern: t(
      "You avoid: 'literally', 'absolutely', 'game-changer', exclamation marks, the word 'just' as filler.",
      "你避免使用:「字面上」、「絕對」、「翻轉遊戲規則」、驚嘆號、當填補詞用的「只是」。"
    ),
    excerpts: [
      { text: t("(this profile didn't surface any examples — your posts are clean.)", '(這個語氣面向沒找到任何範例 — 你的貼文很乾淨。)'), post: null, empty: true },
    ],
  },
  { key: 'paragraph_rhythm', label: t('Paragraph Rhythm', '段落節奏'), icon: 'text-align', color: 'secondary',
    pattern: t(
      '1 → 3 → 1 line cadence. A hook, a middle, a landing. You rarely write paragraphs longer than two lines.',
      '一行 → 三行 → 一行 的節奏。鉤子、中段、落點。你的段落幾乎不超過兩行。'
    ),
    excerpts: [
      { text: t(
          "small wins compound.\nnot in some 'james clear' way — i mean: the meeting you didn't ruin this morning makes the meeting you have to lead this afternoon 10% easier.\nthat's the whole thing.",
          '小勝會複利。\n不是那種「原子習慣」的講法 — 我是說:你早上沒搞砸的那場會議,會讓你下午要主持的那場輕鬆 10%。\n就這樣。'
        ), post: 'p10' },
    ],
  },
  { key: 'comment_reply_characteristics', label: t('Comment-Reply Characteristics', '回覆留言的特徵'), icon: 'chat', color: 'tertiary',
    pattern: t(
      "Replies open with an acknowledgement ('fair point', 'yes'), then add one new thing. Almost never a flat 'thanks'.",
      "回覆常常以「有道理」或「對」開頭,然後再補一點新東西。幾乎不會只回一句「謝謝」。"
    ),
    excerpts: [
      { text: t(
          "fair point — i'd add: the failure case is almost always 'we forgot why we started'.",
          '有道理 — 我會再補一點:失敗的情況幾乎都是「我們忘了為什麼開始」。'
        ), post: 'p11' },
    ],
  },
]);

function VoiceScreen() {
  useLang();
  const VOICE_DIMENSIONS = VOICE_DIMENSIONS_BUILDER();
  const [openKey, setOpenKey] = React.useState(VOICE_DIMENSIONS[0].key);
  const sample = 38;

  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 620 }}>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, margin: 0 }}>
              {t('Your Brand Voice', '你的品牌語氣')}
            </h2>
            <ConfidenceBadge sample={sample} />
          </div>
          <p style={{ marginTop: 8, color: 'var(--muted-foreground)' }}>
            {t(
              'Your voice fingerprint across 11 dimensions, with real excerpts from your own posts. The Composer uses this profile to keep drafts sounding like you.',
              '從 11 個面向勾勒你的品牌語氣指紋,並附上你自己貼文中的真實片段。AI 撰寫助手會用這份描述,讓草稿聽起來像你寫的。'
            )}
          </p>
        </div>
        <Button variant="outline" size="sm"><Icon name="refresh" size={14} /> {t('Refresh voice', '重新分析語氣')}</Button>
      </div>

      <div className="banner info">
        <IconCircle color="secondary" size="sm"><Icon name="sparkle" size={14} fill /></IconCircle>
        <div className="body">
          <b>{t(`Voice extracted from your top ${sample} posts.`, `已從你最佳的 ${sample} 篇貼文中萃取語氣。`)}</b>{' '}
          <span className="muted">{t('Refreshes automatically every 10 new posts.', '每 10 篇新貼文會自動更新一次。')}</span>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        {VOICE_DIMENSIONS.map((d) => (
          <VoiceCard
            key={d.key}
            dim={d}
            open={openKey === d.key}
            onToggle={() => setOpenKey(openKey === d.key ? null : d.key)}
          />
        ))}
      </div>
    </div>
  );
}

function VoiceCard({ dim, open, onToggle }) {
  return (
    <StickerCard hoverable={false} padded={false}
      icon={<Icon name={dim.icon} size={20} fill />}
      iconColor={dim.color}>
      <div style={{ padding: '24px 24px 4px' }}>
        <button onClick={onToggle}
          style={{ all: 'unset', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <StickerCardTitle>{dim.label}</StickerCardTitle>
            <StickerCardDescription>{dim.pattern}</StickerCardDescription>
          </div>
          <div className="row" style={{ gap: 12, flexShrink: 0, paddingTop: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
              {dim.excerpts.length} {t(dim.excerpts.length === 1 ? 'excerpt' : 'excerpts', '段引文')}
            </span>
            <Icon name={open ? 'caret-up' : 'caret-down'} size={18} />
          </div>
        </button>
        <div style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 300ms var(--ease-bounce)',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: 14, paddingBottom: 22 }}>
              <div className="col" style={{ gap: 10 }}>
                {dim.excerpts.map((ex, i) => (
                  <blockquote
                    key={i}
                    style={{
                      margin: 0, padding: '12px 16px',
                      border: '2px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'color-mix(in oklab, var(--muted) 50%, transparent)',
                      fontStyle: ex.empty ? 'italic' : 'normal',
                      color: ex.empty ? 'var(--muted-foreground)' : 'var(--foreground)',
                      whiteSpace: 'pre-wrap',
                      fontSize: 14, lineHeight: 1.55,
                    }}>
                    {ex.empty ? ex.text : `\u201C${ex.text}\u201D`}
                    {ex.post && !ex.empty && (
                      <a href="#"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                        {t('View post', '查看貼文')} <Icon name="arrow-square-out" size={12} fill />
                      </a>
                    )}
                  </blockquote>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StickerCard>
  );
}

function ConfidenceBadge({ sample }) {
  useLang();
  const tier =
    sample < 5 ?  { label: t('Directional', '參考用'), bg: 'var(--muted)', fg: 'var(--muted-foreground)', bd: 'var(--border)' } :
    sample < 10 ? { label: t('Weak', '弱'),            bg: 'rgba(251,191,36,0.25)', fg: 'var(--foreground)', bd: 'var(--tertiary)' } :
    sample < 20 ? { label: t('Usable', '可用'),        bg: 'rgba(139,92,246,0.15)', fg: 'var(--accent)', bd: 'rgba(139,92,246,0.4)' } :
    sample < 50 ? { label: t('Strong', '強'),          bg: 'rgba(52,211,153,0.25)', fg: 'var(--foreground)', bd: 'var(--quaternary)' } :
                  { label: t('Deep', '高'),            bg: 'var(--quaternary)', fg: '#fff', bd: 'var(--quaternary)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 9999,
      background: tier.bg, color: tier.fg,
      border: `1.5px solid ${tier.bd}`,
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span>{tier.label}</span>
      <span aria-hidden style={{ opacity: 0.5 }}>·</span>
      <span className="tabular">{t(`${sample} posts`, `${sample} 篇貼文`)}</span>
    </span>
  );
}

Object.assign(window, { VoiceScreen, ConfidenceBadge });
