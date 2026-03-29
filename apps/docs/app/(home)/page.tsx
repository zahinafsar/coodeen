import Link from 'next/link';

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
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.7)]">
      {/* Top bar — hamburger + logo ... settings */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Hamburger */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/50">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <CoodIcon className="!h-5 !w-5" />
        </div>
        {/* Settings gear */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>

      {/* Main split */}
      <div className="flex" style={{ height: 420 }}>
        {/* ===== LEFT: Chat panel ===== */}
        <div className="flex w-[50%] flex-col border-r border-white/[0.08]">
          {/* Centre content — logo + input */}
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            {/* COODEEN logo text */}
            <div className="mb-10">
              <CoodLogoText />
            </div>

            {/* Prompt input */}
            <div className="w-full max-w-md">
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5">
                {/* Attach icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-white/30">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span className="flex-1 text-sm text-white/30">Describe what you want to build...</span>
                {/* Send button */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-black">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Pills row */}
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

        {/* ===== RIGHT: Preview panel ===== */}
        <div className="flex w-[50%] flex-col">
          {/* Tabs */}
          <div className="flex items-center border-b border-white/[0.08] bg-[#0c0c0c]">
            <button className="border-b-2 border-white/80 px-4 py-2 text-xs font-medium text-white/80">Preview</button>
            <button className="px-4 py-2 text-xs text-white/30">Files</button>
            <button className="px-4 py-2 text-xs text-white/30">Git</button>
          </div>

          {/* URL bar */}
          <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#111] px-3 py-1.5">
            {/* Monitor icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-white/30">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <div className="flex-1 rounded bg-white/[0.04] px-2.5 py-1">
              <span className="text-xs text-white/50">http://localhost:3000</span>
            </div>
          </div>

          {/* White preview area */}
          <div className="flex-1 bg-white">
            {/* subtle app wireframe inside */}
            <div className="flex h-full flex-col items-center justify-center opacity-[0.08]">
              <div className="mb-4 h-3 w-32 rounded bg-black" />
              <div className="mb-2 h-2 w-48 rounded bg-black" />
              <div className="mb-6 h-2 w-40 rounded bg-black" />
              <div className="h-8 w-24 rounded-md bg-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Resize handle (decorative) */}
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

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[#00363E]/20 blur-[120px]" />
        <div className="absolute -top-1/4 left-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#0ea5e9]/10 blur-[100px]" />
        <div className="absolute -top-1/4 right-1/4 h-[400px] w-[500px] rounded-full bg-[#8b5cf6]/8 blur-[100px]" />
      </div>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-24 text-center sm:pt-32">
        {/* Icon */}
        <div className="mb-8 drop-shadow-[0_8px_30px_rgba(0,54,62,0.4)]">
          <CoodIcon />
        </div>

        {/* Title */}
        <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-7xl">
          Coodeen
        </h1>

        {/* Description */}
        <p className="mb-8 max-w-lg text-lg text-fd-muted-foreground">
          AI coding assistant with a split-pane editor — chat on the left, live preview on the right.
        </p>

        {/* CTA */}
        <div className="mb-20 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center rounded-full bg-fd-primary px-8 font-medium text-fd-primary-foreground transition-all hover:bg-fd-primary/90 hover:shadow-lg hover:shadow-fd-primary/25"
          >
            Get Started
          </Link>
          <div className="inline-flex h-11 items-center gap-2 rounded-full border border-fd-border bg-fd-card/50 px-6 font-mono text-sm backdrop-blur-sm">
            <span className="text-fd-muted-foreground">$</span>
            <span>npx coodeen</span>
          </div>
        </div>
      </div>

      {/* Product mockup */}
      <div className="relative z-10 px-4 pb-24 sm:px-8">
        <AppMockup />
        {/* Fade at bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-fd-background to-transparent" />
      </div>
    </main>
  );
}
