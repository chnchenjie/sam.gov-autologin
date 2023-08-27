import { chromium, Browser, BrowserContext, Page, Cookie, LaunchOptions } from '@playwright/test';
// import { debounce } from 'throttle-debounce';
import * as twofactor from 'node-2fa';
import * as fs from 'fs';
import os from 'os';
import axios, { AxiosRequestConfig, AxiosProxyConfig, AxiosResponse } from 'axios';
import { HttpsProxyAgent } from 'hpagent';
// import * as https from 'https';
// import fetch from 'node-fetch';
import { Root, CompanyListForEntityInformation } from './types';
import { logger } from "./logger.js";
import Utl from './utl.js'

export default class Test {
  private static readonly statePath = 'state.json';
  private static readonly cookiePath = 'cookie.json';
  private static cookies: Cookie[] = [];

  //刷新定时器
  private static reloadInterval: NodeJS.Timeout | any;
  //停止刷新定时器
  private static stopReloadTimeout: NodeJS.Timeout | any;
  //最后访问时间
  private static lastAccessTime: Date;

  private static browser: Browser;
  private static context: BrowserContext;
  private static page: Page;

  constructor() {
    Utl.printBox();
    Test.Init();
  }

  public static async GetRegistrationStatus(companyList: CompanyListForEntityInformation[]): Promise<CompanyListForEntityInformation[]> {
    logger.info('GetRegistrationStatus');
    //set cookies
    axios.defaults.headers.Cookie = Test.cookies.map((cookie: Cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    //set referer
    axios.defaults.headers.Referer = Test.page.url();

    const promises: Promise<CompanyListForEntityInformation>[] = [];
    companyList.forEach((item) => {
      promises.push(Test.callApiWithCookieAndQuery(item));
    });

    const result: CompanyListForEntityInformation[] = await Promise.all(promises);
    return result.map((item) => {
      return {
        CompanyID: item.CompanyID,
        RegistrationStatus: item.RegistrationStatus,
        Error: item.Error,
      } as CompanyListForEntityInformation;
    });
  }

  private static async callApiWithCookieAndQuery(company: CompanyListForEntityInformation): Promise<CompanyListForEntityInformation> {
    logger.info('callApiWithCookieAndQuery');
    const timestamp: number = Date.now();
    const encodedSearchQuery: string = encodeURIComponent(company.CompanyName); // 对搜索查询进行 URL 编码
    const apiUrl: string = `https://sam.gov/api/prod/sgs/v1/search/?random=${timestamp}&index=ent&page=0&sort=-relevance&size=25&mode=search&q="${encodedSearchQuery}"&qMode=EXACT&domain=search_entity`;

    // const config: AxiosRequestConfig = {
    //   headers: {
    //     'User-Agent': process.env.USERAGENT,
    //   },
    // };
    // // 设置代理
    // if (process.env.HTTP_PROXY) {
    //   const regex: RegExp = /^(http|https):\/\/([\d.]+):(\d+)/;
    //   const matches: RegExpMatchArray | null = process.env.HTTP_PROXY.match(regex);

    //   if (matches && matches.length === 4) {
    //     const proxyConfig: AxiosProxyConfig = {
    //       protocol: matches[1],
    //       host: matches[2],
    //       port: Number(matches[3]),
    //     };

    //     console.log(proxyConfig);
    //     config.proxy = proxyConfig;
    //   }
    // }

    try {
      // throw new Error('报错了！');
      const response = await axios.get<Root>(apiUrl);

      const statusCode: number = response.status;
      let root: Root | null = null;
      let registrationStatus: string | null = null;

      if (statusCode === 200) {
        root = response.data;

        // 在这里使用 data 对象进行进一步操作
        if (root?._embedded?.results?.length > 0) {
          registrationStatus = root._embedded.results[0].registrationStatus;
          if ("Active" == registrationStatus || "Inactive" == registrationStatus) {
            registrationStatus += ' Registration';
          }
          logger.info({ data: `${company.RegistrationStatus} => ${registrationStatus}` }, 'API response received successfully.');
          company.RegistrationStatus = registrationStatus;
          company.Error = null;
        }
      } else {
        logger.warn({ data: company }, 'API request failed with status code: ' + response.status);
        throw new Error('API request failed with status code: ' + response.status);
      }

    } catch (error) {
      company.Error = Utl.getErrorString(error);
      logger.error({ data: company, error: error }, 'An error occurred: ' + error.message);
    }
    return company;
  }

  public static async getCookieJson(): Promise<[error: any, cookies: Cookie[]]> {
    logger.info('getCookieJson');
    logger.info('最后访问时间', Test.lastAccessTime?.toLocaleString());

    try {
      //当前时间-最后访问时间>30秒，刷新页面
      // if (new Date().getTime() - Test.lastAccessTime.getTime() > 30000) {
      //   await Test.page.reload();
      //   Test.lastAccessTime = new Date();
      // }

      //检查登录状态
      if (Test.stopReloadTimeout?._destroyed) {
        //刷新
        await Test.page.reload();
      }
      if (await Test.page.locator('#signIn').count()) {
        //登录
        await Test.SignIn();
      }

      //保持登录状态
      // debounce(1000 * 10, Test.StaySignIn)();
      Test.StaySignIn();

      Test.cookies = await Test.getCookies();
      return [null, Test.cookies];
    } catch (error) {
      logger.error(error, 'getCookieJson');
      return [error, null];
    }
  }

  //初始化
  public static async Init(): Promise<void> {
    logger.info('init');
    // Test.playwright = require('playwright');

    //启动浏览器
    await Test.Launch();

    //storageState
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: 'https://sam.gov',
          localStorage: [
            {
              name: 'mfeWelcome',
              value: 'mfeWelcome'
            },
            {
              name: 'ng2Idle.main.idling',
              value: 'false'
            }
          ]
        }
      ]
    };

