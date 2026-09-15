import { AppShell } from "@/components/AppShell";
import { CreateAdvert } from "@/components/CreateAdvert";
import { prisma } from "@/lib/prisma";
import { EMPTY_ADVERT } from "@/lib/advert";
import { redirect } from "next/navigation";
import { canCreateAdvert } from "@/lib/user-role";
import { requirePageUser } from "@/lib/auth/page";

export default async function CreateAdvertPage({searchParams}:{searchParams:Promise<{productId?:string}>}) {
  const user=await requirePageUser();if(!canCreateAdvert(user.role)) redirect("/products");
  const productId=(await searchParams).productId;
  const branchPromise=user.role==="ADMIN"
    ? prisma.branch.findFirst({where:{active:true},orderBy:{name:"asc"}})
    : user.branchId
      ? prisma.branch.findFirst({where:{id:user.branchId,active:true}})
      : Promise.resolve(null);
  const [product,branch]=await Promise.all([productId?prisma.product.findUnique({where:{id:productId}}):null,branchPromise]);
  const initialData={...EMPTY_ADVERT,branchId:branch?.id,branchName:branch?.name||"",...(product?{productId:product.id,productName:product.productName,sku:product.sku,primarySpecification:product.primarySpecification,secondarySpecification:product.secondarySpecification||"",feature01:product.feature01||"",feature02:product.feature02||"",keyBenefit:product.keyBenefit||"",sellingPrice:String(product.currentPrice),qrUrl:product.websiteUrl||EMPTY_ADVERT.qrUrl,originalImageUrl:product.originalImageUrl,processedImageUrl:product.processedImageUrl||"",backgroundRemovalStatus:product.backgroundRemovalStatus as typeof EMPTY_ADVERT.backgroundRemovalStatus}:{})};
  return (
    <AppShell title="Create Advert" subtitle="Enter the product details. The template handles the design.">
      <CreateAdvert initialData={initialData} />
    </AppShell>
  );
}
