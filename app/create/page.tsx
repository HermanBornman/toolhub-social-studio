import { AppShell } from "@/components/AppShell";
import { CreateAdvert } from "@/components/CreateAdvert";
import { prisma } from "@/lib/prisma";
import { TEST_ADVERT } from "@/lib/advert";
import { redirect } from "next/navigation";
import { canCreateAdvert, getCurrentUser } from "@/lib/user-role";

export default async function CreateAdvertPage({searchParams}:{searchParams:Promise<{productId?:string}>}) {
  if(!canCreateAdvert(getCurrentUser().role)) redirect("/products");
  const productId=(await searchParams).productId; const product=productId?await prisma.product.findUnique({where:{id:productId}}):null;
  const initialData=product?{...TEST_ADVERT,productId:product.id,productName:product.productName,sku:product.sku,primarySpecification:product.primarySpecification,secondarySpecification:product.secondarySpecification||"",feature01:product.feature01||"",feature02:product.feature02||"",keyBenefit:product.keyBenefit||"",sellingPrice:String(product.currentPrice),qrUrl:product.websiteUrl||TEST_ADVERT.qrUrl,originalImageUrl:product.originalImageUrl,processedImageUrl:product.processedImageUrl||"",backgroundRemovalStatus:product.backgroundRemovalStatus as typeof TEST_ADVERT.backgroundRemovalStatus}:undefined;
  return (
    <AppShell title="Create Advert" subtitle="Enter the product details. The template handles the design.">
      <CreateAdvert initialData={initialData} />
    </AppShell>
  );
}
