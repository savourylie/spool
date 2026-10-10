/* PostsScreen.jsx */
/* eslint-disable */

const POSTS_EN = [
  { id: 'p1', media: 'TEXT',  text: "what nobody tells you about freelancing is the part where you negotiate with yourself at 2am", date: 'Mar 12', views: 14200, likes: 962, replies: 84, reposts: 31, quotes: 11, shares: 56, eng: 8.06, wes: 2.31 },
  { id: 'p2', media: 'IMAGE', text: "before / after of the same notion dashboard. small wins compound.",                                  date: 'Mar 10', views: 7600,  likes: 420, replies: 22, reposts: 9,  quotes: 3,  shares: 14, eng: 6.16, wes: 1.42 },
  { id: 'p3', media: 'VIDEO', text: "tiny rant about the word 'just' in product copy",                                                date: 'Mar 8',  views: 21100, likes: 1340,replies: 156,reposts: 64, quotes: 22, shares: 90, eng: 7.97, wes: 2.04 },
  { id: 'p4', media: 'CAROUSEL', text: "5 things i refuse to do as a solo founder",                                                   date: 'Mar 6',  views: 4900,  likes: 188, replies: 12, reposts: 4,  quotes: 2,  shares: 5,  eng: 4.31, wes: 0.88 },
  { id: 'p5', media: 'TEXT',  text: "the unsexy answer is 'i talked to people'",                                                      date: 'Mar 4',  views: 9300,  likes: 612, replies: 41, reposts: 12, quotes: 6,  shares: 19, eng: 7.42, wes: 1.66 },
  { id: 'p6', media: 'IMAGE', text: "today's whiteboard:",                                                                            date: 'Mar 3',  views: 3200,  likes: 142, replies: 9,  reposts: 2,  quotes: 1,  shares: 4,  eng: 4.94, wes: 0.71 },
];

const POSTS_TW = [
  { id: 'p1', media: 'TEXT',  text: "關於接案沒人會告訴你的事:你會在凌晨兩點跟自己討價還價",  date: '3 月 12 日', views: 14200, likes: 962, replies: 84, reposts: 31, quotes: 11, shares: 56, eng: 8.06, wes: 2.31 },
  { id: 'p2', media: 'IMAGE', text: "同一份 Notion 儀表板的 before / after。小勝會複利。",       date: '3 月 10 日', views: 7600,  likes: 420, replies: 22, reposts: 9,  quotes: 3,  shares: 14, eng: 6.16, wes: 1.42 },
  { id: 'p3', media: 'VIDEO', text: "對產品文案裡「只是」這個字的一段小碎念",                  date: '3 月 8 日',  views: 21100, likes: 1340,replies: 156,reposts: 64, quotes: 22, shares: 90, eng: 7.97, wes: 2.04 },
  { id: 'p4', media: 'CAROUSEL', text: "身為個人創辦人,我絕對不做的 5 件事",                  date: '3 月 6 日',  views: 4900,  likes: 188, replies: 12, reposts: 4,  quotes: 2,  shares: 5,  eng: 4.31, wes: 0.88 },
  { id: 'p5', media: 'TEXT',  text: "不浪漫但真實的答案:「我去跟人聊天」",                    date: '3 月 4 日',  views: 9300,  likes: 612, replies: 41, reposts: 12, quotes: 6,  shares: 19, eng: 7.42, wes: 1.66 },
  { id: 'p6', media: 'IMAGE', text: "今天的白板:",                                              date: '3 月 3 日',  views: 3200,  likes: 142, replies: 9,  reposts: 2,  quotes: 1,  shares: 4,  eng: 4.94, wes: 0.71 },
];

const MEDIA_ICON = {
  TEXT:     { icon: 'text-t',  color: 'accent' },
  IMAGE:    { icon: 'image',   color: 'secondary' },
  VIDEO:    { icon: 'video',   color: 'tertiary' },
  CAROUSEL: { icon: 'squares', color: 'quaternary' },
};

const TYPES_LABELS = {
  Text: { en: 'Text', tw: '純文字' },
  Image: { en: 'Image', tw: '圖片' },
  Video: { en: 'Video', tw: '影片' },
  Carousel: { en: 'Carousel', tw: '輪播' },
};
const TYPES = ['Text', 'Image', 'Video', 'Carousel'];

