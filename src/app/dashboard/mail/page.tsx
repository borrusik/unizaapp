import { redirect } from "next/navigation";
import { INTERNAL_MAIL_ENABLED } from "@/lib/features";

export default async function MailPage() {
  if (!INTERNAL_MAIL_ENABLED) redirect("/dashboard/services?mail=paused");
  const { default: MailClient } = await import("./MailClient");
  return <MailClient />;
}
