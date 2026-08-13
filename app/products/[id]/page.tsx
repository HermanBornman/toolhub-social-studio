import { redirect } from "next/navigation"; export default async function ProductPage({params}:{params:Promise<{id:string}>}) { redirect(`/products/${(await params).id}/edit`); }
