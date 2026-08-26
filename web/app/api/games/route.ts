import { NextResponse } from "next/server";
import { GAME_SLUG } from "@/lib/actions";

export async function GET() {
  return NextResponse.json({
    games: [
      {
        slug: GAME_SLUG,
        name_mn: "Ойрхон",
        name_en: "Oirkhon",
        description_mn: "Өдөр бүр нэг нууц үг. Таалтаараа ойртуулж олоорой.",
        enabled: true,
      },
    ],
  });
}
