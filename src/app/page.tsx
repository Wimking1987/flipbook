import Link from "next/link";
import { HomeClient } from "@/components/HomeClient";
import { blobStorageEnabled } from "@/lib/pdf-storage";

export default function Home() {
  return (
    <>
      <nav className="border-b border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            PDF Flipbook
          </Link>
        </div>
      </nav>
      <HomeClient useClientUpload={blobStorageEnabled()} />
    </>
  );
}
