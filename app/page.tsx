"use client";

import { useEffect, useRef, useCallback } from "react";

/* ─── Data ─────────────────────────────────────────── */

const PROJECTS = [
  {
    name: "antd-css-utilities",
    description:
      "CSS utility library for Ant Design with Tailwind-like helper classes. Published on npm with 22+ stars.",
    language: "JavaScript",
    stars: 22,
    github: "https://github.com/zahinafsar/antd-css-utilities",
    npm: "https://www.npmjs.com/package/antd-css-utilities",
    tags: ["CSS", "Ant Design", "npm"],
  },
  {
    name: "next-ts-api",
    description:
      "TypeScript-first API client generator for Next.js with full end-to-end type safety.",
    language: "TypeScript",
    stars: 9,
    github: "https://github.com/zahinafsar/next-ts-api",
    npm: "https://www.npmjs.com/package/next-ts-api",
    tags: ["Next.js", "TypeScript", "DX"],
  },
  {
    name: "Nagad Lite",
    description:
      "Lightweight Flutter mobile app for Nagad mobile payment services with clean UI.",
    language: "Dart",
    stars: 3,
    github: "https://github.com/zahinafsar/Nagad_Lite",
    tags: ["Flutter", "Mobile", "Fintech"],
  },
  {
    name: "sslcommerz-payment",
    description:
      "Payment gateway integration library for SSLCommerz — simplifying payments in Node.js.",
    language: "JavaScript",
    stars: 2,
    github: "https://github.com/zahinafsar/sslcommerz-payment",
    tags: ["Payments", "Node.js", "npm"],
  },
];

const SKILLS = {
  Languages: ["TypeScript", "JavaScript", "Python", "Dart", "C#"],
  Frameworks: ["React", "Next.js", "Node.js", "Tailwind CSS", "Flutter", ".NET"],
  Tools: ["Git", "Docker", "Linux", "VS Code", "Figma"],
};

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/zahinafsar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/zahin-afsar-498392184",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Email",
    href: "mailto:dummy@example.com",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
];

/* ─── Intersection Observer Hook ───────────────────── */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    const fadeEls = el.querySelectorAll(".fade-up");
    fadeEls.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ─── Star Icon ────────────────────────────────────── */

function StarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: "var(--accent)" }}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/* ─── Arrow Icon ───────────────────────────────────── */

function ArrowUpRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "transform 0.3s ease" }}
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

/* ─── Navigation ───────────────────────────────────── */