function PostsScreen() {
  useLang();
  const POSTS = getLang() === 'tw' ? POSTS_TW : POSTS_EN;
  const [activeTypes, setActiveTypes] = React.useState(new Set(TYPES));
  const [sortBy, setSortBy] = React.useState('date');
  const [sortDesc, setSortDesc] = React.useState(true);
  const [expanded, setExpanded] = React.useState(null);

  const toggleType = (t) => {
    const next = new Set(activeTypes);
    if (next.has(t) && next.size > 1) next.delete(t);
    else next.add(t);
    setActiveTypes(next);
  };
  const setSort = (col) => {
    if (sortBy === col) setSortDesc(!sortDesc);
    else { setSortBy(col); setSortDesc(true); }
  };

  const filtered = POSTS.filter(p => activeTypes.has(p.media.charAt(0) + p.media.slice(1).toLowerCase()));
  const ordered = [...filtered].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    if (sortBy === 'date') return sortDesc ? -1 : 1;
    return sortDesc ? bv - av : av - bv;
  });
  const maxWes = Math.max(...ordered.map(p => p.wes));

  const SortHead = ({ col, children, align = 'right' }) => (
    <th className={align === 'right' ? 'num' : ''}>
      <span onClick={() => setSort(col)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        {children}
        {sortBy === col
          ? <Icon name={sortDesc ? 'caret-down' : 'caret-up'} size={12} />
          : <Icon name="caret-up" size={12} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  );

  return (
    <div className="col" style={{ gap: 24 }}>
      <StickerCard hoverable={false} padded={false}>
        <div style={{ padding: '28px 24px 20px' }}>
          <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <StickerCardTitle>{t('Post Performance', '貼文成效')}</StickerCardTitle>
              <StickerCardDescription>{t('Sort by any metric to find your best content.', '依任一指標排序,找出表現最好的貼文。')}</StickerCardDescription>
            </div>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            {TYPES.map(ty => (
              <span key={ty}
                className={`chip-filter${activeTypes.has(ty) ? ' active' : ''}`}
                onClick={() => toggleType(ty)}>
                <Icon name={MEDIA_ICON[ty.toUpperCase()].icon} size={14} fill={activeTypes.has(ty)} />
                {t(TYPES_LABELS[ty].en, TYPES_LABELS[ty].tw)}
              </span>
            ))}
            <div style={{ marginLeft: 'auto' }} className="row">
              <Eyebrow style={{ marginRight: 8 }}>{t('From', '從')}</Eyebrow>
              <input className="input" type="date" defaultValue="2026-02-01" style={{ height: 36, fontSize: 13, padding: '0 10px' }} />
              <Eyebrow style={{ margin: '0 8px' }}>{t('To', '到')}</Eyebrow>
              <input className="input" type="date" defaultValue="2026-03-19" style={{ height: 36, fontSize: 13, padding: '0 10px' }} />
            </div>
          </div>

          <div className="muted" style={{ fontSize: 13, marginTop: 16, marginBottom: 6 }}>
            {t(`Showing 1–${ordered.length} of ${POSTS.length} posts`, `顯示第 1–${ordered.length} 筆,共 ${POSTS.length} 篇貼文`)}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>{t('Post', '貼文')}</th>
                  <SortHead col="date">{t('Date', '日期')}</SortHead>
                  <SortHead col="views">{t('Views', '觀看')}</SortHead>
                  <SortHead col="likes">{t('Likes', '讚')}</SortHead>
                  <SortHead col="replies">{t('Replies', '回覆')}</SortHead>
                  <SortHead col="shares">{t('Shares', '分享')}</SortHead>
                  <SortHead col="eng">{t('Eng. Rate', '互動率')}</SortHead>
                  <th className="num">WES</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((p, i) => {
                  const meta = MEDIA_ICON[p.media];
                  const isExp = expanded === p.id;
                  const isTop = p.wes === maxWes;
                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className={`row${i % 2 ? ' zebra' : ''}${isExp ? ' expanded' : ''}`}
                        onClick={() => setExpanded(isExp ? null : p.id)}
                      >
                        <td>
                          <div className="row" style={{ gap: 10 }}>
                            <IconCircle color={meta.color} size="sm"><Icon name={meta.icon} size={14} fill /></IconCircle>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320, display: 'inline-block' }}>{p.text}</span>
                          </div>
                        </td>
                        <td className="num muted" style={{ whiteSpace: 'nowrap' }}>{p.date}</td>
                        <td className="num">{fmt(p.views)}</td>
                        <td className="num">{fmt(p.likes)}</td>
                        <td className="num">{p.replies}</td>
                        <td className="num">{p.shares}</td>
                        <td className="num">{p.eng.toFixed(2)}%</td>
                        <td className="num">
                          <span className={isTop ? 'topwes' : ''}>
                            {isTop ? <span aria-hidden>★ </span> : null}{p.wes.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                      {isExp ? (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, background: 'rgba(241,245,249,0.5)' }}>
                            <ExpandedDetail post={p} />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </StickerCard>

      <StickerCard icon={<Icon name="chart-bar" size={20} fill />} iconColor="secondary">
        <div style={{ marginTop: 12 }}>
          <StickerCardTitle>{t('Format Analysis', '格式分析')}</StickerCardTitle>
          <StickerCardDescription>{t(
            <>Your <b>image</b> posts get 35% more engagement than the average format.</>,
            <>你的<b>圖片</b>貼文,互動率比平均高出 35%。</>
          )}</StickerCardDescription>
          <div style={{ marginTop: 20, display: 'flex', gap: 24, alignItems: 'flex-end', height: 140 }}>
            <Bar label={t('Text', '純文字')} value={62} color="var(--accent)" />
            <Bar label={t('Image', '圖片')} value={94} color="var(--secondary)" />
            <Bar label={t('Video', '影片')} value={78} color="var(--tertiary)" />
            <Bar label={t('Carousel', '輪播')} value={41} color="var(--quaternary)" />
          </div>
        </div>
      </StickerCard>
    </div>
  );
}

function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : '' + n; }

function Bar({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <span className="tabular muted" style={{ fontSize: 11 }}>{value}</span>
      <div style={{
        width: '70%', height: `${value}%`, background: color,
        border: '2px solid var(--foreground)', borderRadius: 'var(--radius-sm)',
      }} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function ExpandedDetail({ post }) {
  return (
    <div style={{ padding: 24, borderTop: '2px solid var(--border)' }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
        <div style={{ flex: 1.4 }}>
          <Eyebrow>{t('Full text', '完整內容')}</Eyebrow>
          <p style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>{post.text}</p>
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            <Button variant="outline" size="sm"><Icon name="eye" size={14} /> {t('View on Threads', '在 Threads 查看')}</Button>
            <Button variant="outline" size="sm"><Icon name="magnifier" size={14} /> {t('Scan this post', '檢視這篇貼文')}</Button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Eyebrow>{t('Views & engagement · last 7 days', '觀看與互動 · 最近 7 天')}</Eyebrow>
          <Sparkline />
        </div>
        <div style={{ flex: 1 }}>
          <Eyebrow>{t('Comment quality', '留言品質')}</Eyebrow>
          <div className="col" style={{ marginTop: 8, gap: 6 }}>
            <CommentBar label={t('Substantive', '有深度')}  pct={62} color="var(--quaternary)" />
            <CommentBar label={t('Short', '簡短')}          pct={28} color="var(--tertiary)" />
            <CommentBar label={t('Low-effort', '隨手回')}   pct={10} color="var(--muted-foreground)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentBar({ label, pct, color }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12 }}>{label}</span>
        <span className="tabular muted" style={{ fontSize: 12 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 240 80" style={{ width: '100%', marginTop: 6 }}>
      <polyline points="0,60 30,52 60,55 90,40 120,42 150,28 180,30 210,18 240,22"
        fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="120" cy="42" r="4" fill="var(--secondary)" />
      <circle cx="210" cy="18" r="4" fill="var(--secondary)" />
    </svg>
  );
}

Object.assign(window, { PostsScreen });
