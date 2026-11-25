// The venue's side of the door: record a route, or review what was recorded. This is what the
// root used to be, before the root had to tell a visitor from a venue.
//
// The two ways on are the same component the door offers, and in the order the work happens:
// there is nothing to review until something has been recorded, so recording is the filled one.
//
// The health check lives here and not on the root: it is a developer's tool, and a person who
// came to see a hospital before going to it has no business being shown whether the API is up.
// It sits below a line in the smallest type on the page, so it is not read as a third choice.

import { es } from "../../lib/i18n/es.ts";
import HealthCheck from "../health-check.tsx";
import { DocumentIcon, VideoIcon } from "../icons.tsx";
import { BackLink, Door, Wordmark } from "../ui.tsx";

const t = es.centro;

export default function Centro() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="flex items-center gap-3 border-b border-tinta/10 pb-5">
        <BackLink href="/" compact />
        <Wordmark />
      </header>

      <h1 className="mt-8 text-4xl font-extrabold">{t.title}</h1>
      <p className="mt-2 text-xl text-tinta/70">{t.lead}</p>

      <nav className="mt-8 grid gap-4">
        <Door
          href="/grabar"
          icon={<VideoIcon size={26} />}
          title={es.home.record}
          lead={es.home.recordLead}
          filled
        />
        <Door
          href="/panel"
          icon={<DocumentIcon size={26} />}
          title={es.panel.title}
          lead={t.guidesLead}
        />
      </nav>

      <div className="mt-12 border-t border-tinta/10 pt-5">
        <HealthCheck />
      </div>
    </main>
  );
}