function Nav() {
  return (
    <nav className="fixed top-0 z-50 w-full">
      <div
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"
        style={{
          background: "rgba(10, 10, 11, 0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <a
          href="#"
          className="font-mono text-sm tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          zahin<span style={{ color: "var(--accent)" }}>.</span>
        </a>
        <div className="flex items-center gap-8">
          <a href="#about" className="nav-link">About</a>
          <a href="#projects" className="nav-link">Projects</a>
          <a href="#skills" className="nav-link">Skills</a>
          <a href="#contact" className="nav-link">Contact</a>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero Section ─────────────────────────────────── */

function Hero() {
  const sectionRef = useReveal();

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-center overflow-hidden px-6"
    >
      {/* Background blobs */}
      <div
        className="blob"
        style={{
          width: 500,
          height: 500,
          top: "-10%",
          right: "-10%",
          background: "rgba(196, 240, 77, 0.04)",
        }}
      />
      <div
        className="blob"
        style={{
          width: 400,
          height: 400,
          bottom: "10%",
          left: "-5%",
          background: "rgba(196, 240, 77, 0.03)",
          animationDelay: "-7s",
        }}
      />

      <div className="stagger mx-auto w-full max-w-6xl">
        <div className="fade-up">
          <div className="mb-6 flex items-center gap-3">
            <span className="status-dot" />
            <span
              className="font-mono text-xs tracking-widest"
              style={{ color: "var(--text-tertiary)" }}
            >
              AVAILABLE FOR WORK
            </span>
          </div>
        </div>

        <h1
          className="fade-up mb-6 text-5xl leading-[1.08] font-light tracking-tight sm:text-7xl md:text-8xl"
          style={{ color: "var(--text-primary)" }}
        >
          Zahin Afsar<span style={{ color: "var(--accent)" }}>.</span>
        </h1>

        <p
          className="fade-up mb-10 max-w-lg text-lg leading-relaxed sm:text-xl"
          style={{ color: "var(--text-secondary)" }}
        >
          Frontend Engineer crafting elegant, performant web experiences with
          TypeScript, React, and Next.js.
        </p>

        <div className="fade-up flex flex-wrap items-center gap-4">
          <a
            href="#projects"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium transition-all duration-300 hover:shadow-lg"
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              boxShadow: "0 0 0 0 var(--accent-glow)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 8px 32px var(--accent-glow-strong)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 0 0 var(--accent-glow)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            View Projects
            <ArrowUpRight />
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm transition-all duration-300"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Get in Touch
          </a>
        </div>

        {/* Scroll indicator */}
        <div
          className="fade-up absolute bottom-10 left-1/2 -translate-x-1/2"
          style={{ animationDelay: "1s" }}
        >
          <div
            className="flex flex-col items-center gap-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
              Scroll
            </span>
            <div
              className="h-8 w-px"
              style={{
                background:
                  "linear-gradient(to bottom, var(--text-tertiary), transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── About Section ────────────────────────────────── */

function About() {
  const sectionRef = useReveal();

  return (
    <section
      id="about"
      ref={sectionRef}
      className="px-6 py-32"
    >
      <div className="stagger mx-auto max-w-6xl">
        <span className="section-label fade-up mb-6 block">01 / About</span>

        <div className="grid gap-16 md:grid-cols-2">
          <div>
            <h2
              className="fade-up mb-8 text-3xl leading-snug font-light tracking-tight sm:text-4xl"
              style={{ color: "var(--text-primary)" }}
            >
              Building things that
              <br />
              <span style={{ color: "var(--accent)" }}>
                developers love
              </span>
              .
            </h2>
          </div>

          <div className="space-y-6">
            <p
              className="fade-up leading-relaxed"
              style={{ color: "var(--text-secondary)", fontSize: "1.0625rem" }}
            >
              I&apos;m a Frontend Engineer based in Dhaka, Bangladesh, focused on
              creating performant, accessible, and beautifully crafted web
              applications. I care deeply about developer experience and
              building tools that make other engineers more productive.
            </p>
            <p
              className="fade-up leading-relaxed"
              style={{ color: "var(--text-secondary)", fontSize: "1.0625rem" }}
            >
              My open source work spans CSS utility libraries, type-safe API
              generators, and mobile fintech apps — always with an emphasis on
              clean abstractions and practical DX. When I&apos;m not shipping
              features, I&apos;m likely exploring new patterns in TypeScript or
              contributing to the ecosystem.
            </p>
            <div className="fade-up flex flex-wrap gap-3 pt-2">
              {["TypeScript", "React", "Next.js", "Open Source"].map((tag) => (
                <span key={tag} className="skill-pill">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Projects Section ─────────────────────────────── */

function Projects() {
  const sectionRef = useReveal();

  return (
    <section id="projects" ref={sectionRef} className="px-6 py-32">
      <div className="stagger mx-auto max-w-6xl">
        <span className="section-label fade-up mb-6 block">
          02 / Projects
        </span>
        <h2
          className="fade-up mb-16 text-3xl font-light tracking-tight sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Selected work<span style={{ color: "var(--accent)" }}>.</span>
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {PROJECTS.map((project) => (
            <a
              key={project.name}
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="project-card fade-up group block"
            >
              <div className="relative z-10">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3
                      className="mb-1 text-lg font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {project.name}
                    </h3>
                    <div
                      className="flex items-center gap-3 font-mono text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <span>{project.language}</span>
                      <span className="flex items-center gap-1">
                        <StarIcon />
                        {project.stars}
                      </span>
                    </div>
                  </div>
                  <div
                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <ArrowUpRight />
                  </div>
                </div>

                {/* Description */}
                <p
                  className="mb-5 text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {project.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2.5 py-0.5 font-mono text-[11px]"
                      style={{
                        background: "var(--bg)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {project.npm && (
                    <span
                      className="rounded-full px-2.5 py-0.5 font-mono text-[11px]"
                      style={{
                        background: "rgba(196, 240, 77, 0.08)",
                        color: "var(--accent-dim)",
                        border: "1px solid rgba(196, 240, 77, 0.15)",
                      }}
                    >
                      npm
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="fade-up mt-10 text-center">
          <a
            href="https://github.com/zahinafsar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-sm transition-colors duration-300"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-tertiary)")
            }
          >
            View all repositories
            <ArrowUpRight />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Skills Section ───────────────────────────────── */

function Skills() {
  const sectionRef = useReveal();

  return (
    <section id="skills" ref={sectionRef} className="px-6 py-32">
      <div className="stagger mx-auto max-w-6xl">
        <span className="section-label fade-up mb-6 block">03 / Skills</span>
        <h2
          className="fade-up mb-16 text-3xl font-light tracking-tight sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Tools of the trade<span style={{ color: "var(--accent)" }}>.</span>
        </h2>

        <div className="grid gap-12 md:grid-cols-3">
          {Object.entries(SKILLS).map(([category, items]) => (
            <div key={category} className="fade-up">
              <h3
                className="mb-5 font-mono text-xs tracking-[0.15em] uppercase"
                style={{ color: "var(--text-tertiary)" }}
              >
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <span key={skill} className="skill-pill">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Contact Section ──────────────────────────────── */

function Contact() {
  const sectionRef = useReveal();

  return (
    <section id="contact" ref={sectionRef} className="px-6 py-32">
      <div className="stagger mx-auto max-w-6xl">
        <span className="section-label fade-up mb-6 block">04 / Contact</span>
        <h2
          className="fade-up mb-6 text-3xl font-light tracking-tight sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Let&apos;s work together<span style={{ color: "var(--accent)" }}>.</span>
        </h2>
        <p
          className="fade-up mb-12 max-w-md leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          I&apos;m always open to new opportunities, collaborations, or just a
          conversation about tech. Feel free to reach out.
        </p>

        <div className="fade-up flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("mailto:") ? undefined : "_blank"}
              rel={
                link.href.startsWith("mailto:")
                  ? undefined
                  : "noopener noreferrer"
              }
              className="contact-link"
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────── */

function Footer() {
  return (
    <footer className="px-6 py-10">
      <div className="divider mb-10" />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span
          className="font-mono text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          &copy; {new Date().getFullYear()} Zahin Afsar
        </span>
        <span
          className="font-mono text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          Built with Next.js &amp; Tailwind CSS
        </span>
      </div>
    </footer>
  );
}

/* ─── Page ─────────────────────────────────────────── */

export default function Home() {
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const cursor = document.getElementById("cursor-glow");
    if (cursor) {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div className="grain">
      {/* Cursor glow */}
      <div
        id="cursor-glow"
        className="pointer-events-none fixed z-40 hidden md:block"
        style={{
          width: 600,
          height: 600,
          marginLeft: -300,
          marginTop: -300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196, 240, 77, 0.035) 0%, transparent 70%)",
          transition: "left 0.15s ease-out, top 0.15s ease-out",
        }}
      />

      <Nav />

      <main>
        <Hero />
        <div className="divider mx-auto max-w-6xl" />
        <About />
        <div className="divider mx-auto max-w-6xl" />
        <Projects />
        <div className="divider mx-auto max-w-6xl" />
        <Skills />
        <div className="divider mx-auto max-w-6xl" />
        <Contact />
      </main>

      <Footer />
    </div>
  );
}
