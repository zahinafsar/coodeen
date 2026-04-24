'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function CoodIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="120"
      height="120"
      viewBox="0 0 250 250"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="250" height="250" rx="40" fill="#00363E" />
      <rect x="131" y="214" width="178" height="22" transform="rotate(-90 131 214)" fill="white" />
      <rect x="36" y="214" width="178" height="22" transform="rotate(-90 36 214)" fill="white" />
      <rect x="109" y="58" width="22" height="11" transform="rotate(-90 109 58)" fill="#ABABAB" />
      <rect x="109" y="214" width="22" height="11" transform="rotate(-90 109 214)" fill="#ABABAB" />
      <rect x="58" y="192" width="134" height="11" transform="rotate(-90 58 192)" fill="#ABABAB" />
      <rect x="153" y="192" width="134" height="11" transform="rotate(-90 153 192)" fill="#ABABAB" />
      <rect x="214" y="214" width="178" height="11" transform="rotate(-90 214 214)" fill="#ABABAB" />
      <rect x="109" y="58" width="73" height="22" transform="rotate(180 109 58)" fill="white" />
      <rect x="109" y="214" width="73" height="22" transform="rotate(180 109 214)" fill="white" />
      <rect x="214" y="214" width="81" height="22" transform="rotate(180 214 214)" fill="white" />
      <rect x="214" y="58" width="81" height="22" transform="rotate(180 214 58)" fill="white" />
      <rect x="192" y="214" width="178" height="22" transform="rotate(-90 192 214)" fill="white" />
    </svg>
  );
}

