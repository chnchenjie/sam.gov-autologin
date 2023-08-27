import pino, { DestinationStream } from "pino";
import pretty, { prettyFactory } from 'pino-pretty';
import { serializeError } from 'serialize-error';
export var clients = [];
import { Transform } from 'stream';
import build from 'pino-abstract-transport'

const pf = prettyFactory({ colorize: true, ignore: 'hostname,pid' });
export const pat = async function (opts) {
  return build(async function (source) {
    for await (let obj of source) {
      const log = pf(obj);
      console.log('obj', log);
      send(log);
    }
  })
}
let i: Transform = await pat({});
export const logger = pino(i);

export const send = (log) => {
  clients.forEach((client) => {
    client.emit('log', log);
  });
}