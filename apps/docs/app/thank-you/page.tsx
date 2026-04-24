'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const REPO_BASE = 'https://github.com/zahinafsar/coodeen';
const DOWNLOAD_BASE = `${REPO_BASE}/releases/latest/download`;
const DEFAULT_FILE = 'Coodeen-mac-arm64.dmg';
const XATTR_COMMAND = 'xattr -cr /Applications/Coodeen.app';

function CoodIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="96"
      height="96"
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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can fail under strict permissions — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ThankYouContent() {
  const params = useSearchParams();
  const file = params.get('file') ?? DEFAULT_FILE;
  const downloadUrl = `${DOWNLOAD_BASE}/${file}`;

  useEffect(() => {
    const el = document.createElement('a');
    el.href = downloadUrl;
    el.rel = 'noopener';
    document.body.appendChild(el);
    el.click();
    el.remove();
  }, [downloadUrl]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0e14] px-6 py-20 text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-[#00363E]/20 blur-[120px]" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <CoodIcon className="mb-8 rounded-3xl shadow-[0_4px_16px_4px_rgba(0,0,0,0.3)]" />

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Thanks for downloading Coodeen</h1>

        <p className="mb-10 max-w-xl text-base leading-relaxed text-white/60">
          Your download should start automatically. If it doesn&apos;t,{' '}
          <a href={downloadUrl} className="underline decoration-white/30 underline-offset-4 hover:text-white">
            click here to start it manually
          </a>
          .
        </p>

        <div className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-left backdrop-blur-xl">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
            macOS · One more step
          </div>

          <p className="mb-4 text-sm leading-relaxed text-white/70">
            After installing, run this in Terminal to clear the Gatekeeper quarantine attribute on the unsigned app:
          </p>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-black/40 px-4 py-3">
            <code className="flex-1 font-mono text-sm font-bold text-white">
              {XATTR_COMMAND}
            </code>
            <CopyButton value={XATTR_COMMAND} />
          </div>

          <p className="text-xs leading-relaxed text-white/40">
            Coodeen isn&apos;t code-signed yet, so macOS may otherwise refuse to launch it. This command is safe — it removes the quarantine flag only for the app you installed.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/docs/getting-started/quick-start" className="text-white/60 transition-colors hover:text-white">
            Quick start guide
          </Link>
          <Link href="/docs" className="text-white/60 transition-colors hover:text-white">
            Documentation
          </Link>
          <Link href="/" className="text-white/40 transition-colors hover:text-white/80">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouContent />
    </Suspense>
  );
}
