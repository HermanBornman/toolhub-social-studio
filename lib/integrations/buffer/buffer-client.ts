import { BufferError } from "./buffer-errors";

const ENDPOINT="https://api.buffer.com";
export class BufferGraphQLClient {
  constructor(private apiKey=process.env.BUFFER_API_KEY||"",private fetcher:typeof fetch=fetch){}
  async request<T>(query:string):Promise<T>{
    if(!this.apiKey)throw new BufferError("BUFFER_API_KEY is not configured","MISSING_KEY");
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await this.fetcher(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.apiKey}`},body:JSON.stringify({query}),signal:controller.signal});
      const body=await response.json() as {data?:T;errors?:Array<{message:string;extensions?:{code?:string}}>};
      if(!response.ok)throw new BufferError(`Buffer HTTP ${response.status}`,`HTTP_${response.status}`);
      if(body.errors?.length)throw new BufferError(body.errors.map(error=>error.message).join("; "),body.errors[0].extensions?.code||"GRAPHQL_ERROR",body.errors);
      if(!body.data)throw new BufferError("Buffer returned no data","EMPTY_RESPONSE"); return body.data;
    }catch(error){if(error instanceof BufferError)throw error;if(error instanceof Error&&error.name==="AbortError")throw new BufferError("Buffer request timed out","TIMEOUT");throw new BufferError(error instanceof Error?error.message:"Buffer request failed","NETWORK_ERROR");}finally{clearTimeout(timeout);}
  }
}
export function gqlString(value:string){return JSON.stringify(value);}
