/**
 * Landing — Full-screen, interactive marketing page for Vanguard AI.
 * Cursor spotlight · live scan demo · 3D tilt cards · self-typing terminal ·
 * count-up stats · scroll parallax · glassmorphism.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion, useScroll, useTransform, useSpring,
  useMotionValue, useMotionTemplate, useInView, animate,
} from 'framer-motion';
import {
  ShieldCheck, Terminal, GitCompareArrows, Sparkles, ScanLine,
  ArrowRight, Check, Gauge, ListChecks, Lock, Radar, Zap, ChevronDown,
  Loader2, X,
} from 'lucide-react';

/* ── Reusable primitives ───────────────────────────────── */

function Parallax({ children, speed = 60, className = '' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  return <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>;
}

function Reveal({ children, delay = 0, y = 24, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#7BB8FF]" strokeWidth={1.75} />}
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">{children}</span>
    </div>
  );
}

/* Button that magnetically drifts toward the cursor */
function Magnetic({ children, className = '', onClick, strength = 0.4 }) {
  const ref = useRef(null);
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <motion.button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onClick={onClick}
      style={{ x, y }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

/* Count-up number that animates when scrolled into view */
function CountUp({ to, suffix = '', duration = 1.4 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  return (
    <span ref={ref} className="numeric">
      {val}{suffix}
    </span>
  );
}

/* Glass card with 3D tilt + cursor spotlight */
function TiltCard({ children, className = '' }) {
  const ref = useRef(null);
  const rotX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const spot = useMotionTemplate`radial-gradient(220px circle at ${mx}% ${my}%, rgba(123,184,255,0.14), transparent 65%)`;

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    rotY.set((px - 0.5) * 10);
    rotX.set((0.5 - py) * 10);
    mx.set(px * 100);
    my.set(py * 100);
  };
  const onLeave = () => { rotX.set(0); rotY.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
      className={`relative ${className}`}
    >
      <motion.div style={{ background: spot }} className="absolute inset-0 rounded-[16px] pointer-events-none z-10" />
      {children}
    </motion.div>
  );
}

/* Self-typing terminal proof */
function TypingTerminal() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const cmd = 'curl -sI https://example.com';
  const [typed, setTyped] = useState('');
  const [showOut, setShowOut] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(cmd.slice(0, i));
      if (i >= cmd.length) {
        clearInterval(id);
        setTimeout(() => setShowOut(true), 350);
      }
    }, 45);
    return () => clearInterval(id);
  }, [inView]);

  const outLines = [
    { t: 'HTTP/2 200', c: 'text-white/70' },
    { t: 'strict-transport-security: max-age=31536000', c: 'text-white/50' },
    { t: 'x-frame-options: SAMEORIGIN', c: 'text-white/50' },
    { t: 'content-security-policy: ...', c: 'text-white/50' },
    { t: '# x-content-type-options → absent', c: 'text-[#F87171]' },
  ];

  return (
    <div ref={ref} className="glass-elevated p-1.5 shine">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80]/70" />
        <span className="ml-2 text-[11px] text-white/35 font-mono">proof — vanguard</span>
        {showOut && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[#4ADE80]">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        )}
      </div>
      <div className="glass-inset p-4 font-mono text-[12.5px] leading-relaxed min-h-[190px]">
        <div className="flex items-center">
          <span className="text-[#4ADE80]/70">$&nbsp;</span>
          <span className="text-[#7BB8FF]">{typed}</span>
          {!showOut && <span className="inline-block w-2 h-4 bg-[#7BB8FF]/70 ml-0.5 animate-pulse" />}
        </div>
        {showOut && (
          <div className="mt-3 space-y-1">
            {outLines.map((l, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
                className={l.c}
              >
                {l.t}
              </motion.p>
            ))}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: outLines.length * 0.12 + 0.1 }}
              className="pt-2 mt-2 hairline-t text-[11px] text-white/35"
            >
              Header genuinely missing — flagged, with proof.
            </motion.p>
          </div>
        )}
      </div>
    </div>
  );
}

/* Interactive "try it" scan demo */
const DEMO_FINDINGS = [
  { name: 'X-Content-Type-Options missing', risk: 'Low', color: '#4ADE80' },
  { name: 'Referrer-Policy missing', risk: 'Low', color: '#4ADE80' },
  { name: 'Server version disclosed', risk: 'Low', color: '#4ADE80' },
  { name: 'No Cache-Control header', risk: 'Info', color: '#94A3B8' },
];
const DEMO_STAGES = [
  'Establishing connection',
  'Analyzing response headers',
  'Inspecting TLS configuration',
  'Probing sensitive paths',
  'Verifying findings',
];

