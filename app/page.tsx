import { auth } from "@/auth";
import LoginScreen from "@/components/LoginScreen";
import PlaylistMakerApp from "@/components/PlaylistMakerApp";

export default async function Home() {
  const session = await auth();

  if (!session || session.error) {
    return <LoginScreen expired={Boolean(session?.error)} />;
  }

  return <PlaylistMakerApp />;
}
