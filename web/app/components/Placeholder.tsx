import Link from "next/link";

/** Shared shell for pages the footer links to but that have no content yet. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pb-24 pt-24">
      <h1 className="text-3xl font-black tracking-tight">{title}</h1>
      <p className="mt-4 text-[14px] text-muted">Энэ хуудас тун удахгүй нэмэгдэнэ.</p>
      <Link href="/oirkhon" className="mt-6 inline-block text-[14px] font-semibold text-hot hover:underline">
        ← Тоглоом руу буцах
      </Link>
    </main>
  );
}
