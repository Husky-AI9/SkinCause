import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell" id="main">
      <div className="panel empty-state">
        <SearchX size={40} aria-hidden="true" />
        <h1>That page is not part of this investigation.</h1>
        <p className="muted">Return to the dashboard to continue with the seeded workspace.</p>
        <Link className="button" href="/dashboard">Open dashboard</Link>
      </div>
    </main>
  );
}
