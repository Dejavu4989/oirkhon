import type { Metadata } from "next";
import { Suspense } from "react";
import GameBoard from "./GameBoard";

export const metadata: Metadata = {
  title: "Ойрхон — Өнөөдрийн нууц үг",
  description: "Өдөр бүр нэг нууц үг. Таалтаараа ойртуулж олоорой.",
};

export default function OirkhonPage() {
  return (
    <Suspense fallback={null}>
      <GameBoard />
    </Suspense>
  );
}
