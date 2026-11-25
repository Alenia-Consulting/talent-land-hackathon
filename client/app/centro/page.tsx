import Link from "next/link";

// The venue's side of the door: record a route, or review what was recorded. This is what the
// root used to be, before the root had to tell a visitor from a venue.
//
// The health check lives here and not on the root: it is a developer's tool, and a person who
// came to see a hospital before going to it has no business being shown whether the API is up.

import { es } from "../../lib/i18n/es.ts";
import HealthCheck from "../health-check.tsx";
import { BackLink, Card } from "../ui.tsx";

export default function Centro() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <BackLink href="/" />

      <h1 className="mt-6 text-4xl font-extrabold">{es.home.venue}</h1>

      <Link href="/grabar" className="mt-8 block rounded-3xl bg-pino p-6 text-white">
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
