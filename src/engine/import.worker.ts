import { importGridString } from './gridImport';
self.onmessage=(event:MessageEvent<string>)=>{
  try {self.postMessage({puzzle:importGridString(event.data)});}
  catch(error) {self.postMessage({error:error instanceof Error ? error.message : 'Unable to import this grid.'});}
};
