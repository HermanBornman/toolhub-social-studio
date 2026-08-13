import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CreateAdvert } from "@/components/CreateAdvert";
import { prisma } from "@/lib/prisma";
import type { AdvertFormData } from "@/lib/advert";
import { getCurrentUser } from "@/lib/user-role";

export default async function AdvertPage({params}:{params:Promise<{id:string}>}) {
  const advert=await prisma.advertisement.findUnique({where:{id:(await params).id}}); if(!advert)notFound();
  const user=getCurrentUser(); if(user.role==="STAFF"&&advert.createdByUserId!==user.id)notFound();
  const data:AdvertFormData={productId:advert.productId||undefined,productName:advert.productName,sku:advert.sku,primarySpecification:advert.primarySpecification,secondarySpecification:advert.secondarySpecification||"",feature01:advert.feature01||"",feature02:advert.feature02||"",keyBenefit:advert.keyBenefit||"",campaignType:advert.campaignType as AdvertFormData["campaignType"],campaignMessage:advert.campaignMessage,sellingPrice:String(advert.sellingPrice),disclaimer:advert.disclaimer,moodId:advert.moodId as AdvertFormData["moodId"],originalImageUrl:advert.originalImageUrl,processedImageUrl:advert.processedImageUrl||"",backgroundRemovalStatus:advert.backgroundRemovalStatus as AdvertFormData["backgroundRemovalStatus"],useOriginalImage:advert.useOriginalImage,qrUrl:advert.qrUrl};
  return <AppShell title={advert.status==="DRAFT"?"Edit Advert":"Advert Details"} subtitle={`${advert.sku} · ${advert.status.replaceAll("_"," ")}`}><CreateAdvert initialData={data} initialId={advert.id} initialStatus={advert.status} approvalComment={advert.approvalComment}/></AppShell>;
}
