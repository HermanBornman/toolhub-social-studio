import { NextResponse } from "next/server";
import { authorize, type Permission } from "./authorization";
import { errorResponse } from "./server-user";
// Central gate runs before request parsing, reads, provider calls or mutations.
export function withAuthorization<A extends unknown[]>(permission: Permission, handler: (...args:A)=>Promise<Response>) {
  return async (...args:A):Promise<Response> => {
    try { authorize(permission); return await handler(...args); }
    catch (error) { const result=errorResponse(error); return NextResponse.json({error:result.error},{status:result.status}); }
  };
}
