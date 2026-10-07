import { useEffect, useRef } from 'react';

/**
 * Animated deep-space backdrop for the landing hero: parallax stars that twinkle, soft nebulae,
 * distant planets, shooting stars, and satellites that drift across now and then.
 * Pauses when off-screen or in a background tab, and renders one still frame for reduced motion.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  depth: number; // 0 (far) – 1 (near)
  phase: number;
  speed: number;
  hue: string;
}

interface Planet {
  x: number; // 0–1 of width
  y: number; // 0–1 of height
  r: number; // px at 1x
  depth: number;
  light: string;
  dark: string;
  glow: string;
  ring?: string;
  bands?: string;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Satellite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  scale: number;
  blink: number;
}

const STAR_TINTS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#CFE8FF', '#E6DCFF', '#FFE9C7'];

const PLANETS: Planet[] = [
  { x: 0.84, y: 0.26, r: 70, depth: 0.25, light: '#7C5CFF', dark: '#1B1040', glow: 'rgba(124,92,255,0.35)', ring: 'rgba(34,211,238,0.55)' },
  { x: 0.1, y: 0.7, r: 34, depth: 0.15, light: '#FF8A5C', dark: '#3A1020', glow: 'rgba(255,92,168,0.3)', bands: 'rgba(255,209,102,0.25)' },
  { x: 0.62, y: 0.82, r: 12, depth: 0.08, light: '#22D3EE', dark: '#062A35', glow: 'rgba(34,211,238,0.35)' },
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function SpaceBackdrop({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let nebula: HTMLCanvasElement | null = null;
    const meteors: Meteor[] = [];
    const satellites: Satellite[] = [];
    let nextMeteorAt = performance.now() + rand(1200, 3000);
    let nextSatelliteAt = performance.now() + rand(800, 2500);
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    let visible = true;
    let last = performance.now();

    const buildNebula = () => {
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.floor(width * dpr));
      off.height = Math.max(1, Math.floor(height * dpr));
      const n = off.getContext('2d')!;
      n.scale(dpr, dpr);
      const blobs: [number, number, number, string][] = [
        [0.2, 0.25, 0.55, 'rgba(107,78,255,0.20)'],
        [0.75, 0.15, 0.45, 'rgba(34,211,238,0.10)'],
        [0.55, 0.65, 0.6, 'rgba(255,92,168,0.10)'],
        [0.05, 0.9, 0.4, 'rgba(124,92,255,0.12)'],
      ];
      for (const [bx, by, br, color] of blobs) {
        const radius = br * Math.max(width, height);
        const g = n.createRadialGradient(bx * width, by * height, 0, bx * width, by * height, radius);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        n.fillStyle = g;
        n.fillRect(0, 0, width, height);
      }
      nebula = off;
    };

    const buildStars = () => {
      const count = Math.round((width * height) / 2600);
      stars = Array.from({ length: count }, () => {
        const depth = Math.random() ** 2;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.35 + depth * 1.35,
          depth,
          phase: Math.random() * Math.PI * 2,
          speed: rand(0.6, 2.2),
          hue: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)]!,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNebula();
      buildStars();
    };

    const spawnMeteor = () => {
      const fromLeft = Math.random() < 0.5;
      const speed = rand(700, 1100);
      const angle = rand(0.35, 0.6);
      meteors.push({
        x: fromLeft ? rand(-0.1, 0.5) * width : rand(0.5, 1.1) * width,
        y: rand(-0.05, 0.35) * height,
        vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(0.6, 1.1),
      });
    };

    const spawnSatellite = () => {
      const leftToRight = Math.random() < 0.5;
      const speed = rand(18, 40);
      satellites.push({
        x: leftToRight ? -40 : width + 40,
        y: rand(0.08, 0.7) * height,
        vx: (leftToRight ? 1 : -1) * speed,
        vy: rand(-6, 6),
        angle: rand(0, Math.PI * 2),
        spin: rand(-0.25, 0.25),
        scale: rand(0.6, 1.1),
        blink: rand(0, 1),
      });
    };

    const drawPlanet = (p: Planet, t: number) => {
      const px = p.x * width + pointer.x * p.depth * 30 + Math.sin(t / 9000 + p.r) * 6;
      const py = p.y * height + pointer.y * p.depth * 30 + Math.cos(t / 11000 + p.r) * 4;
      const scale = Math.min(1, Math.max(0.55, width / 1280));
      const r = p.r * scale;

      const glow = ctx.createRadialGradient(px, py, r * 0.8, px, py, r * 2.2);
      glow.addColorStop(0, p.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      if (p.ring) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.35);
        ctx.strokeStyle = p.ring;
        ctx.lineWidth = Math.max(1.5, r * 0.06);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.75, r * 0.38, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const body = ctx.createRadialGradient(px - r * 0.45, py - r * 0.45, r * 0.1, px, py, r);
      body.addColorStop(0, p.light);
      body.addColorStop(1, p.dark);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      if (p.bands) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = p.bands;
        ctx.lineWidth = r * 0.12;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.ellipse(px, py + i * r * 0.32, r * 1.1, r * 0.12, 0.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Night side shadow.
      const shade = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
      shade.addColorStop(0.45, 'rgba(5,6,15,0)');
      shade.addColorStop(1, 'rgba(5,6,15,0.75)');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      if (p.ring) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.35);
        ctx.strokeStyle = p.ring;
        ctx.lineWidth = Math.max(1.5, r * 0.06);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.75, r * 0.38, 0, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawSatellite = (s: Satellite, t: number) => {
      ctx.save();
      ctx.translate(s.x + pointer.x * 12, s.y + pointer.y * 12);
      ctx.rotate(s.angle);
      ctx.scale(s.scale, s.scale);
      ctx.fillStyle = '#2B3B6B';
      ctx.strokeStyle = '#6E8BD8';
      ctx.lineWidth = 0.8;
      for (const side of [-1, 1]) {
        ctx.fillRect(side > 0 ? 7 : -21, -4, 14, 8);
        ctx.strokeRect(side > 0 ? 7 : -21, -4, 14, 8);
        ctx.beginPath();
        ctx.moveTo(side > 0 ? 14 : -14, -4);
        ctx.lineTo(side > 0 ? 14 : -14, 4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#9AA6C0';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.fillStyle = '#C8CCD8';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#E8EAF0';
      ctx.beginPath();
      ctx.arc(0, -7, 2.2, Math.PI, 0);
      ctx.fill();
      const on = (t / 1000 + s.blink) % 1.4 < 0.12;
      if (on) {
        ctx.fillStyle = '#FF5CA8';
        ctx.shadowColor = '#FF5CA8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 6, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      ctx.fillStyle = '#05060F';
      ctx.fillRect(0, 0, width, height);
      if (nebula) ctx.drawImage(nebula, 0, 0, width, height);

      for (const s of stars) {
        s.x -= s.depth * 4 * dt;
        if (s.x < -2) s.x = width + 2;
        const twinkle = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t / 1000 * s.speed + s.phase);
        ctx.globalAlpha = (0.35 + s.depth * 0.65) * twinkle;
        ctx.fillStyle = s.hue;
        const x = s.x + pointer.x * s.depth * 18;
        const y = s.y + pointer.y * s.depth * 18;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.depth > 0.85 && twinkle > 0.9) {
          ctx.globalAlpha *= 0.5;
          ctx.fillRect(x - s.r * 3, y - 0.3, s.r * 6, 0.6);
          ctx.fillRect(x - 0.3, y - s.r * 3, 0.6, s.r * 6);
        }
      }
      ctx.globalAlpha = 1;

      for (const p of PLANETS) drawPlanet(p, t);

      if (!reduceMotion) {
        if (t > nextSatelliteAt && satellites.length < 2) {
          spawnSatellite();
          nextSatelliteAt = t + rand(6000, 14000);
        }
        for (let i = satellites.length - 1; i >= 0; i--) {
          const s = satellites[i]!;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.angle += s.spin * dt;
          if (s.x < -80 || s.x > width + 80) satellites.splice(i, 1);
          else drawSatellite(s, t);
        }

        if (t > nextMeteorAt) {
          spawnMeteor();
          nextMeteorAt = t + rand(1800, 5200);
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i]!;
          m.life += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const k = m.life / m.maxLife;
          if (k >= 1) {
            meteors.splice(i, 1);
            continue;
          }
          const alpha = Math.sin(Math.PI * k);
          const tail = 0.12;
          const tx = m.x - m.vx * tail;
          const ty = m.y - m.vy * tail;
          const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
          g.addColorStop(0, `rgba(255,255,255,${alpha})`);
          g.addColorStop(0.3, `rgba(201,188,255,${alpha * 0.6})`);
          g.addColorStop(1, 'rgba(34,211,238,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduceMotion && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onVisibility = () => {
      if (!document.hidden && visible && !reduceMotion) start();
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) frame(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible && !reduceMotion) start();
    });
    io.observe(canvas);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    if (reduceMotion) frame(performance.now());
    else start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block h-full w-full ${className}`} />;
}
