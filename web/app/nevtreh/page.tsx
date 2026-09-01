import type { Metadata } from "next";
import { Suspense } from "react";
import SignInForm from "./SignInForm";

export const metadata: Metadata = {
  title: "Нэвтрэх — Ойрхон",
  description: "Ойрхон тоглоомд нэвтэрч, түүхээ хадгалаарай.",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
