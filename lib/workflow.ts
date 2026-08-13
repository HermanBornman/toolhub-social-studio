import { z } from "zod";
import { canApproveAdvert, canEditAdvert, canReviewAdvert, type CurrentUser } from "./user-role";

export const ADVERT_STATUSES = ["DRAFT", "AWAITING_APPROVAL", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "SCHEDULED", "PUBLISHED", "FAILED", "ARCHIVED"] as const;
export type AdvertStatus = (typeof ADVERT_STATUSES)[number];
export const ACTIVE_WORKFLOW_STATUSES = ADVERT_STATUSES.slice(0, 5);
export const AUDIT_ACTIONS = ["CREATE_DRAFT","UPDATE_DRAFT","SUBMIT_FOR_APPROVAL","REQUEST_CHANGES","RESUBMIT_FOR_APPROVAL","APPROVE","REJECT","PRODUCT_CREATE","PRODUCT_UPDATE","PRODUCT_IMAGE_REPLACE"] as const;

export const approvalActionSchema = z.object({
  action: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
  comment: z.string().trim().max(500).default(""),
}).superRefine((value, context) => {
  if (["REQUEST_CHANGES", "REJECT"].includes(value.action) && !value.comment) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "A comment is required" });
  }
});

export function assertCanSubmit(advert: { status: string; createdByUserId: string }, user: CurrentUser) {
  if (!canEditAdvert(advert, user)) throw new Error("FORBIDDEN");
  if (!["DRAFT", "CHANGES_REQUESTED"].includes(advert.status)) throw new Error("INVALID_TRANSITION");
  return advert.status === "CHANGES_REQUESTED" ? "RESUBMIT_FOR_APPROVAL" : "SUBMIT_FOR_APPROVAL";
}

export function assertCanReview(advert: { status: string; createdByUserId: string; submittedByUserId?: string | null }, action: "APPROVE" | "REQUEST_CHANGES" | "REJECT", user: CurrentUser) {
  if (!canReviewAdvert(user.role)) throw new Error("FORBIDDEN");
  if (advert.status !== "AWAITING_APPROVAL") throw new Error("INVALID_TRANSITION");
  if (action === "APPROVE" && !canApproveAdvert(advert, user)) throw new Error("SELF_APPROVAL");
  return action === "APPROVE" ? "APPROVED" : action === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : "REJECTED";
}
