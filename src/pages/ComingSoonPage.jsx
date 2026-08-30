import './ComingSoonPage.css';

export default function ComingSoonPage() {
  return (
    <div className="coming-soon">
      <div className="coming-soon__doodles" aria-hidden="true">
        <span className="doodle" style={{ top: '8%', left: '8%', fontSize: '3rem', transform: 'rotate(-12deg)' }}>🍲</span>
        <span className="doodle" style={{ top: '14%', left: '88%', fontSize: '2.6rem', transform: 'rotate(10deg)' }}>🍛</span>
        <span className="doodle" style={{ top: '78%', left: '10%', fontSize: '2.4rem', transform: 'rotate(9deg)' }}>🥬</span>
        <span className="doodle" style={{ top: '82%', left: '90%', fontSize: '2.6rem', transform: 'rotate(-8deg)' }}>🍚</span>
        <span className="doodle" style={{ top: '46%', left: '4%', fontSize: '2rem', transform: 'rotate(14deg)' }}>🌶️</span>
        <span className="doodle" style={{ top: '50%', left: '95%', fontSize: '2.2rem', transform: 'rotate(-10deg)' }}>🍗</span>
      </div>

      <div className="coming-soon__panel">
        <span className="coming-soon__eyebrow">Something delicious is on the way</span>
        <h1 className="coming-soon__logo">dánọ́fúnmi</h1>
        <p className="coming-soon__meaning">
          from &ldquo;Dánọ́ fún mi&rdquo; — &ldquo;cook for me&rdquo;
        </p>
        <p className="coming-soon__body">
          We're in the kitchen getting everything ready — home-cooked soups and rice, made
          fresh and delivered exactly as requested. Check back soon to stock up your freezer.
        </p>
      </div>
    </div>
  );
}
