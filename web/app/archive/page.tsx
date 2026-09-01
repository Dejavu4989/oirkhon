import type { Metadata } from "next";
import ArchiveList from "./ArchiveList";

export const metadata: Metadata = {
  title: "Архив — Ойрхон",
  description: "Өмнөх өдрүүдийн нууц үгсийг тоглох.",
};

export default function Page() {
  return <ArchiveList />;
}
