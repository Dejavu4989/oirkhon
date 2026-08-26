import type { Metadata } from "next";
import GameBoard from "./GameBoard";

export const metadata: Metadata = {
  title: "Ойрхон — Өнөөдрийн нууц үг",
  description: "Өдөр бүр нэг нууц үг. Таалтаараа ойртуулж олоорой.",
};

export default function OirkhonPage() {
  return <GameBoard />;
}
