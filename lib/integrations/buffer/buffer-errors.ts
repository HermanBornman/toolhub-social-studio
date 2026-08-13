export class BufferError extends Error { constructor(message:string,public code="BUFFER_ERROR",public metadata?:unknown){super(message);this.name="BufferError";} }
