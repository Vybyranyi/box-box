import { SetupWizard } from "@/components/setup/setup-wizard";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("play") };
}

export default function PlayPage() {
  return <SetupWizard />;
}
