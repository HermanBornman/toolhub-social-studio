export type BufferOrganization = { id:string; name:string };
export type BufferAccount = { id:string; name?:string|null; email:string; organizations:BufferOrganization[] };
export type BufferChannel = { id:string; name:string; displayName?:string|null; service:string; isDisconnected:boolean; isLocked:boolean; organizationId:string };
export type BufferPostResult = { id:string; status:string; dueAt?:string|null };
export type BufferCreateInput = { channelId:string; service:string; text:string; imageUrl:string; mode:"customScheduled"|"shareNow"; dueAt?:string };
export interface BufferService {
  readonly dryRun:boolean;
  getBufferAccount():Promise<BufferAccount>;
  getOrganizations():Promise<BufferOrganization[]>;
  getChannels(organizationId:string):Promise<BufferChannel[]>;
  createPost(input:BufferCreateInput):Promise<BufferPostResult>;
  getPosts(organizationId:string,channelIds:string[]):Promise<BufferPostResult[]>;
  deleteScheduledPost(postId:string):Promise<void>;
}
