import {assert,deadline} from './core.mjs';
export async function boundedJson(req,limit=4096) {
  const reader=req.body?.getReader(); assert(reader,'Request body required');
  const chunks=[];let size=0;
  try {while(true){const {done,value}=await deadline(reader.read(),5000);if(done)break;size+=value.byteLength;assert(size<=limit,'Request too large');chunks.push(value);}}
  catch(e){void reader.cancel().catch(()=>{});throw e;}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
