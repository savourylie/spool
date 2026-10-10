/* icons.jsx — real Phosphor Icons inlined from the official core package.
   Fetches each glyph on first use from unpkg.com (~700 B each), caches it,
   then renders the SVG inline so `color` inheritance & sizing work cleanly. */
/* eslint-disable */

const CDN_BASE = 'https://unpkg.com/@phosphor-icons/core@2.1.1/assets';

// Friendly aliases → official Phosphor slug
const ICON_ALIASES = {
  'arrow-right':      'arrow-right',
  'arrow-left':       'arrow-left',
  'caret-up':         'caret-up',
  'caret-down':       'caret-down',
  'house':            'house',
  'chart-bar':        'chart-bar',
  'users':            'users',
  'speaker':          'speaker-high',
  'clock-history':    'clock-counter-clockwise',
  'books':            'books',
  'lightbulb':        'lightbulb',
  'compass':          'compass',
  'magnifier':        'magnifying-glass',
  'pencil-line':      'pencil-line',
  'gear':             'gear',
  'sign-out':         'sign-out',
  'text-t':           'text-t',
  'image':            'image',
  'video':            'video-camera',
  'squares':          'squares-four',
  'note':             'note-blank',
  'sparkle':          'sparkle',
  'lightning':        'lightning',
  'spinner':          'spinner-gap',
  'stop':             'stop',
  'check':            'check',
  'x':                'x',
  'warning':          'warning-circle',
  'clock':            'clock',
  'clipboard':        'clipboard-text',
  'refresh':          'arrows-clockwise',
  'pencil':           'pencil',
  'trend-up':         'trend-up',
  'crosshair':        'crosshair',
  'funnel':           'funnel-simple',
  'plus':             'plus',
  'eye':              'eye',
  'chat':             'chat-circle',
  'chats':            'chats-teardrop',
  'graduation':       'graduation-cap',
  'heart':            'heart',
  'prohibit':         'prohibit',
  'smiley':           'smiley',
  'text-align':       'text-align-left',
  'tree':             'tree-structure',
  'user-circle':      'user-circle',
  'arrows-lr':        'arrows-left-right',
  'arrow-square-out': 'arrow-square-out',
  'moon':             'moon',
  'sun':              'sun',
};

const _cache = new Map();        // key → { path: string }
const _pending = new Map();      // key → Promise

function fetchIcon(slug, weight) {
  const key = `${slug}__${weight}`;
  if (_cache.has(key)) return Promise.resolve(_cache.get(key));
  if (_pending.has(key)) return _pending.get(key);
  // Phosphor core convention: regular files are `<slug>.svg`, all other
  // weights add a `-<weight>` suffix (e.g. `moon-fill.svg`).
  const fileName = weight === 'regular' ? slug : `${slug}-${weight}`;
  const url = `${CDN_BASE}/${weight}/${fileName}.svg`;
  const p = fetch(url).then(r => r.text()).then(txt => {
    // Extract the inner content of the <svg> tag (the paths)
    const inner = txt.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const rec = { inner };
    _cache.set(key, rec);
    _pending.delete(key);
    return rec;
  }).catch(err => {
    _pending.delete(key);
    _cache.set(key, { inner: '' });   // negative cache so we don't loop
    return { inner: '' };
  });
  _pending.set(key, p);
  return p;
}

function Icon({ name, size = 18, fill = false, className = '', style }) {
  const slug = ICON_ALIASES[name] || name;
  const weight = fill ? 'fill' : 'regular';
  const key = `${slug}__${weight}`;
  const [rec, setRec] = React.useState(() => _cache.get(key) || null);

  React.useEffect(() => {
    let cancel = false;
    if (!rec) {
      fetchIcon(slug, weight).then(r => { if (!cancel) setRec(r); });
    }
    return () => { cancel = true; };
  }, [key]);

  if (!rec || !rec.inner) {
    // Reserve space while loading so layout doesn't jump
    return <span aria-hidden="true" style={{ display: 'inline-block', width: size, height: size, ...style }} />;
  }
  return (
    <svg viewBox="0 0 256 256"
      width={size} height={size}
      fill="currentColor"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: rec.inner }} />
  );
}

Object.assign(window, { Icon, ICON_ALIASES, _phosphorCache: _cache });
