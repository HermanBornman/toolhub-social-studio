import { requirePageUser } from "@/lib/auth/page";
import { redirect } from "next/navigation"; export default async function ProductPage({params}:{params:Promise<{id:string}>}) { await requirePageUser();  redirect(`/products/${(await params).id}/edit`); }
