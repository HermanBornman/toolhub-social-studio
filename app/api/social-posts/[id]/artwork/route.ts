import { validatePng } from "@/lib/png-transparency";
import { withAuthorization } from "@/lib/route-authorization";
import { NextResponse } from "next/server";import { prisma } from "@/lib/prisma";
async function GETHandler(_:Request,{params}:{params:Promise<{id:string}>}){
  const post=await prisma.socialPost.findUnique({where:{id:(await params).id},select:{finalArtworkData:true}});
  if(!post?.finalArtworkData)return NextResponse.json({error:"Artwork not found"},{status:404});
  const {bytes}=validatePng(post.finalArtworkData,{finalArtwork:true});
  return new NextResponse(bytes,{headers:{"Content-Type":"image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}

export const GET = withAuthorization("MARKETING", GETHandler);
