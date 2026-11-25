import Link from "next/link";

// The door. Two ways in, and the question is what you came to do — not who you are.
//
// Asking somebody to declare a disability to get in would go against the rule this app already
// keeps in lib/pure/prefs.ts ("Sin diagnósticos"), and it would leave out the families and the
// support people, who are half of who this is for and have no disability of their own.
//
// The answer is not remembered. One tap costs nobody anything, and nothing that describes the
// person who opened the app is written down.

import { es } from "../lib/i18n/es.ts";
import { Card } from "./ui.tsx";

const t = es.home;

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-5xl font-extrabold">Antesala</h1>
      <p className="mt-2 text-xl text-tinta/70">{t.tagline}</p>

      <Link href="/buscar" className="mt-10 block rounded-3xl bg-pino p-6 text-white">
        <span className="block text-3xl font-extrabold">{t.visitor}</span>
        <span className="mt-2 block text-lg text-white/80">{t.visitorLead}</span>
      </Link>

      <Link href="/centro" className="mt-4 block">
        <Card className="border-2 border-transparent p-6 hover:border-pino">
          <span className="block text-3xl font-extrabold text-pino">{t.venue}</span>
          <span className="mt-2 block text-lg text-tinta/70">{t.venueLead}</span>
        </Card>
      </Link>
    </main>
  );
}