function InteractiveScan() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('https://example.com');
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  const runScan = () => {
    clearTimers();
    setPhase('scanning');
    setProgress(0);
    setStage(0);
    setRevealed(0);

    let p = 0;
    const tick = setInterval(() => {
      p += Math.random() * 9 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(tick);
        setProgress(100);
        setPhase('done');
        DEMO_FINDINGS.forEach((_, i) => {
          timers.current.push(setTimeout(() => setRevealed(i + 1), 250 + i * 260));
        });
        return;
      }
      setProgress(Math.round(p));
      setStage(Math.min(DEMO_STAGES.length - 1, Math.floor((p / 100) * DEMO_STAGES.length)));
    }, 260);
    timers.current.push(tick);
  };

  const reset = () => { clearTimers(); setPhase('idle'); setProgress(0); setRevealed(0); };
  const score = 92;

  return (
    <div className="glass-elevated glow-border p-6 md:p-8">
      {/* Input row */}
      <div className="flex items-center gap-2 glass-inset p-1.5 rounded-xl">
        <div className="pl-3 text-white/30">
          <ScanLine className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && phase !== 'scanning' && runScan()}
          disabled={phase === 'scanning'}
          className="flex-1 bg-transparent outline-none text-[14px] font-mono text-white/90 placeholder-white/25 py-2 disabled:opacity-60"
          placeholder="https://your-site.com"
        />
        {phase === 'done' ? (
          <button onClick={reset} className="btn btn-secondary text-[12px]">
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        ) : (
          <button
            onClick={runScan}
            disabled={phase === 'scanning'}
            className="btn btn-primary text-[12px] disabled:opacity-60"
          >
            {phase === 'scanning'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning</>
              : <>Run demo <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="mt-6 min-h-[168px]">
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-[168px] text-center">
            <p className="text-[13px] text-white/45 max-w-xs">
              A simulated scan — hit <span className="text-white/70">Run demo</span> to watch
              Vanguard probe, validate, and verify findings in real time.
            </p>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="pt-6">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[13px] text-white/60">{DEMO_STAGES[stage]}</p>
              <p className="text-[11px] font-mono text-white/70 numeric">{progress}%</p>
            </div>
            <div className="progress-track">
              <div className="progress-fill progress-glow" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {['Headers', 'TLS', 'CORS', 'Cookies', 'Paths'].map((t, i) => (
                <span
                  key={t}
                  className="chip transition-opacity"
                  style={{ opacity: stage >= i ? 1 : 0.3 }}
                >
                  {stage > i && <Check className="w-3 h-3 text-[#4ADE80]" strokeWidth={2.5} />}
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4ADE80]" strokeWidth={2} />
                <span className="text-[13px] text-white/80">
                  {DEMO_FINDINGS.length} verified findings
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-serif text-gradient leading-none numeric">
                  <CountUp to={score} />
                </span>
                <span className="text-[12px] text-white/30 font-mono">/100</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {DEMO_FINDINGS.map((f, i) => (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={revealed > i ? { opacity: 1, y: 0 } : {}}
                  className="flex items-center gap-3 glass-inset px-3 py-2.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color, boxShadow: `0 0 8px ${f.color}` }} />
                  <span className="text-[13px] text-white/85 flex-1">{f.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-[#4ADE80]/80">
                    <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2} /> Verified
                  </span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: f.color }}>{f.risk}</span>
                </motion.div>
              ))}
            </div>
            {revealed >= DEMO_FINDINGS.length && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => navigate('/scan')}
                className="mt-4 w-full text-center text-[12px] text-[#7BB8FF] hover:text-white transition-colors"
              >
                Run this for real on your own URL →
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────── */

export default function Landing() {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  // Hero scroll parallax
  const heroRef = useRef(null);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(heroScroll, [0, 1], [0, 140]);
  const heroFade = useTransform(heroScroll, [0, 0.7], [1, 0]);

  // Hero cursor spotlight
  const smx = useMotionValue(-500);
  const smy = useMotionValue(-500);
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${smx}px ${smy}px, rgba(123,184,255,0.10), transparent 65%)`;
  const onHeroMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    smx.set(e.clientX - r.left);
    smy.set(e.clientY - r.top);
  };

  const sections = ['top', 'try', 'problem', 'how', 'proof', 'features', 'loop', 'cta'];

  return (
    <div className="relative bg-[#07090F] text-white/90 overflow-x-hidden">
      {/* Scroll progress */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7BB8FF] to-[#C4B5FD] origin-left z-50"
      />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-40 backdrop-blur-xl bg-[#07090F]/50 border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD]" />
              <div className="absolute inset-[1px] rounded-[7px] bg-[#07090F]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD]" />
              </div>
            </div>
            <span className="text-[15px] font-medium tracking-tight">Vanguard AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-white/55">
            <a href="#try" className="hover:text-white/90 transition-colors">Try it</a>
            <a href="#how" className="hover:text-white/90 transition-colors">How it works</a>
            <a href="#proof" className="hover:text-white/90 transition-colors">Proof</a>
            <a href="#features" className="hover:text-white/90 transition-colors">Features</a>
          </div>
          <button onClick={() => navigate('/')} className="btn btn-primary text-[13px]">
            Open app <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* Section dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-3">
        {sections.map((s) => (
          <a key={s} href={`#${s}`} className="w-2 h-2 rounded-full bg-white/20 hover:bg-[#7BB8FF] hover:scale-150 transition-all" aria-label={s} />
        ))}
      </div>

      {/* ── 1 · HERO ─────────────────────────────── */}
      <section
        id="top"
        ref={heroRef}
        onMouseMove={onHeroMove}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        <div className="absolute inset-0 bg-grid" />
        <motion.div style={{ background: spotlight }} className="absolute inset-0 z-[1]" />
        <div className="aurora w-[520px] h-[520px] bg-[#7BB8FF]/30 -top-40 -left-20" />
        <div className="aurora w-[460px] h-[460px] bg-[#C4B5FD]/25 top-20 right-0" style={{ animationDelay: '4s' }} />
        <div className="aurora w-[400px] h-[400px] bg-[#4ADE80]/12 bottom-0 left-1/3" style={{ animationDelay: '8s' }} />

        <motion.div style={{ y: heroY, opacity: heroFade }} className="relative z-10 text-center px-6 max-w-4xl">
          <Reveal><Eyebrow icon={Sparkles}>Autonomous security engineer</Eyebrow></Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-[44px] md:text-[72px] leading-[0.98] font-display font-medium tracking-tight">
              Security scanning
              <br />
              you can <span className="font-serif italic text-gradient">actually trust</span>
            </h1>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-7 text-[16px] md:text-[18px] text-white/55 max-w-xl mx-auto leading-relaxed">
              Vanguard runs real HTTP security checks against any live target and ships
              every finding with reproducible proof — then lets AI explain, prioritize, and
              verify the fix.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-9 flex items-center justify-center gap-3">
              <Magnetic onClick={() => navigate('/scan')} className="btn btn-primary">
                Start a scan <ArrowRight className="w-4 h-4" />
              </Magnetic>
              <a href="#try" className="btn btn-secondary">Try it live</a>
            </div>
          </Reveal>
          <Reveal delay={0.35}>
            <div className="mt-10 flex items-center justify-center gap-6 text-[12px] text-white/40">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80]" /> Verified findings</span>
              <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-[#7BB8FF]" /> Reproducible proof</span>
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#C4B5FD]" /> AI analysis</span>
            </div>
          </Reveal>
        </motion.div>

        <motion.a
          href="#try"
          style={{ opacity: heroFade }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/30 hover:text-white/60 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </motion.a>
      </section>

      {/* Marquee */}
      <div className="relative py-6 border-y border-white/[0.05] overflow-hidden">
        <div className="marquee-track gap-10">
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="flex gap-10 pr-10 shrink-0">
              {['Security Headers', 'TLS / SSL', 'CORS Policy', 'Cookie Flags', 'Sensitive Paths', 'Info Disclosure', 'Cache Control', 'HTTP → HTTPS', 'Compliance']
                .map((t) => (
                  <span key={t} className="flex items-center gap-2 text-[13px] text-white/35 whitespace-nowrap">
                    <span className="w-1 h-1 rounded-full bg-[#7BB8FF]/60" /> {t}
                  </span>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── 2 · TRY IT LIVE ──────────────────────── */}
      <section id="try" className="relative py-32 px-6 overflow-hidden">
        <div className="aurora w-[420px] h-[420px] bg-[#7BB8FF]/12 top-10 -left-24" />
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <Reveal><Eyebrow icon={ScanLine}>Try it live</Eyebrow></Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-[32px] md:text-[46px] font-display font-medium tracking-tight leading-tight">
                See a scan
                <br />
                <span className="font-serif italic text-gradient">happen in real time</span>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-6 text-[15px] text-white/55 leading-relaxed max-w-md">
                This interactive demo mirrors the real engine — watch it probe the target,
                tick through each check, and reveal verified findings with a live security score.
                When you're ready, run it for real on your own URL.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <InteractiveScan />
          </Reveal>
        </div>
      </section>

      {/* ── 3 · PROBLEM ─────────────────────────── */}
      <section id="problem" className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal><Eyebrow icon={Radar}>The trust problem</Eyebrow></Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-[32px] md:text-[48px] font-display font-medium tracking-tight leading-tight">
              Most scanners hand you a list
              <br />
              and ask you to <span className="text-white/40">take their word for it.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 text-[16px] text-white/55 max-w-2xl mx-auto leading-relaxed">
              Noisy false positives. Findings you can't reproduce. No way to prove a fix
              actually worked. Security teams end up trusting a black box — or ignoring it.
            </p>
          </Reveal>

          <div className="mt-16 grid md:grid-cols-3 gap-4" style={{ transformStyle: 'preserve-3d' }}>
            {[
              { icon: Radar, t: 'False positives', d: 'A redirect flagged as an exposed admin panel. Noise that erodes trust in every finding.' },
              { icon: Terminal, t: 'No evidence', d: 'A claim with no request, no response, no way to independently confirm it is real.' },
              { icon: GitCompareArrows, t: 'No verification', d: 'You patch, you hope. Nothing proves the vulnerability is actually gone.' },
            ].map((c, i) => (
              <Reveal key={c.t} delay={0.1 + i * 0.1}>
                <TiltCard>
                  <div className="glass p-6 h-full text-left">
                    <c.icon className="w-5 h-5 text-[#F87171] mb-4" strokeWidth={1.5} />
                    <h3 className="text-[15px] font-medium text-white/90 mb-2">{c.t}</h3>
                    <p className="text-[13px] text-white/50 leading-relaxed">{c.d}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4 · HOW IT WORKS ────────────────────── */}
      <section id="how" className="relative py-32 px-6 overflow-hidden">
        <div className="aurora w-[400px] h-[400px] bg-[#7BB8FF]/15 top-20 -right-20" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Reveal><Eyebrow icon={ScanLine}>How it works</Eyebrow></Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-[32px] md:text-[48px] font-display font-medium tracking-tight">
                Four steps, zero guesswork
              </h2>
            </Reveal>
          </div>
          <div className="space-y-4">
            {[
              { n: '01', t: 'Probe the live target', d: 'Real HTTP requests inspect headers, TLS, cookies, CORS, sensitive paths and information disclosure — against the actual running site.' },
              { n: '02', t: 'Validate every signal', d: 'Redirect chains are followed, response bodies are signature-matched, SPA fallbacks are fingerprinted. Only proven issues survive.' },
              { n: '03', t: 'Attach reproducible proof', d: 'Each finding carries the observed evidence and a runnable command so anyone can confirm it in seconds.' },
              { n: '04', t: 'Let AI reason over it', d: 'Llama 3.3 explains impact, chains an attack path, prioritizes fixes, and drafts secure code.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <motion.div whileHover={{ x: 6 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                  <div className="glass p-6 md:p-8 flex items-start gap-6 glass-card-hover">
                    <span className="text-[28px] font-serif text-white/20 numeric leading-none">{s.n}</span>
                    <div>
                      <h3 className="text-[18px] font-medium text-white/92 mb-1.5">{s.t}</h3>
                      <p className="text-[14px] text-white/55 leading-relaxed">{s.d}</p>
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5 · PROOF (typing terminal) ─────────── */}
      <section id="proof" className="relative py-32 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal><Eyebrow icon={Terminal}>No trust required</Eyebrow></Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-[32px] md:text-[46px] font-display font-medium tracking-tight leading-tight">
                Every finding ships
                <br />
                with <span className="font-serif italic text-gradient">receipts</span>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-6 text-[15px] text-white/55 leading-relaxed max-w-md">
                We don't ask you to believe us. Each vulnerability includes the exact response
                we observed and a one-line command you can run yourself. Confirm it in seconds —
                or watch it disappear on rescan.
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <div className="mt-8 flex flex-col gap-3">
                {['Observed response evidence', 'Copy-paste reproduction command', 'Verified badge on proven issues'].map((t) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#4ADE80]/12 border border-[#4ADE80]/25 flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#4ADE80]" strokeWidth={2.5} />
                    </span>
                    <span className="text-[14px] text-white/75">{t}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <Parallax speed={40}>
            <TypingTerminal />
          </Parallax>
        </div>
      </section>

      {/* ── 6 · FEATURES ────────────────────────── */}
      <section id="features" className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Reveal><Eyebrow icon={Sparkles}>What's inside</Eyebrow></Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-[32px] md:text-[48px] font-display font-medium tracking-tight">
                A complete security workflow
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: ShieldCheck, c: '#4ADE80', t: 'Verified findings', d: 'Signature-validated results with a proof trail. False positives filtered before they reach you.' },
              { icon: Gauge, c: '#7BB8FF', t: 'Security score', d: 'A single 0–100 grade with OWASP, PCI, ISO and SOC 2 compliance mapping.' },
              { icon: ListChecks, c: '#C4B5FD', t: 'Fix-first queue', d: 'Findings ranked by severity × confidence, so you always know what to patch next.' },
              { icon: GitCompareArrows, c: '#FB923C', t: 'Remediation diff', d: 'Rescan and see exactly what was fixed, what persists, and what is new.' },
              { icon: Zap, c: '#FBBF24', t: 'AI analysis', d: 'Attack-path chaining, plain-English impact, and secure code fixes in Python, JS and Java.' },
              { icon: Lock, c: '#F87171', t: 'Reports', d: 'Board-ready PDF and machine-readable JSON, generated from real scan data.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 0.08} y={30}>
                <TiltCard className="h-full">
                  <div className="glass p-6 h-full">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${f.c}14`, border: `1px solid ${f.c}30` }}>
                      <f.icon className="w-5 h-5" style={{ color: f.c }} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-[16px] font-medium text-white/92 mb-2">{f.t}</h3>
                    <p className="text-[13.5px] text-white/50 leading-relaxed">{f.d}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7 · THE LOOP (count-up stats) ───────── */}
      <section id="loop" className="relative py-32 px-6 overflow-hidden">
        <div className="aurora w-[500px] h-[500px] bg-[#C4B5FD]/15 -bottom-40 left-1/4" />
        <div className="max-w-5xl mx-auto text-center">
          <Reveal><Eyebrow icon={GitCompareArrows}>Closed loop</Eyebrow></Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-[32px] md:text-[48px] font-display font-medium tracking-tight leading-tight">
              Find it. Fix it.
              <br />
              <span className="font-serif italic text-gradient">Prove it's gone.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 text-[15px] text-white/55 max-w-xl mx-auto leading-relaxed">
              Vanguard remembers every scan of a target. Patch a header, rescan, and watch the
              finding move from <span className="text-[#F87171]">persisting</span> to
              {' '}<span className="text-[#4ADE80]">fixed</span> — with the score climbing to match.
            </p>
          </Reveal>
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { to: 30, suffix: '+', l: 'Checks per scan' },
              { to: 100, suffix: '%', l: 'Findings with proof' },
              { to: 4, suffix: '', l: 'Compliance frameworks' },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 0.1}>
                <Parallax speed={18 + i * 8}>
                  <div className="glass p-6">
                    <div className="text-[40px] md:text-[52px] font-serif text-gradient leading-none">
                      <CountUp to={s.to} suffix={s.suffix} />
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-white/40">{s.l}</p>
                  </div>
                </Parallax>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8 · CTA + footer ────────────────────── */}
      <section id="cta" className="relative py-32 px-6 overflow-hidden">
        <div className="aurora w-[600px] h-[300px] bg-[#7BB8FF]/20 top-0 left-1/2 -translate-x-1/2" />
        <Reveal>
          <div className="relative max-w-3xl mx-auto glass-elevated glow-border p-12 md:p-16 text-center shine">
            <h2 className="text-[32px] md:text-[52px] font-display font-medium tracking-tight leading-tight">
              Scan your first
              <br />
              <span className="font-serif italic text-gradient">target in seconds</span>
            </h2>
            <p className="mt-5 text-[15px] text-white/55 max-w-md mx-auto">
              No setup, no agent, no trust required. Paste a URL and get proof-backed results.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3">
              <Magnetic onClick={() => navigate('/scan')} className="btn btn-primary">
                Start scanning <ArrowRight className="w-4 h-4" />
              </Magnetic>
              <button onClick={() => navigate('/')} className="btn btn-secondary">
                Explore the dashboard
              </button>
            </div>
          </div>
        </Reveal>

        <footer className="max-w-6xl mx-auto mt-24 pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative w-6 h-6 rounded-md overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD]" />
              <div className="absolute inset-[1px] rounded-[5px] bg-[#07090F]" />
            </div>
            <span className="text-[13px] text-white/70">Vanguard AI</span>
          </div>
          <p className="text-[12px] text-white/35">
            Autonomous Security Engineer · Built for the NxtWave Hackathon
          </p>
        </footer>
      </section>
    </div>
  );
}
