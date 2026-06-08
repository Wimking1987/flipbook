import { notFound } from "next/navigation";
import { FlipbookViewer, type FlipBackground } from "@/components/FlipbookViewer";
import {
  coverUrlFromManifest,
  getFlipManifest,
} from "@/lib/flip-manifest";

const ID_RE = /^[a-zA-Z0-9_-]{12,24}$/;

function parseBg(v: string | undefined): FlipBackground {
  if (v === "wood" || v === "dark" || v === "neutral") return v;
  return "neutral";
}

export default async function EmbedPage({
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
  const manifest = await getFlipManifest(id);
  const coverUrl = coverUrlFromManifest(manifest);
  const preloadCover = coverUrl ?? `/api/flip/${id}/cover`;

  return (
    <div
      className={`flex h-dvh min-h-dvh w-full flex-col p-0 ${bg === "neutral" ? "bg-white" : "bg-zinc-950"}`}
    >
      <link
        rel="preload"
        as="image"
        href={preloadCover}
        fetchPriority="high"
      />
      <FlipbookViewer
        pdfUrl={pdfUrl}
        docId={id}
        coverUrl={coverUrl ?? undefined}
        coverWidth={manifest?.width}
        coverHeight={manifest?.height}
        background={bg}
        embed
        className="min-h-0 flex-1"
      />
    </div>
  );
}
