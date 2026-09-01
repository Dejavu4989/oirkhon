"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconCalendar, IconClose, IconGear, IconHelp, IconMenu, IconStar, IconUser,
} from "./Icons";
import { displayNameOf, useViewer } from "./useViewer";

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-muted hover:text-ink";

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { user, accountsEnabled, reload } = useViewer();
  const [help, setHelp] = useState(false);
  const [account, setAccount] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!help) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setHelp(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help]);

  async function signOut() {
    setAccount(false);
    await fetch("/api/auth/logout", { method: "POST" });
    await reload();
    router.refresh();
  }

  return (
    <>
      <button onClick={onMenu} aria-label="Цэс"
              className={`${iconBtn} absolute left-4 top-5 lg:hidden`}>
        <IconMenu />
      </button>

      <div className="absolute right-4 top-5 z-30 flex items-center gap-2.5 sm:right-6">
        <button className={iconBtn} onClick={() => setHelp(true)} aria-label="Заавар">
          <IconHelp />
        </button>
        <Link href="/archive" className={iconBtn} aria-label="Архив">
          <IconCalendar />
        </Link>
        <button className={iconBtn} onClick={() => setToast("Тун удахгүй")} aria-label="Тохиргоо">
          <IconGear />
        </button>

        {user ? (
          <div className="relative">
            <button onClick={() => setAccount((v) => !v)} aria-expanded={account}
                    className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 transition-colors hover:border-muted">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2 text-[12px] font-bold">
                {displayNameOf(user).charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[9rem] truncate text-[13px] font-semibold">
                {displayNameOf(user)}
              </span>
              {user.is_subscribed && <span className="text-warm"><IconStar className="h-3.5 w-3.5" /></span>}
            </button>

            {account && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAccount(false)} />
                <div className="absolute right-0 top-11 z-20 w-60 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
                  <div className="border-b border-line px-4 py-2.5">
                    <p className="truncate text-[13px] font-semibold">{displayNameOf(user)}</p>
                    <p className="truncate text-[12px] text-muted">{user.email}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {user.is_subscribed
                        ? <span className="font-semibold text-warm">Захиалагч</span>
                        : "Үнэгүй хэрэглэгч"}
                    </p>
                  </div>
                  <Link href="/archive" onClick={() => setAccount(false)}
                        className="block px-4 py-2.5 text-[14px] transition-colors hover:bg-surface2">
                    Архив
                  </Link>
                  <button onClick={() => void signOut()}
                          className="block w-full px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-surface2">
                    Гарах
                  </button>
                </div>
              </>
            )}
          </div>
        ) : accountsEnabled ? (
          <Link href="/nevtreh"
                className="ml-1 flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors hover:text-ink">
            <IconUser className="h-4 w-4" /> Нэвтрэх
          </Link>
        ) : (
          <button onClick={() => setToast("Бүртгэл идэвхгүй байна")}
                  className="ml-1 text-[14px] font-semibold text-muted transition-colors hover:text-ink">
            Нэвтрэх
          </button>
        )}
      </div>

      {help && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
             role="dialog" aria-modal="true" aria-label="Хэрхэн тоглох вэ"
             onClick={() => setHelp(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-bg p-6"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-black tracking-tight">Хэрхэн тоглох вэ?</h2>
              <button onClick={() => setHelp(false)} aria-label="Хаах"
                      className="text-muted hover:text-ink"><IconClose /></button>
            </div>
            <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-muted">
              <p>Өдөр бүр нэг <strong className="text-ink">нууц үг</strong> байна.</p>
              <p>
                Таасан үг бүрд нууц үгтэй утгын хувьд хэр ойр болохыг илэрхийлэх
                <strong className="text-ink"> эрэмбэ</strong> харагдана.
                <strong className="text-ink"> 1</strong> бол зөв хариу.
              </p>
              <ul className="space-y-1.5">
                <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-hot align-middle" />Маш ойрхон (1–100)</li>
                <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-warm align-middle" />Ойрхон (101–1000)</li>
                <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-cold align-middle" />Хол (1000+)</li>
              </ul>
              <p>
                <strong className="text-ink">Сэжүүр</strong> нь таны одоогийн хамгийн сайн
                таалтаас илүү ойр байгаа үгийг харуулна. Өдөрт 3 удаа үнэгүй,
                захиалагчид 10 удаа.
              </p>
              <p>20 таалт хийсний дараа бууж өгөх боломжтой.</p>
              <p>Шинэ үг өдөр бүр 00:00 цагт (Улаанбаатар) солигдоно.</p>
              <p>Өмнөх өдрүүдийн тоглоомыг захиалагчид архиваас тоглох боломжтой.</p>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
