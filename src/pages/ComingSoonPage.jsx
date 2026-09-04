import LogoMark from '../components/LogoMark';
import './ComingSoonPage.css';

export default function ComingSoonPage() {
  return (
    <div className="coming-soon">
      <div className="coming-soon__doodles" aria-hidden="true">
        <span className="doodle" style={{ top: '6%', left: '7%', fontSize: '3rem', transform: 'rotate(-12deg)' }}>🍲</span>
        <span className="doodle" style={{ top: '10%', left: '86%', fontSize: '2.6rem', transform: 'rotate(10deg)' }}>🍛</span>
        <span className="doodle" style={{ top: '22%', left: '92%', fontSize: '1.9rem', transform: 'rotate(-8deg)' }}>🌶️</span>
        <span className="doodle" style={{ top: '20%', left: '3%', fontSize: '2.1rem', transform: 'rotate(9deg)' }}>🥬</span>
        <span className="doodle" style={{ top: '76%', left: '6%', fontSize: '2.4rem', transform: 'rotate(9deg)' }}>🥘</span>
        <span className="doodle" style={{ top: '80%', left: '88%', fontSize: '2.6rem', transform: 'rotate(-11deg)' }}>🍚</span>
        <span className="doodle" style={{ top: '92%', left: '22%', fontSize: '1.9rem', transform: 'rotate(-6deg)' }}>🍃</span>
        <span className="doodle" style={{ top: '90%', left: '62%', fontSize: '2rem', transform: 'rotate(8deg)' }}>🍗</span>
        <span className="doodle" style={{ top: '42%', left: '2%', fontSize: '1.8rem', transform: 'rotate(5deg)' }}>🧅</span>
        <span className="doodle" style={{ top: '46%', left: '95%', fontSize: '1.7rem', transform: 'rotate(-9deg)' }}>🍽️</span>
      </div>

      <div className="coming-soon__fire-pot" aria-hidden="true">
        <svg viewBox="0 0 220 260" className="fire-pot-svg">
          <defs>
            <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#a44f22" />
              <stop offset="45%" stopColor="#e0662a" />
              <stop offset="80%" stopColor="#f4a83c" />
              <stop offset="100%" stopColor="#ffe28a" />
            </linearGradient>
          </defs>

          <g className="smoke">
            <path className="smoke-wisp smoke-wisp--1" d="M95,95 C80,75 110,55 95,35 C82,17 108,0 96,-18" />
            <path className="smoke-wisp smoke-wisp--2" d="M120,98 C138,80 112,58 128,40 C142,24 118,6 132,-14" />
          </g>

          <ellipse className="pot-shadow" cx="110" cy="236" rx="80" ry="8" />

          <g className="firewood">
            <rect className="log" x="25" y="205" width="130" height="15" rx="7.5" transform="rotate(-18 90 212)" />
            <rect className="log" x="65" y="205" width="130" height="15" rx="7.5" transform="rotate(18 130 212)" />
            <rect className="log log--top" x="42" y="221" width="136" height="13" rx="6.5" transform="rotate(1 110 227)" />
          </g>

          <g className="flames">
            <path className="flame flame--a" d="M110,228 C90,208 93,180 113,160 C110,183 128,190 128,208 C128,220 121,228 110,228 Z" />
            <path className="flame flame--b" d="M68,224 C52,208 55,186 70,170 C68,189 82,195 82,209 C82,218 76,224 68,224 Z" />
            <path className="flame flame--b" d="M152,224 C136,208 139,186 154,170 C152,189 166,195 166,209 C166,218 160,224 152,224 Z" />
            <path className="flame flame--c" d="M132,222 C120,210 122,194 134,182 C132,196 143,200 143,211 C143,217 138,222 132,222 Z" />
            <path className="flame flame--c" d="M88,222 C76,210 78,194 90,182 C88,196 99,200 99,211 C99,217 94,222 88,222 Z" />
          </g>

          <g className="pot">
            <path className="pot-body" d="M42,95 C15,118 12,150 30,168 Q110,196 190,168 C208,150 205,118 178,95 Z" />
            <path className="pot-body-hi" d="M42,95 C28,106 20,122 20,138 L44,146 C40,128 42,110 56,98 Z" />
            <path className="pot-handle" d="M18,110 q-16,12 0,30" />
            <path className="pot-handle" d="M202,110 q16,12 0,30" />
            <ellipse className="pot-rim" cx="110" cy="95" rx="68" ry="13" />
            <ellipse className="pot-rim-inner" cx="110" cy="93" rx="58" ry="9" />
          </g>
        </svg>
      </div>

      <div className="coming-soon__panel">
        <span className="coming-soon__badge"><span className="coming-soon__badge-dot" />Launching soon</span>

        <h1 className="coming-soon__logo">
          <LogoMark size={44} />
          dánọ́fúnmi
        </h1>
        <span className="coming-soon__tagline">You choose, we cook.</span>

        <h2 className="coming-soon__headline">Coming<br /><span>soon&hellip;</span></h2>
        <p className="coming-soon__body">
          Home-cooked soups &amp; rice, made fresh and stocked in bulk — once a month, just for you.
        </p>

        <div className="coming-soon__details">
          <div className="coming-soon__detail">
            <span className="coming-soon__detail-icon">🗓️</span>
            <span className="coming-soon__detail-text">
              Monthly stock-up
              <small>Ordering opens once a month</small>
            </span>
          </div>
          <div className="coming-soon__detail">
            <span className="coming-soon__detail-icon">🍲</span>
            <span className="coming-soon__detail-text">
              Any soup, any combination
              <small>Buka Stew, Efo Riro, Egusi, Ewedu &amp; more</small>
            </span>
          </div>
          <div className="coming-soon__detail">
            <span className="coming-soon__detail-icon">🚚</span>
            <span className="coming-soon__detail-text">
              Delivered fresh
              <small>Packed and delivered exactly as requested</small>
            </span>
          </div>
        </div>

        <p className="coming-soon__meaning">
          <strong>dánọ́fúnmi</strong> &middot; from &ldquo;Dánọ́ fún mi&rdquo; — &ldquo;cook for me&rdquo;
        </p>
      </div>
    </div>
  );
}
