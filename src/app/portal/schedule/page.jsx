import { getClientSession } from "@/lib/auth";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { user } = await getClientSession();
  return <ScheduleClient locale={user.locale || "en"} />;
}
