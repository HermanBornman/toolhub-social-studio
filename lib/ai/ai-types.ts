import { z } from "zod";

export const CAPTION_TONES = ["Professional","Energetic","Short & Punchy","Contractor Focused","DIY Focused","Product Launch","Back In Stock","Special Offer"] as const;
export type CaptionTone = typeof CAPTION_TONES[number];
export const captionOptionSchema=z.object({tone:z.string().min(1),caption:z.string().min(1).max(5000),hashtags:z.array(z.string().regex(/^#[A-Za-z0-9]+$/)).max(8)});
export const captionResponseSchema=z.object({options:z.array(captionOptionSchema).length(3)});
export type CaptionResponse=z.infer<typeof captionResponseSchema>;
export type AdvertFacts={advertisementId:string;productName:string;sku:string;brand:string;category:string;primarySpecification:string;secondarySpecification:string;feature01:string;feature02:string;keyBenefit:string;campaignType:string;campaignMessage:string;sellingPrice:number;disclaimer:string;websiteUrl:string};
export type AIResult<T>={data:T;provider:string;model:string;promptVersion:string;usage?:{inputTokens?:number;outputTokens?:number;estimatedCost?:number};fallback:boolean;message?:string};
