import { redirect } from "next/navigation";

// Redirects the root URL to the signed-in home dashboard.
export default function HomePage() {
  redirect("/home");
}
