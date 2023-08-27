import 'dotenv/config'
import express from 'express';
import http from 'http';
import { AddressInfo } from "net";
// import * as path from 'path';
import bodyParser from 'body-parser';

import Test from './demo.js'
import { serializeError } from 'serialize-error';

// const debug = require('debug')('my express app');
import debug from 'debug';

// const logger = debug('my express app');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const server = http.createServer(app);
const io = new Server(server);
import pino from "pino";
import { logger, clients, send } from "./logger.js";
import Utl from './utl.js'

// 使用socket.io发送日志消息
io.on('connection', (socket) => {
  console.log('A client connected');
  clients.push(socket);

  const [s1, s2] = Utl.printBox(false);
  socket.emit('log', s1);
  socket.emit('log', s2);

  socket.on('disconnect', () => {
    console.log('A client disconnected');
    const index = clients.indexOf(socket);
    if (index > -1) {
      clients.splice(index, 1);
    }
  });
});

// 中间件函数，用于限制请求处理
const requestLimitMiddleware = async (req, res, next) => {
  if (req.app.locals.isRequestProcessing) {
    // 如果已经有请求正在处理，则返回 429 Too Many Requests 响应
    return res.status(429).send('Too Many Requests');
  }

  // 将标志设置为正在处理请求
  req.app.locals.isRequestProcessing = true;

  // 等待一段时间后，将标志重置为未处理
  const [error] = await Test.getCookieJson()
  // .then((result) => {
  req.app.locals.isRequestProcessing = false;
  //     req.app.locals.cookieJson = result;
  // });
  // setTimeout(() => {
  //     req.app.locals.isRequestProcessing = false;
  // }, 5000); // 这里的 5000 表示 5 秒钟

  if (error) {
    //返回异常
    // res.status(500).json({ error: error.toString() });
    next(error);
  } else {
    // 继续处理下一个中间件或路由处理函数
    next();
  }
};

// 使用限制请求的中间件
app.use('/GetRegistrationStatus', requestLimitMiddleware);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.get('/GetRegistrationStatus', async (req, res) => {
  logger.info(req.body, "request");
  const result = await Test.GetRegistrationStatus(req.body.data);
  logger.info({ data: result }, "response");
  res.json(result);
});

app.get('/getCookieJson', async (req, res) => {
  const [error, cookies] = await Test.getCookieJson();
  if (error) {
    //返回异常
    res.status(500).json(serializeError(error));
  } else {
    // 返回结果
    res.status(200).json(cookies);
  }
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err['status'] = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
// console.log('app.get(env):', app.get('env'))
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    logger.error(err);
    res.status(err['status'] || 500).json(serializeError(err));
    // res.render('error', {
    //     message: err.message,
    //     error: err
    // });
  });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.set('port', process.env.PORT || 3300);

// const server = app.listen(app.get('port'), function () {
//     logger(`Express server listening on port ${(server.address() as AddressInfo).port}`);
// });

server.listen(app.get('port'), function () {
  // logger(`Express server listening on port ${(server.address() as AddressInfo).port}`);
});

const test = new Test();