/* Coodeen logo text matching the actual app's blocky lettering */
function CoodLogoText() {
  return (
    <svg viewBox="0 0 768 250" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-auto sm:h-16">
      <rect x="36" y="214" width="178" height="22" transform="rotate(-90 36 214)" fill="white"/>
      <rect x="109" y="58" width="22" height="11" transform="rotate(-90 109 58)" fill="#ABABAB"/>
      <rect x="109" y="214" width="22" height="11" transform="rotate(-90 109 214)" fill="#ABABAB"/>
      <rect x="58" y="192" width="134" height="11" transform="rotate(-90 58 192)" fill="#ABABAB"/>
      <rect x="109" y="58" width="73" height="22" transform="rotate(180 109 58)" fill="white"/>
      <rect x="109" y="214" width="73" height="22" transform="rotate(180 109 214)" fill="white"/>
      <rect x="446" y="214" width="178" height="22" transform="rotate(-90 446 214)" fill="white"/>
      <rect x="519" y="58" width="22" height="11" transform="rotate(-90 519 58)" fill="#ABABAB"/>
      <rect x="519" y="214" width="22" height="11" transform="rotate(-90 519 214)" fill="#ABABAB"/>
      <rect x="468" y="192" width="134" height="11" transform="rotate(-90 468 192)" fill="#ABABAB"/>
      <rect x="519" y="58" width="73" height="22" transform="rotate(180 519 58)" fill="white"/>
      <rect x="519" y="214" width="73" height="22" transform="rotate(180 519 214)" fill="white"/>
      <rect x="519" y="136" width="22" height="11" transform="rotate(-90 519 136)" fill="#ABABAB"/>
      <rect x="519" y="136" width="73" height="22" transform="rotate(180 519 136)" fill="white"/>
      <rect x="541" y="214" width="178" height="22" transform="rotate(-90 541 214)" fill="white"/>
      <rect x="614" y="58" width="22" height="11" transform="rotate(-90 614 58)" fill="#ABABAB"/>
      <rect x="614" y="214" width="22" height="11" transform="rotate(-90 614 214)" fill="#ABABAB"/>
      <rect x="563" y="192" width="134" height="11" transform="rotate(-90 563 192)" fill="#ABABAB"/>
      <rect x="614" y="58" width="73" height="22" transform="rotate(180 614 58)" fill="white"/>
      <rect x="614" y="214" width="73" height="22" transform="rotate(180 614 214)" fill="white"/>
      <rect x="614" y="136" width="22" height="11" transform="rotate(-90 614 136)" fill="#ABABAB"/>
      <rect x="614" y="136" width="73" height="22" transform="rotate(180 614 136)" fill="white"/>
      <rect x="131" y="214" width="178" height="22" transform="rotate(-90 131 214)" fill="white"/>
      <rect x="153" y="192" width="134" height="11" transform="rotate(-90 153 192)" fill="#ABABAB"/>
      <rect x="214" y="214" width="178" height="11" transform="rotate(-90 214 214)" fill="#ABABAB"/>
      <rect x="214" y="214" width="81" height="22" transform="rotate(180 214 214)" fill="white"/>
      <rect x="214" y="58" width="81" height="22" transform="rotate(180 214 58)" fill="white"/>
      <rect x="192" y="214" width="178" height="22" transform="rotate(-90 192 214)" fill="white"/>
      <rect x="236" y="214" width="178" height="22" transform="rotate(-90 236 214)" fill="white"/>
      <rect x="258" y="192" width="134" height="11" transform="rotate(-90 258 192)" fill="#ABABAB"/>
      <rect x="319" y="214" width="178" height="11" transform="rotate(-90 319 214)" fill="#ABABAB"/>
      <rect x="319" y="214" width="81" height="22" transform="rotate(180 319 214)" fill="white"/>
      <rect x="319" y="58" width="81" height="22" transform="rotate(180 319 58)" fill="white"/>
      <rect x="297" y="214" width="178" height="22" transform="rotate(-90 297 214)" fill="white"/>
      <path d="M715.628 165.84L705.344 169.743L654.957 37.0176L657.638 36H666.337L715.628 165.84Z" fill="#ABABAB"/>
      <rect x="636.006" y="214" width="178" height="22" transform="rotate(-90 636.006 214)" fill="white"/>
      <rect x="658.001" y="214" width="140" height="11" transform="rotate(-90 658.001 214)" fill="#ABABAB"/>
      <rect x="724" y="216" width="178" height="11" transform="rotate(-90 724 216)" fill="#ABABAB"/>
      <rect x="702" y="216" width="178" height="22" transform="rotate(-90 702 216)" fill="white"/>
      <rect x="701.596" y="214.901" width="182.917" height="22" transform="rotate(-110.68 701.596 214.901)" fill="white"/>
      <rect x="341" y="214" width="178" height="22" transform="rotate(-90 341 214)" fill="white"/>
      <rect x="363" y="192" width="134" height="11" transform="rotate(-90 363 192)" fill="#ABABAB"/>
      <rect x="399" y="214" width="56" height="22" transform="rotate(180 399 214)" fill="white"/>
      <rect x="399" y="58" width="56" height="22" transform="rotate(180 399 58)" fill="white"/>
      <path d="M435.001 56.5947V193.412L410.743 214H382.347L380 211.235L413.001 183.229V66.7783L380.002 38.7734L382.355 36H410.733L435.001 56.5947Z" fill="#ABABAB"/>
      <path d="M424 56.5947V193.412L399.742 214H371.346L368.999 211.235L402 183.229V66.7783L369.001 38.7734L371.354 36H399.732L424 56.5947Z" fill="white"/>
    </svg>
  );
}

function AppMockup() {
  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-[0_8px_60px_-4px_rgba(0,54,62,0.3),0_20px_70px_-10px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/50">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <CoodIcon className="!h-6 !w-6" />
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>

      {/* Main split */}
      <div className="flex" style={{ height: 500 }}>
        {/* LEFT: Chat panel */}
        <div className="flex w-[50%] flex-col border-r border-white/[0.06]">
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <div className="mb-10">
              <CoodLogoText />
            </div>
            <div className="w-full max-w-md">
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-white/30">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span className="flex-1 text-sm text-white/30">Describe what you want to build...</span>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-black">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                  Agent
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  claude-sonnet-4
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  ~/my-app
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Preview panel */}
        <div className="flex w-[50%] flex-col">
          <div className="flex items-center border-b border-white/[0.06]">
            <button className="border-b-2 border-white/80 px-4 py-2 text-xs font-medium text-white/80">Preview</button>
            <button className="px-4 py-2 text-xs text-white/30">Files</button>
            <button className="px-4 py-2 text-xs text-white/30">Git</button>
          </div>
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-white/30">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <div className="flex-1 rounded bg-white/[0.04] px-2.5 py-1">
              <span className="text-xs text-white/50">http://localhost:3000</span>
            </div>
          </div>
          <div className="flex-1 bg-white">
            <div className="flex h-full flex-col items-center justify-center opacity-[0.08]">
              <div className="mb-4 h-3 w-32 rounded bg-black" />
              <div className="mb-2 h-2 w-48 rounded bg-black" />
              <div className="mb-6 h-2 w-40 rounded bg-black" />
              <div className="h-8 w-24 rounded-md bg-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-8 w-3 flex-col items-center justify-center gap-0.5 rounded-full bg-white/[0.06]">
          <div className="h-0.5 w-1 rounded-full bg-white/20" />
          <div className="h-0.5 w-1 rounded-full bg-white/20" />
          <div className="h-0.5 w-1 rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
}

