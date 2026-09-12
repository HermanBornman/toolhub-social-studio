import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./server";

// React cache is scoped to the current server render, never shared between users.
export const requirePageUser = cache(async () => {
  try { return await getCurrentUser(); }
  catch { redirect("/login"); }
});
