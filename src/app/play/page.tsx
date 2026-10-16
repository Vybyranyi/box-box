import { SetupWizard } from "@/components/setup/setup-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New race · Box Box" };

export default function PlayPage() {
  return <SetupWizard />;
}
