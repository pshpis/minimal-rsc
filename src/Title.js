import fs from 'fs';
import myHelmetEmitter from '../server/utils/myHelmetEmitter.js';

export function Title({value}) {
  myHelmetEmitter.emit('updateTitle', value);
  myHelmetEmitter.emit('updateTitleWebpack', value);
  return <></>;
}
