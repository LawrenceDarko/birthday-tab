'use client';
import { useEffect, useRef, useState } from 'react';

/** Who this whole site is for. A bill's own honoree name wins when it is set. */
export const BIRTHDAY_NAME = 'Giselle';

// Lines lifted from her sketchbook page; one shows under the name at random.
const NOTES = ['she’s everything.', 'literally perfect ♡', 'my muse.', 'obsessed.', 'love of my life', 'ugh. so fine ♡', 'pretty girl', 'baddest.'];

const BITS = ['♥', '♡', '✦', '♥', '✧', '♥'];
const COLORS = ['#d6338a', '#a3214f', '#f48fb8', '#5e1a2e', '#ff6fae', '#e9b44c'];

type Piece = { id: number; ch: string; left: number; color: string; size: number; delay: number; dur: number; drift: number; spin: number };

/** Hearts and sparkles that fall over the page. Bump `fire` to drop a new batch. */
export function Confetti({ fire, count = 46 }: { fire: number; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const batch = Array.from({ length: count }, (_, i) => ({
      id: fire * 1000 + i,
      ch: BITS[i % BITS.length],
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 14 + Math.random() * 18,
      delay: Math.random() * 0.7,
      dur: 2.4 + Math.random() * 1.8,
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() - 0.5) * 540,
    }));
    setPieces(batch);
    const t = setTimeout(() => setPieces([]), 5200);
    return () => clearTimeout(t);
  }, [fire, count]);
  if (!pieces.length) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            color: p.color,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        >
          {p.ch}
        </span>
      ))}
    </div>
  );
}

/** A sticker that wiggles and puffs a few hearts when tapped. */
function Sticker({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [pop, setPop] = useState(0);
  return (
    <button type="button" className={`sticker ${className}`} aria-label={`${alt}, tap for hearts`} onClick={() => setPop((n) => n + 1)}>
      <img src={src} alt="" key={pop} className={pop ? 'wiggle' : ''} />
      {pop > 0 && (
        <span className="puff" key={`p${pop}`} aria-hidden="true">
          <i>♥</i><i>♡</i><i>♥</i>
        </span>
      )}
    </button>
  );
}

/** The sketchbook header at the top of the guest page. */
export function PartyHero({ name, children }: { name: string; children?: React.ReactNode }) {
  const [note, setNote] = useState(NOTES[0]);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setNote(NOTES[Math.floor(Math.random() * NOTES.length)]);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="hero">
      <Doodles />
      <div className="hero-top">
        <span className="scrawl">happy birthday to</span>
        <h1 className="marker">
          {name}
          <svg className="squiggle" viewBox="0 0 220 22" preserveAspectRatio="none" aria-hidden="true">
            <path d="M3 14 C 40 4, 70 20, 110 10 S 180 4, 217 12" />
            <path d="M14 19 C 60 12, 120 22, 200 15" />
          </svg>
        </h1>
        <span className="scrawl note">{note}</span>
      </div>

      <div className="hero-stage">
        <button type="button" className="polaroid" onClick={() => setOpen(true)} aria-label={`See the whole drawing of ${name}`}>
          <span className="tape" aria-hidden="true" />
          <img src="/giselle/smile.jpg" alt={`${name}, smiling and throwing up a peace sign`} width={600} height={812} />
          <span className="caption">tap me ♡</span>
        </button>
        <Sticker src="/giselle/chibi.jpg" alt={`Little ${name}`} className="s1" />
        <Sticker src="/giselle/wink.jpg" alt={`${name} winking`} className="s2" />
        <Sticker src="/giselle/cutie.jpg" alt={`Cutie pie ${name}`} className="s3" />
      </div>

      {children}

      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${name}'s sketchbook page`} onClick={() => setOpen(false)}>
          <img src="/giselle/sheet.jpg" alt={`A sketchbook page full of drawings of ${name}`} onClick={(e) => e.stopPropagation()} />
          <button ref={closeRef} type="button" className="btn" onClick={() => setOpen(false)}>Back to the bill ♡</button>
        </div>
      )}
    </header>
  );
}

/** Hand-drawn hearts and stars scattered in the hero's corners. */
function Doodles() {
  return (
    <svg className="doodles" viewBox="0 0 360 520" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path className="pk" d="M28 40c-6-10 6-18 12-8 6-10 18-2 12 8l-12 14z" />
        <path className="pk" d="M318 30c-4-7 4-12 8-5 4-7 12-2 8 5l-8 10z" />
        <path className="ink" d="M330 120l5 13 14 1-11 8 4 14-12-8-12 8 4-14-11-8 14-1z" />
        <path className="ink" d="M22 300l3 8 9 1-7 5 3 9-8-5-8 5 3-9-7-5 9-1z" />
        <path className="pk" d="M338 380c-5-9 5-15 10-7 5-8 15-2 10 7l-10 12z" />
        <path className="pk" d="M300 70l3 8M296 74h8" />
      </g>
    </svg>
  );
}
