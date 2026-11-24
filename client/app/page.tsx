import Link from "next/link";

import { es } from "../lib/i18n/es.ts";
import HealthCheck from "./health-check.tsx";
import { Card } from "./ui.tsx";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-5xl font-extrabold">Antesala</h1>
      <p className="mt-2 text-xl text-tinta/70">{es.home.tagline}</p>

      <Link
        href="/grabar"
        className="mt-8 block rounded-3xl bg-pino p-6 text-white"
      >
        <span className="block text-2xl font-extrabold">{es.home.record}</span>
        <span className="mt-1 block text-lg text-white/80">{es.home.recordLead}</span>
      </Link>

      <Link href="/panel" className="mt-4 block">
        <Card className="border-2 border-transparent hover:border-pino">
          <span className="block text-2xl font-extrabold text-pino">{es.panel.title}</span>
          <span className="mt-1 block text-lg text-tinta/70">{es.panel.lead}</span>
        </Card>
      </Link>

      <div className="mt-10">
        <HealthCheck />
      </div>
    </main>
  );
}
