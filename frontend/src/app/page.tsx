import { cookies } from "next/headers";
import { SignInFlow } from "@/components/ui/sign-in-flow-1/SignInFlow";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const hasSession =
    Boolean(cookieStore.get("access_token")?.value) ||
    Boolean(cookieStore.get("refresh_token")?.value);

  return <SignInFlow hasSession={hasSession} />;
}