    //设置storageState，避免每次都要弹窗
    Test.context = await Test.browser.newContext({
      storageState: storageState,
      viewport: { width: 1920, height: 1080 },
      userAgent: process.env.USERAGENT
    });

    //添加cookie
    Test.context.addCookies(await Test.readCookies());

    //新建页面
    Test.page = await Test.context.newPage();
    await Test.page.goto(process.env.URL, { waitUntil: 'networkidle' });
    Test.lastAccessTime = new Date();

    //配置axios
    axios.defaults.proxy = false;
    axios.defaults.timeout = 1000 * 30;
    axios.defaults.headers.common['Referer'] = process.env.URL;
    axios.defaults.headers.common['User-Agent'] = process.env.USERAGENT;
    if (process.env.HTTP_PROXY !== undefined && process.env.HTTP_PROXY !== '') {
      axios.defaults.httpsAgent = new HttpsProxyAgent({ proxy: process.env.HTTP_PROXY });
    }
    logger.info('init finished');
  }

  //启动浏览器
  private static async Launch(): Promise<void> {
    logger.info('launch');
    if (process.env.WS_ENDPOINT === undefined || process.env.WS_ENDPOINT === '') {
      const options = {
        headless: true,
        args: ['--start-fullscreen']
      } as LaunchOptions;

      if (process.env.executablePath !== undefined && process.env.executablePath !== '') {
        options.executablePath = process.env.executablePath;
      }
      if (process.env.HTTP_PROXY !== undefined && process.env.HTTP_PROXY !== '') {
        options.proxy = { server: process.env.HTTP_PROXY };
      }

      Test.browser = await chromium.launch(options);
    } else {
      Test.browser = await chromium.connect(process.env.WS_ENDPOINT);
    }
    // Test.context = await Test.browser.newContext();
    // const page = await Test.context.newPage();
    // await page.goto('https://www.google.com');
    // await page.screenshot({ path: `example.png` });
    // await Test.browser.close();
    // return browser;
  }

  //登录
  private static async SignIn(retryCount = 0): Promise<void> {
    logger.info('signIn');
    try {
      const page = Test.context.pages()[0];
      await page.goto(process.env.URL, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'Sign In' }).click();
      await page.getByRole('button', { name: 'Accept' }).click();
      await page.getByLabel('Email address').fill(process.env.EMAILADDRESS);
      await page.getByLabel('Password', { exact: true }).fill(process.env.PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();

      //获取秒数
      let second = new Date().getSeconds();
      if (second > 30) {
        second -= 30;
      }
      if (30 - second < 5) {
        //等待5秒
        await page.waitForTimeout(1000 * 5);
      }

      //获取二次验证
      let { token } = twofactor.generateToken(process.env.TFA_SECRET);
      logger.info(token);

      await page.getByLabel('One-time code').fill(token);
      await page.getByLabel('One-time code').press('Enter');
      await page.waitForURL(url => url.href.indexOf(process.env.URL) > -1);

      //保存cookies
      Test.saveCookies();
      Test.lastAccessTime = new Date();
    } catch (error) {
      logger.error(error);
      //重试3次
      if (retryCount < 3) {
        retryCount++;
        await Test.page.waitForTimeout(1000 * 10 * retryCount);
        await Test.SignIn(retryCount);
      } else {
        throw error;
      }
    }
  }

  private static StaySignIn() {
    logger.info('staySignIn');
    // throw new Error('Method not implemented.');

    //清除定时器
    Test.reloadInterval && clearInterval(Test.reloadInterval);
    Test.stopReloadTimeout && clearTimeout(Test.stopReloadTimeout);

    //3分钟刷新一次页面
    Test.reloadInterval = setInterval(async () => {
      logger.info('reload');
      // await Test.page.reload();
      const menus = await Test.page.locator('a.usa-nav__link.ng-star-inserted').all();
      // const hrefs = await Promise.all(menus.map(async menu => menu.getAttribute('href')));
      // logger.info(hrefs);
      //菜单数量
      const menusCount = menus.length;
      //随机点击一个菜单
      await menus[Math.floor(Math.random() * menusCount)].click();
      // await menus.nth(Math.floor(Math.random() * await menus.count())).click();
      //打印url
      logger.info(await Test.page.url());
      Test.lastAccessTime = new Date();
    }, 1000 * 60 * 3);

    //10分钟后停止刷新
    Test.stopReloadTimeout = setTimeout(() => {
      logger.info('stopReload');
      clearInterval(Test.reloadInterval);
    }, 1000 * 60 * 10);
  }

  //获取context.cookies
  private static async getCookies(): Promise<Cookie[]> {
    logger.info('getCookies');
    return (await Test.context?.cookies()) || [];
  }

  //保存cookies
  private static async saveCookies(): Promise<void> {
    logger.info('saveCookies');
    const state = await Test.context.storageState({ path: Test.statePath });
    const cookies = state.cookies;
    fs.writeFileSync(Test.cookiePath, JSON.stringify(cookies));
  }

  //读取cookies
  private static async readCookies(): Promise<Cookie[]> {
    logger.info('readCookies');
    if (fs.existsSync(Test.cookiePath)) {
      const cookiesStr = fs.readFileSync(Test.cookiePath, 'utf8');
      return JSON.parse(cookiesStr);
    } else {
      return [];
    }
  }
}

(async () => {
  // await Test.getCookieJson();

  // chromium.launch({ headless: false,executablePath:process.env.executablePath }).then(async browser => {
  //   Test.context = await browser.newContext();
  //   const page = await Test.context.newPage();
  //   await page.goto('https://www.google.com');
  //   await page.screenshot({ path: `example.png` });
  //   await browser.close();
  // });
})();