function ElectricPulse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const gridSize = 80;
    const pulses: { x: number; y: number; dir: 'h' | 'v'; pos: number; speed: number; life: number; maxLife: number }[] = [];

    const spawnPulse = () => {
      const cols = Math.ceil(canvas.width / gridSize);
      const rows = Math.ceil(canvas.height / gridSize);
      const third = Math.floor(cols / 3);
      const col = Math.random() > 0.5
        ? Math.floor(Math.random() * third)
        : cols - 1 - Math.floor(Math.random() * third);
      pulses.push({
        x: col * gridSize, y: 0,
        dir: 'v', pos: 0,
        speed: 2 + Math.random() * 3,
        life: 0, maxLife: rows * gridSize,
      });
    };

    let frame: number;
    let tick = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;

      if (tick % 60 === 0 && pulses.length < 5) {
        spawnPulse();
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.pos += p.speed;

        if (p.pos > p.maxLife) {
          pulses.splice(i, 1);
          continue;
        }

        const tailLen = 120;
        const headPos = p.pos;
        const tailPos = Math.max(0, headPos - tailLen);

        const grad = p.dir === 'h'
          ? ctx.createLinearGradient(p.x + tailPos, p.y, p.x + headPos, p.y)
          : ctx.createLinearGradient(p.x, p.y + tailPos, p.x, p.y + headPos);

        grad.addColorStop(0, 'rgba(0, 54, 62, 0)');
        grad.addColorStop(0.5, 'rgba(0, 180, 200, 0.3)');
        grad.addColorStop(1, 'rgba(0, 220, 240, 0.6)');

        ctx.beginPath();
        if (p.dir === 'h') {
          ctx.moveTo(p.x + tailPos, p.y);
          ctx.lineTo(p.x + headPos, p.y);
        } else {
          ctx.moveTo(p.x, p.y + tailPos);
          ctx.lineTo(p.x, p.y + headPos);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bright head dot
        ctx.beginPath();
        if (p.dir === 'h') {
          ctx.arc(p.x + headPos, p.y, 2, 0, Math.PI * 2);
        } else {
          ctx.arc(p.x, p.y + headPos, 2, 0, Math.PI * 2);
        }
        ctx.fillStyle = 'rgba(0, 220, 240, 0.8)';
        ctx.fill();
      }

      frame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[1]" />;
}

function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Grid pattern */}
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Corner dots at grid intersections */}
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" width="80" height="80" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="1.5" fill="rgba(255,255,255,0.08)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Electric pulses on grid lines */}
      <ElectricPulse />

      {/* Radial glow behind hero */}
      <div className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-[#00363E]/25 blur-[120px]" />
      <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#00363E]/8 blur-[100px]" />
    </div>
  );
}

function FloatingNav() {
  return (
    <nav className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-5xl rounded-xl border border-white/[0.08] bg-[#0a0e14]/80 px-6 py-3 backdrop-blur-lg">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <CoodIcon className="h-6 w-6" />
          <span className="text-sm font-semibold text-white">Coodeen</span>
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          <Link href="/docs" className="text-sm text-white/50 transition-colors hover:text-white">
            Documentation
          </Link>
          <Link href="https://github.com/zahinafsar/coodeen" className="text-sm text-white/50 transition-colors hover:text-white">
            GitHub
          </Link>
        </div>

        <Link
          href="/docs"
          className="rounded-lg bg-[#00363E] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#004a54]"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}

function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.left = `${e.clientX}px`;
        glowRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={glowRef}
      className="pointer-events-none fixed z-30 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00363E]/15 blur-[80px] transition-[left,top] duration-200 ease-out"
    />
  );
}

const REPO_BASE = 'https://github.com/zahinafsar/coodeen';

