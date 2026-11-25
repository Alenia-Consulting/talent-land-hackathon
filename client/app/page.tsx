import Link from "next/link";

// The door. Two ways in, and the question is what you came to do — not who you are.
//
// Asking somebody to declare a disability to get in would go against the rule this app already
// keeps in lib/pure/prefs.ts ("Sin diagnósticos"), and it would leave out the families and the
// support people, who are half of who this is for and have no disability of their own.
//
// The answer is not remembered. One tap costs nobody anything, and nothing that describes the
// person who opened the app is written down.
//
// The two doors are the same shape and sit one above the other, in the order of who opens this
// most: the visitor's first, because a venue person taps this twice and a visitor taps it once,
// knowing nothing about the product. Nothing here moves, fades or waits.

import { es } from "../lib/i18n/es.ts";
import { AntesalaMark, ChevronRightIcon, SearchIcon, VideoIcon } from "./icons.tsx";

const t = es.home;

/** One of the two ways in. Same shape both times, so neither reads as the afterthought. */
function Door({
  href,
  icon,
  title,
  lead,
  filled,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  lead: string;
  filled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-3xl p-5 ${
        filled ? "bg-pino text-sobre-pino" : "border-2 border-pino/20 bg-tarjeta text-tinta"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
          filled ? "bg-sobre-pino/15" : "bg-salvia text-pino"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-extrabold">{title}</span>
        <span className={`mt-1 block text-lg ${filled ? "text-sobre-pino/85" : "text-tinta/70"}`}>
          {lead}
        </span>
      </span>
      <span aria-hidden="true" className={filled ? "text-sobre-pino/70" : "text-pino"}>
        <ChevronRightIcon size={26} />
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="flex items-center gap-3">
        <span className="text-pino">
          <AntesalaMark size={44} />
        </span>
        <span className="text-2xl font-extrabold">antesala</span>
      </header>

      {/* The promise is the heading, not the brand name: somebody who lands here has never
          heard the name, and what the product does is what tells them whether to stay. */}
      <h1 className="mt-10 text-4xl leading-tight font-extrabold text-balance">{t.tagline}</h1>
      <p className="mt-3 text-xl text-tinta/70">{t.lead}</p>

      <nav className="mt-10 grid gap-4">
        <Door
          href="/buscar"
          icon={<SearchIcon size={26} />}
          title={t.visitor}
          lead={t.visitorLead}
          filled
        />
        <Door href="/centro" icon={<VideoIcon size={26} />} title={t.venue} lead={t.venueLead} />
      </nav>

      {/* Not decoration: it is the rule that makes this safe to trust, and the person deciding
          whether to use it should read it before they tap, not after. */}
      <p className="mt-10 text-base text-tinta/55">{t.promise}</p>
    </main>
  );
}
