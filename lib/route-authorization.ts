import { NextResponse } from "next/server";
import { authorize, type Permission } from "./authorization";
import { errorResponse } from "./server-user";
import { getCurrentUser, withRequestUser } from "./auth/server";
import { requireSameOrigin } from "./auth/http";
// Central gate runs before request parsing, reads, provider calls or mutations.
export function withAuthorization<A extends unknown[]>(permission: Permission, handler: (...args:A)=>Promise<Response>) {
  return async (...args:A):Promise<Response> => {
    try {
      const user = await getCurrentUser();
      authorize(permission, user);
      if (args[0] instanceof Request) requireSameOrigin(args[0]);
      const response = await withRequestUser(user, () => handler(...args));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    catch (error) { const result=errorResponse(error); return NextResponse.json({error:result.error},{status:result.status,headers:{"Cache-Control":"private, no-store"}}); }
  };
}
