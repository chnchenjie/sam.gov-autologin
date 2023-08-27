import boxen from 'boxen';
import figlet from "figlet";
// import standard from "figlet/importable-fonts/Standard.js";
import { serializeError } from 'serialize-error';
import { logger, clients, send } from "./logger.js";

type ErrorWithMessage = {
  message: string
}

export default class Utl {
  public static printBox(print: boolean = true): [string, string] {
    // figlet.parseFont("Standard", standard);
    // var figlet = require("figlet");
    // console.log(figlet.fontsSync());
    // figlet("Hello World!!", function (err, data) {
    //   if (err) {
    //     console.log("Something went wrong...");
    //     console.dir(err);
    //     return;
    //   }
    //   console.log(data);
    // });

    //打印方框，其中显示的内容可以自定义
    // printBox(//'Hello World!');
    // ${chromium.executablePath()}

    let text = `环境变量：
executablePath: ${process.env.executablePath}
HTTP_PROXY: ${process.env.HTTP_PROXY}
PORT: ${process.env.PORT}

当前时间：
${new Date().toLocaleString()}`;
    text = boxen(text, { title: 'debugger', titleAlignment: 'center', borderColor: 'greenBright', padding: 1, width: 85 });

    const data = figlet.textSync(
      process.env.FIGLETTEXT || 'Hello World!!',
    );
    if (print) {
      console.log(data);
      console.log(text);
    }
    return [data, text];
  }

  private static isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as Record<string, unknown>).message === 'string'
    )
  }

  private static toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
    if (this.isErrorWithMessage(maybeError)) return maybeError

    try {
      return new Error(JSON.stringify(maybeError))
    } catch {
      // fallback in case there's an error stringifying the maybeError
      // like with circular references for example.
      return new Error(String(maybeError))
    }
  }

  public static getErrorMessage(error: unknown): string {
    // console.error('error:', Utl.toErrorWithMessage(error));
    // return JSON.stringify(Utl.toErrorWithMessage(error));
    return this.toErrorWithMessage(error).message
  }

  public static getErrorString(error: unknown): string {
    return JSON.stringify(serializeError(error));
  }
}