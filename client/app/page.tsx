import Link from "next/link";

import { es } from "../lib/i18n/es.ts";
import HealthCheck from "./health-check.tsx";

export default function Home() {
  return (
    <main>
      <h1>Antesala</h1>
      <Link href="/grabar" className="record-link">
        {es.home.record}
      </Link>
      <p>
        <Link href="/panel">{es.panel.title}</Link>
      </p>
      <HealthCheck />
    </main>
  );
}
