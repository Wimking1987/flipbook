import { notFound } from "next/navigation";
import { FlipbookViewer, type FlipBackground } from "@/components/FlipbookViewer";

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

  return (
    <div
      className={`flex h-dvh min-h-dvh w-full flex-col p-0 ${bg === "neutral" ? "bg-white" : "bg-zinc-950"}`}
    >
      <FlipbookViewer
        pdfUrl={pdfUrl}
        docId={id}
        background={bg}
        embed
        className="min-h-0 flex-1"
      />
    </div>
  );
}