const DOWNLOADS = [
  { key: 'mac', label: 'macOS', file: 'Coodeen-mac-arm64.dmg', icon: 'apple' },
] as const;

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'mac_arm64';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  if (ua.includes('mac')) return 'mac';
  return 'mac';
}

function PlatformIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'apple') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    );
  }
  if (type === 'windows') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 12V6.5l8-1.1V12H3zm0 .5h8v6.6l-8-1.1V12.5zM11.5 5.3l9.5-1.3v8h-9.5V5.3zm0 7.2h9.5v8l-9.5-1.3V12.5z" />
      </svg>
    );
  }
  // linux
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.868.065 1.544-.378 1.773-1.014.643.026 1.312-.236 1.996-.882.191-.18.379-.39.541-.622.349.086.733.065 1.145-.207.411-.272.652-.756.687-1.299.063-1.08-.459-1.882-1.368-2.248-.3-.13-.636-.2-.974-.263-.015-.07-.034-.134-.054-.198-.137-.343-.27-.676-.437-1.01-.175-.393-.382-.728-.596-1.067-.194-.308-.35-.683-.54-.903-.105-.148-.22-.265-.323-.363-.026-.027-.04-.048-.07-.07l-.007-.004a1.635 1.635 0 00-.088-.064l.007-.009c.146-.247.271-.461.406-.681.178-.37.329-.718.452-1.148.106-.381.16-.758.21-1.078.074-.525.132-1.116.27-1.571.142-.46.3-.791.508-1.05.154-.192.314-.358.49-.505l.007-.007a1.5 1.5 0 00.09-.103c.564-.648.893-1.467.954-2.392.064-.98-.161-1.854-.562-2.608-.814-1.502-2.127-2.406-3.328-2.95C14.555.247 13.51.06 12.504 0z" />
    </svg>
  );
}

function HeroDownload() {
  const [platform, setPlatform] = useState('mac');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const primary = DOWNLOADS.find((d) => d.key === platform) ?? DOWNLOADS[0];

  return (
    <div className="animate-hero-fade mb-24 flex flex-col items-center gap-4">
      <Link
        href={`/thank-you?file=${encodeURIComponent(primary.file)}`}
        className="inline-flex h-12 items-center gap-3 rounded-lg bg-[#00363E] px-8 text-sm font-semibold text-white transition-all hover:bg-[#004a54] hover:shadow-lg hover:shadow-[#00363E]/40"
      >
        <PlatformIcon type={primary.icon} className="h-5 w-5" />
        Download for {primary.label}
      </Link>
      <a
        href={`${REPO_BASE}/releases`}
        className="text-sm text-white/40 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/60"
      >
        All releases
      </a>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="animate-screen-shake relative flex min-h-screen flex-col overflow-hidden bg-[#0a0e14]">
      <CursorGlow />
      <FloatingNav />
      <GridBackground />

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-32 text-center sm:pt-40">
        {/* Icon */}
        <div className="animate-icon-zoom mb-8 rounded-[28px] shadow-[0_4px_16px_4px_rgba(0,0,0,0.3)]">
          <CoodIcon />
        </div>

        {/* Badge pill */}
        <div className="animate-hero-fade mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-1 py-1 pr-4 backdrop-blur-sm">
          <span className="rounded-full bg-[#00363E] px-3 py-0.5 text-xs font-semibold text-white">
            Open Source
          </span>
          <span className="text-sm text-white/60">AI-Powered Code Editor</span>
        </div>

        {/* Title */}
        <h1 className="animate-hero-fade mb-6 text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
          AI Coding Agent
        </h1>

        {/* Description */}
        <p className="animate-hero-fade mb-10 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
          Split-pane editor with chat on the left, live preview on the right.
          <br className="hidden sm:block" />
          Open source, fully local — powered by opencode.
        </p>

        {/* CTA */}
        <HeroDownload />
      </div>

      {/* Product mockup */}
      <div className="relative z-10 px-4 pb-24 sm:px-8">
        {/* Decorative dots on sides */}
        <div className="pointer-events-none absolute left-[8%] top-[10%] h-2.5 w-2.5 rounded-full border border-white/10 bg-white/5" />
        <div className="pointer-events-none absolute right-[8%] top-[10%] h-2.5 w-2.5 rounded-full border border-white/10 bg-white/5" />

        <AppMockup />

        {/* Fade at bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0e14] to-transparent" />
      </div>
    </main>
  );
}
