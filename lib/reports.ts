export type ReportAdvert = { id: string; sku: string; status: string; campaignType: string; createdAt: Date; approvedAt: Date | null };
export type ReportPost = { id: string; advertisementId: string; status: string; createdAt: Date; publishedAt: Date | null; channels: { service: string; status: string; attemptCount: number }[]; advertisement: { sku: string; campaignType: string; product?: { category: string } | null } };

export function inRange(date: Date, start: Date, end: Date) { return date >= start && date <= end; }

export function buildOperationalReport(adverts: ReportAdvert[], posts: ReportPost[], start: Date, end: Date, aiCaptions = 0, manualCaptions = 0, cooldownDays = 14) {
  const scopedAdverts = adverts.filter((advert) => inRange(advert.createdAt, start, end));
  const approved = adverts.filter((advert) => advert.approvedAt && inRange(advert.approvedAt, start, end));
  const scopedPosts = posts.filter((post) => inRange(post.createdAt, start, end));
  const channelRows = scopedPosts.flatMap((post) => post.channels.map((channel) => ({ ...channel, postStatus: post.status })));
  const countBy = (values: string[]) => values.reduce<Record<string, number>>((result, value) => { const key = value || "Uncategorised"; result[key] = (result[key] || 0) + 1; return result; }, {});
  const reliability = Object.fromEntries([...new Set(channelRows.map((row) => row.service))].map((service) => {
    const rows = channelRows.filter((row) => row.service === service);
    const success = rows.filter((row) => row.status === "PUBLISHED").length;
    const failed = rows.filter((row) => row.status === "FAILED").length;
    return [service, { success, failed, rate: success + failed ? success / (success + failed) : 0 }];
  }));
  const success = channelRows.filter((row) => row.status === "PUBLISHED").length;
  const failed = channelRows.filter((row) => row.status === "FAILED").length;
  const published = posts.filter((post) => post.status === "PUBLISHED" && post.publishedAt).sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime());
  const repeats: string[] = [];
  for (let index = 1; index < published.length; index++) if (published[index].advertisement.sku === published[index - 1].advertisement.sku && (published[index].publishedAt!.getTime() - published[index - 1].publishedAt!.getTime()) / 86400000 < cooldownDays) repeats.push(published[index].advertisement.sku);
  const approvalTimes = approved.filter((advert) => advert.approvedAt).map((advert) => advert.approvedAt!.getTime() - advert.createdAt.getTime());
  return {
    metrics: {
      advertsCreated: scopedAdverts.length,
      advertsApproved: approved.length,
      approvalRate: scopedAdverts.length ? approved.length / scopedAdverts.length : 0,
      averageApprovalHours: approvalTimes.length ? approvalTimes.reduce((sum, value) => sum + value, 0) / approvalTimes.length / 3600000 : 0,
      postsScheduled: scopedPosts.filter((post) => post.status === "SCHEDULED").length,
      postsPublished: scopedPosts.filter((post) => post.status === "PUBLISHED").length,
      postsFailed: scopedPosts.filter((post) => ["FAILED", "PARTIALLY_PUBLISHED"].includes(post.status)).length,
      postsCancelled: scopedPosts.filter((post) => post.status === "CANCELLED").length,
      aiCaptionsGenerated: aiCaptions,
      manualCaptions,
      productsPromoted: new Set(scopedPosts.map((post) => post.advertisementId)).size,
      uniqueSkusPromoted: new Set(scopedPosts.map((post) => post.advertisement.sku)).size,
      publishingSuccessRate: success + failed ? success / (success + failed) : 0,
      failedAttempts: failed,
      retries: channelRows.reduce((total, row) => total + Math.max(0, row.attemptCount - 1), 0),
    },
    categoryMix: countBy(scopedPosts.map((post) => post.advertisement.product?.category || "Uncategorised")),
    campaignMix: countBy(scopedPosts.map((post) => post.advertisement.campaignType)),
    channelMix: countBy(channelRows.map((row) => row.service)),
    channelReliability: reliability,
    repeatSkus: [...new Set(repeats)],
  };
}
