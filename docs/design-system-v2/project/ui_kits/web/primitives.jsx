/* primitives.jsx — shared Spool UI primitives */
/* eslint-disable */

// -------- StickerCard --------
function StickerCard({ children, featured = false, hoverable = true, flat = false, padded = true, icon, iconColor = 'accent', className = '', style }) {
  const cls = [
    'sticker',
    featured ? 'featured' : '',
    !hoverable ? '' : 'hoverable',
    flat ? 'flat' : '',
    padded ? 'padded' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} style={style}>
      {icon ? <div className={`floaticon bg-${iconColor}`}>{icon}</div> : null}
      {children}
    </div>
  );
}

function StickerCardTitle({ children, ...rest }) {
  return <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, margin: 0 }} {...rest}>{children}</h3>;
}
function StickerCardDescription({ children }) {
  return <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '4px 0 0' }}>{children}</p>;
}

// -------- CandyButton --------
function Button({ variant = 'candy', size = 'default', children, trailingIcon, className = '', ...rest }) {
  const cls = ['btn',
    variant === 'outline' ? 'outline' : '',
    variant === 'ghost' ? 'ghost' : '',
    variant === 'destructive' ? 'destructive' : '',
    size === 'sm' ? 'sm' : '',
    size === 'lg' ? 'lg' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
      {trailingIcon ? (
        <span className="iconchip">
          <Icon name="arrow-right" />
        </span>
      ) : null}
    </button>
  );
}

// -------- Input / Label --------
function Eyebrow({ children, style }) {
  return <span className="eyebrow" style={style}>{children}</span>;
}
function Input(props) { return <input className="input" {...props} />; }
function Textarea(props) { return <textarea className="textarea" {...props} />; }

// -------- IconCircle --------
function IconCircle({ color = 'accent', size = 'default', children }) {
  const cls = ['icon-circle', `bg-${color}`, size === 'sm' ? 'sm' : '', size === 'lg' ? 'lg' : ''].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

// -------- Empty state --------
function EmptyState({ icon, iconColor = 'primary', title, description, action }) {
  return (
    <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <IconCircle color={iconColor} size="lg">{icon}</IconCircle>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, margin: 0 }}>{title}</h3>
      <p style={{ maxWidth: 360, fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>{description}</p>
      {action ? <Button variant={action.variant || 'candy'} size="sm" onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}

// -------- ProgressBar --------
function ProgressBar({ percentage }) {
  const indet = percentage == null;
  return (
    <div style={{
      height: 24, width: '100%', overflow: 'hidden',
      borderRadius: 9999, border: '2px solid var(--foreground)',
      background: 'var(--muted)', boxShadow: 'var(--shadow-default)',
    }}>
      {indet ? (
        <div style={{ height: '100%', width: '30%', borderRadius: 9999, background: 'var(--accent)',
          animation: 'progress-indet 1.4s ease-in-out infinite' }} />
      ) : (
        <div style={{ height: '100%', borderRadius: 9999, background: 'var(--accent)',
          width: `${Math.min(100, Math.max(0, percentage))}%`,
          transition: 'width 500ms cubic-bezier(0.34,1.56,0.64,1)' }} />
      )}
    </div>
  );
}

// keyframe injection for indeterminate
(function injectKeyframes(){
  if (document.getElementById('__spool_kf')) return;
  const s = document.createElement('style'); s.id = '__spool_kf';
  s.textContent = `@keyframes progress-indet { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`;
  document.head.appendChild(s);
})();

// -------- Quality gauge --------
function QualityGauge({ score = 0, label = true }) {
  const v = Math.max(0, Math.min(100, score));
  const color = v < 40 ? 'var(--destructive)' : v < 70 ? 'var(--tertiary)' : 'var(--quaternary)';
  const word  = v < 40 ? 'Needs work' : v < 70 ? 'Fair' : 'Great';
  const C = Math.PI * 70; // ~219.9
  const off = C - (v / 100) * C;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg viewBox="0 0 200 110" style={{ width: '100%', maxWidth: 200 }}>
        <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="var(--muted)" strokeWidth={14} strokeLinecap="round" />
        <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={off}
              style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.34,1.56,0.64,1)' }} />
        <text x="100" y="85" textAnchor="middle" fill="var(--foreground)" fontFamily="Outfit" fontSize={34} fontWeight={800}>{v}</text>
      </svg>
      {label && <span style={{ fontSize: 13, fontWeight: 700, color }}>{word}</span>}
    </div>
  );
}

// -------- Decorative shapes (used by Landing/Loading) --------
function DecoCircle({ size, color, opacity = 1, top, left, right, bottom, style }) {
  return <span className="deco-circle" style={{ width: size, height: size, background: color, opacity, top, left, right, bottom, ...style }} />;
}
function DecoSquare({ size, color, rotate = 0, top, left, right, bottom, dashed = false, style }) {
  return <span className="deco-square" style={{
    width: size, height: size,
    background: dashed ? 'transparent' : color,
    border: dashed ? `2px dashed ${color}` : 'none',
    transform: `rotate(${rotate}deg)`,
    top, left, right, bottom, ...style
  }} />;
}

// Expose to global scope so other Babel-compiled script files can read them.
Object.assign(window, {
  StickerCard, StickerCardTitle, StickerCardDescription,
  Button, Input, Textarea, Eyebrow, IconCircle, EmptyState,
  ProgressBar, QualityGauge, DecoCircle, DecoSquare,
});
