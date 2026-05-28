import Link from "next/link";
import { notFound } from "next/navigation";
import { FlipbookViewer, type FlipBackground } from "@/components/FlipbookViewer";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

function parseBg(v: string | undefined): FlipBackground {
  if (v === "wood" || v === "dark" || v === "neutral") return v;
  return "neutral";
}

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bg?: string }>;
}) {
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();
  const sp = await searchParams;
  const bg = parseBg(sp.bg);
  const pdfUrl = `/api/pdf/${id}`;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      <nav className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/80 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Link
          href="/"
          className="text-sm font-medium text-amber-800 hover:underline dark:text-amber-200"
        >
          Neues PDF
        </Link>
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          Hintergrund per URL:{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
            ?bg=wood
          </code>
        </span>
      </nav>
      <main className="flex min-h-0 flex-1 flex-col items-center px-3 py-6 sm:px-6">
        <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col">
          <FlipbookViewer
            pdfUrl={pdfUrl}
            docId={id}
            background={bg}
            className="min-h-0 flex-1"
          />
        </div>
      </main>
    </div>
  );
}
