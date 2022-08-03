import got, { Response, Got, Options} from 'got';
import cheerio from 'cheerio';
import tough from 'tough-cookie';
import FormData from 'form-data';
import { format, getUnixTime, isValid, parse } from 'date-fns';
import ow from 'ow';
import qs from 'qs';
import hpagent from 'hpagent';

/**
 * SFMLab abstract class, handles all requests under hood
 */
export default abstract class SFMLabTemplate {
  private baseUrl = ''
  private gotInstance: Got
  private siteType: 'sfmlab' | 'smutbase' | 'open3dlab' = 'sfmlab'

  private cookieJar: tough.CookieJar | undefined

  private credentials: SFMLabAuthCredentials | undefined

  private proxies: string[] = []

  /**
   *
   * @param baseUrl root domain name
   */
  constructor(baseUrl: string, type: 'sfmlab' | 'smutbase' | 'open3dlab', proxies?: string[]) {
    this.baseUrl = baseUrl;
    this.siteType = type;

    if (proxies) {
      this.proxies = proxies;
    }

    this.gotInstance = got.extend({
      prefixUrl: this.baseUrl,
      responseType: 'text',
      port: '443',
      protocol: 'https:',
      retry: {
        limit: 10,
        maxRetryAfter: 10000
      }
    });
  }
  /**
   * Authenticate user
   * @param auth user credentials
   * @returns user cookie json (stringified) or error
   */
  public async authenticate(auth: SFMLabAuthCredentials): Promise<string | Error> {
    this.cookieJar = new tough.CookieJar();
    this.credentials = auth;

    try {
      ow(auth.login, ow.string.nonEmpty);
      ow(auth.password, ow.string.nonEmpty);

      if (!auth || !auth.login || !auth.password) {
        throw new Error('credentials not set');
      }

      const rand = this.getRandomProxy();

      const loginPage = await this.gotInstance('accounts/login', {
        retry: {
          limit: 10,
          maxRetryAfter: 10000
        },
        agent: this.proxies.length > 0 && rand !== -1
          ? {
            https: new hpagent.HttpsProxyAgent({
              keepAlive: false,
              proxy: this.proxies[rand]
            })
          }
          : undefined
      });
      const formBody = cheerio.load(loginPage.body);

      const middlewareToken = formBody('form#signup_form input[name="csrfmiddlewaretoken"]').val();

      if (!middlewareToken) {
        throw new Error('sfmlab token not found');
      }

      const loginPageCookies = loginPage.headers['set-cookie'];
      if (!loginPageCookies) {
        throw new Error('set-cookie headers not sent');
      }
      const loginPageParsedCookies = loginPageCookies.map((v) => tough.parse(v)).filter((v) => v !== undefined);
      const csrftoken = loginPageParsedCookies.find((cookie) => cookie !== undefined && cookie.key === 'csrftoken');

      if (!csrftoken) {
        throw new Error('csrftoken not found');
      }

      if (this.cookieJar) {
        this.cookieJar.setCookieSync(csrftoken, this.baseUrl);

        const form = new FormData();
        form.append('login', auth.login);
        form.append('password', auth.password);
        form.append('remember', 'on');

        const authResponse = await this.gotInstance.post('accounts/login/?next=/', {
          headers: {
            'X-CSRFToken': middlewareToken
          },
          body: form,
          followRedirect: false,
          cookieJar: this.cookieJar,
          retry: {
            limit: 10,
            maxRetryAfter: 10000
          },
          agent: this.proxies.length > 0 && rand !== -1
            ? {
              https: new hpagent.HttpsProxyAgent({
                keepAlive: false,
                proxy: this.proxies[rand]
              })
            }
            : undefined
        });

        const authResponseCookies = authResponse.headers['set-cookie'];
        if (!authResponseCookies) {
          throw new Error('set-cookie headers not sent');
        }
        const authResponseParsedCookies = authResponseCookies.map((v) => tough.parse(v)).filter((v) => v !== undefined);

        const session = authResponseParsedCookies.find((cookie) => cookie !== undefined && cookie.key === 'sessionid');
        const messages = authResponseParsedCookies.find((cookie) => cookie !== undefined && cookie.key === 'messages');

        if (!session || !messages) {
          throw new Error('failed authentication');
        }

        this.cookieJar.setCookieSync(session, 'https://sfmlab.com');
        this.cookieJar.setCookieSync(messages, 'https://sfmlab.com');

        return JSON.stringify(this.cookieJar.toJSON());
      } else {
        throw new Error('cookiejar not set');
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /**
   * Fetch user information
   * @returns user object or error
   */
  public async getUser(): Promise<SFMLabUser | Error> {
    if (!this.cookieJar) {
      throw new Error ('no cookies provided');
    }

    try {
      const root = await this.authRequest<string>('', {
        cookieJar: this.cookieJar
      });

      const parser = cheerio.load(root.body);
      const userLink = parser('nav.subnav .nav-list a.nav-list__item span.username').parent('a.nav-list__item')?.attr('href') ?? '';
      if (!userLink.includes('/user/')) {
        throw new Error ('user link not found');
      } else {
        const userRoot = await this.authRequest<string>(userLink.substr(1, userLink.length), {
          cookieJar: this.cookieJar
        });

        const userParser = cheerio.load(userRoot.body);
        const username = userParser('.sidebar h2 span.username')?.attr('title') ?? '';
        let avatar = userParser('.sidebar img.img-responsive')?.attr('src') ?? '';

        if (avatar) {
          avatar = this.baseUrl + avatar;
        }

        let createdAt = userParser('.sidebar dl.dl-horizontal dd:first-of-type').text() ?? '';
        if (createdAt) {
          createdAt = this.parseDate(createdAt.trim());
        }

        const id = userLink.replace('/user/', '').replace('/', '');

        const user = {
          id: Number(id),
          username,
          avatar,
          created_at: Number(createdAt)
        };

        return user;
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /**
   * Fetch models
   * @param page page
   * @returns
   */
  public async getProjectsList(page: number): Promise<any> {
    try {
      const offset = (page - 1) * 24;

      const response = await this.gotInstance('api/projects/list/', {
        searchParams: {
          format: 'json',
          limit: 24,
          offset,
          order_by: '-last_file_date',
          adult_content: 'unknown',
          furry_content: 'unknown'
        },
        responseType: 'json'
      });

      return Promise.resolve(response.body);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /**
 * Fetch models, categories, licenses and total pages count
 * @param query Query object
 * @deprecated use getProjectsList for faster response
 */
  public async getModels(query?: SFMLabQuery | SmutbaseQuery | Open3DLabQuery, withParser?: boolean): Promise<SFMLabResponse | Error> {
    let searchParams;
    if (query) {
      const params = this.generateQueryParams(query);
      searchParams = qs.stringify(params, {
        indices: false
      });
    } else {
      searchParams = undefined;
    }

    try {
      const root = await this.authRequest<string>('', {
        searchParams,
        cookieJar: this.cookieJar
      });

      const parser = cheerio.load(root.body);
      const paginator = parser('.content-container .pagination');

      const models = (await this.parseIndexPage(parser) as SFMLabModel[]);
      const lastPage = this.calculateTotalPages(paginator);

      return {
        models,
        pagination: {
          page: Number(query?.page || 1),
          totalPages: lastPage
        },
        parser: withParser ? parser : undefined
      };
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
  /**
   * Fetch single model by project ID
   * @param query Query object
   */
  public async getSingleModel(id: number): Promise<SFMLabModel | Error> {
    ow(id, ow.number.positive);

    try {
      const placeholder = {
        id: id,
        title: '',
        author: '',
        thumbnail: '',
        extension: '.sfm',
        description: '',
        mature_content: false,
        created_at: 0,
        updated_at: 0,
        images: [],
        links: [],
        tags: [],
        commentaries: [],
        file_size: ''
      };

      const model = await this.parseModelPage(placeholder);
      return model;
    } catch (err) {
      return Promise.reject(err);
    }
  }
  /**
   * Fetch model commentaries
   * @param id model id
   * @returns commentaries
   */
  public async getModelComments(id: number): Promise<Comment[] | Error> {
    ow(id, ow.number.positive);

    return await this.getComments(id);
  }
  /**
   * Fetch available filters
   * @param parser index page cheerio instance
   * @returns available filters or error
   */
  public async getAvailableFilters(parser?: cheerio.Root): Promise<SFMLabFilters | Error> {
    let filters: SFMLabFilters = {
      categories: [],
      tags: [],
      universes: [],
      characters: [],
      software: []
    };

    if (parser) {
      filters = this.parseFilters(parser);
      return filters;
    } else {
      try {
        const root = await this.authRequest<string>('', {
          cookieJar: this.cookieJar
        });

        const parser = cheerio.load(root.body);

        filters = this.parseFilters(parser);
        return filters;
      } catch (err) {
        console.error(err);
        return Promise.reject(err);
      }
    }
  }
  /**
   * Sets cookie jar (for authenticated requests)
   * @param jar serialized cookie jar
   */
  public setCookieJar(jar: string): boolean | Error {
    try {
      JSON.parse(jar);
    } catch (error) {
      throw new Error('not a json');
    }

    try {
      this.cookieJar = tough.CookieJar.deserializeSync(jar);
      return true;
    } catch (error: any) {
      throw new Error(error);
    }
  }
  /**
   * Sets credentials object
   * @param auth user credentials
   */
  public setCredentials(auth: SFMLabAuthCredentials): void {
    this.credentials = auth;
  }
  private parseFilters(parser: cheerio.Root): SFMLabFilters {
    const categories: SelectOption[] = [];
    const software: SelectOption[] = [];
    const tags: SelectOption[] = [];
    const universes: SelectOption[] = [];
    const characters: SelectOption[] = [];

    if (this.siteType === 'sfmlab') {
      const categoryOptions = parser('.search-options__full select[name="category"] option');
      categoryOptions.each((idx: number, element: cheerio.Element) => {
        const el = cheerio(element);
        const value = el.val();
        const text = el.text();
        if (value !== '') {
          categories.push({
            text,
            value
          });
        }
      });
    }

    const tagsOptions = parser('.search-options__full select[name="general_tag"] option');
    tagsOptions.each((idx: number, element: cheerio.Element) => {
      const el = cheerio(element);
      const value = el.val();
      const text = el.text();
      if (value !== '') {
        tags.push({
          text,
          value
        });
      }
    });

    const universesOptions = parser('.search-options__full select[name="property_tag"] option');
    universesOptions.each((idx: number, element: cheerio.Element) => {
      const el = cheerio(element);
      const value = el.val();
      const text = el.text();
      if (value !== '') {
        universes.push({
          text,
          value
        });
      }
    });

    const charactersOptions = parser('.search-options__full select[name="character_tag"] option');
    charactersOptions.each((idx: number, element: cheerio.Element) => {
      const el = cheerio(element);
      const value = el.val();
      const text = el.text();
      if (value !== '') {
        characters.push({
          text,
          value
        });
      }
    });

    if (this.siteType === 'smutbase' || this.siteType === 'open3dlab') {
      const softwareOptions = parser('.search-options__full select[name="software_tag"] option');
      softwareOptions.each((idx: number, element: cheerio.Element) => {
        const el = cheerio(element);
        const value = el.val();
        const text = el.text();
        if (value !== '') {
          software.push({
            text,
            value
          });
        }
      });
    }

    return {
      categories,
      tags,
      universes,
      characters,
      software
    };
  }
  /**
   * Generates GET params object, that can be consumed by origin
   * @param query query object
   * @returns transformed object
   */
  private generateQueryParams<T extends SFMLabQuery | SmutbaseQuery | Open3DLabQuery>(query: T): T extends SFMLabQuery ? SFMLabParams : SmutbaseParams | Open3DLabParams {
    const params: T extends SFMLabQuery ? SFMLabParams : SmutbaseParams | Open3DLabParams = {};

    if (this.isSFMLabQuery(query)) {
      if (query.category && query.category !== -1) {
        params.category = query.category;
      }

      if (query.adultContent) {
        params.adult_content = query.adultContent;
      }

      if (query.furryContent) {
        params.furry_content = query.furryContent;
      }
    } else {
      if (query.software) {
        (params as SmutbaseParams | Open3DLabParams).software_tag = query.software;
      }
    }

    if (query.order) {
      params.order_by = query.order;
    }

    if (query.search && query.search.length > 0) {
      params.search_text = query.search;
    }

    if (query.page) {
      params.page = query.page;
    }

    if (query.tags) {
      params.general_tag = query.tags;
    }

    if (query.universe) {
      params.property_tag = query.universe;
    }

    if (query.character) {
      params.character_tag = query.character;
    }

    return params;
  }
  /**
   * Type guard of SFMLabQuery
   * @param query SFMLabQuery | SmutbaseQuery | Open3DLabQuery
   * @returns type is SFMLabQuery
   */
  private isSFMLabQuery(query: SFMLabQuery | SmutbaseQuery | Open3DLabQuery): query is SFMLabQuery {
    return (query as SFMLabQuery).category !== undefined;
  }
  /**
   * Parses index page
   * @param parser cheerio parser instance
   * @param type site type
   * @returns models
   */
  private async parseIndexPage(parser: cheerio.Root): Promise<SFMLabModel[] | Error> {
    try {
      const body = parser('.content-container .entry-content .entry-list .entry');
      let models: SFMLabModel[] = [];

      body.each((idx: number, element: cheerio.Element) => {
        const body = cheerio.load(element);
        const title = body('.entry__body .entry__title a')?.text() ?? '';
        const link = body('.entry__body .entry__title a')?.attr('href');
        const id = (link?.match(/\d+/) as string[])[0];
        const image = body('.entry__heading a img')?.attr('src') ?? '';

        models.push({
          id: Number(id),
          title,
          author: '',
          thumbnail: image,
          extension: '.sfm',
          description: '',
          mature_content: this.siteType === 'sfmlab' || this.siteType === 'open3dlab' ? false : true,
          created_at: 0,
          updated_at: 0,
          images: [],
          links: [],
          tags: [],
          commentaries: [],
          file_size: ''
        });
      });

      models = await Promise.all(models.map(async(model) => {
        try {
          const response = await this.parseModelPage(model);
          return response as SFMLabModel;
        } catch (error) {
          return model;
        }
      }));

      return models;
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
  /**
   * Parses model page
   * @param model source model object
   * @param type site type
   * @returns updated model object
   */
  private async parseModelPage(model: SFMLabModel): Promise<SFMLabModel | Error> {
    try {
      const root = await this.authRequest<string>(`project/${model.id}`, {
        cookieJar: this.cookieJar
      });

      const parser = cheerio.load(root.body);

      const fileSize = parser('.content-container .main-upload table tbody tr:first-child td:last-child').text();
      const domImages = parser('.content-container .main-upload .text-center a picture.project-detail-image-main img');

      const category = parser('.content-container .side-upload .panel__footer dl:nth-child(5) dd').text();
      const tagsBlock = parser('.taglist .tag a');

      const images: string[] = [];
      const downloadLinks = await this.getDownloadLinks(parser);
      const commentaries = await this.getComments(model.id);

      const tags: string[] = [];

      domImages.each((idx: number, element: cheerio.Element) => {
        images.push((element as any).attribs['src'] ?? '');
      });

      tagsBlock.each((idx: number, element: cheerio.Element) => {
        const title = (element as any).children[0].data.split('(')[0].trim();
        tags.push(title);
      });

      if (domImages.length === 0) {
        const thubmnail = parser('.content-container .side-upload .panel .panel__body img')?.attr('src') ?? '';
        images.push(thubmnail);
      }

      let extension = '.blend';

      if (category.toLowerCase().includes('blender')) {
        extension = '.blend';
      }

      if (category.toLowerCase().includes('3ds max')) {
        extension = '.max';
      }

      if (category.toLowerCase().includes('cinema 4d')) {
        extension = '.c4d';
      }

      if (category.toLowerCase().includes('maya')) {
        extension = '.ma';
      }

      if (category.toLowerCase().includes('fbx')) {
        extension = '.fbx';
      }

      if (category.toLowerCase().includes('xps')) {
        extension = '.xps';
      }

      const updatedModel: SFMLabModel = {
        ...model,
        images,
        extension: this.siteType !== 'sfmlab' ? extension : '.sfm',
        file_size: fileSize,
        links: Array.isArray(downloadLinks) ? downloadLinks : [],
        tags,
        commentaries
      };

      return updatedModel;
    } catch (err) {
      return Promise.reject(err);
    }
  }
  /**
   * Traverse through model download links and fetch direct download links
   * @param parser
   * @returns
   */
  private async getDownloadLinks(parser: cheerio.Root): Promise<ModelLink[] | Error> {
    const linksArray: ModelLink[] = [];

    const linkInfo = parser('.content-container .main-upload table tbody tr td[data-file-id]');
    const links = parser('.content-container .main-upload table tbody tr td[colspan="9"] ul.download-set li.download-container:first-child a');

    try {
      for (let i = 0; i < links.length; i++) {
        const linkRow = cheerio.load(linkInfo[i].parent);
        const link: string = (links.get()[i].attribs['href']).substr(1);
        const downloadPage = await this.authRequest<string>(link, {
          cookieJar: this.cookieJar
        });
        const dom = cheerio.load(downloadPage.body);

        const downloadLink = dom('.content-container .main-upload .project-description-div p:first-child a');

        const title = linkRow('td:first-child strong').text();
        const fileSize = linkRow('td:last-child').text() || '';

        if (downloadLink !== null) {
          linksArray.push({
            url: downloadLink.attr('href') ?? '',
            title,
            file_size: fileSize
          });
        }
      }
      return linksArray;
    } catch (err) {
      console.error(err);
      return new Error(String(err));
    }
  }
  /**
   * Finds last page number
   * @param paginator paginator DOM object
   * @returns last page number
   */
  private calculateTotalPages(paginator: cheerio.Cheerio): number {
    const activeLink: string = paginator.find('li.active a').html() ?? '';
    const lastLink: string = paginator.find('li.last a').attr('href') ?? '';

    return lastLink !== ''
      ? Number(lastLink?.split('page=')[1])
      : Number(activeLink);
  }
  /**
   * Parses Django human-readable string to unix timestamp
   * @param timestamp date string
   * @returns unix timestamp
   */
  private parseDate(timestamp: unknown): string {
    ow(timestamp, ow.string.nonEmpty);

    let ts = timestamp;
    let parsedDate = null;

    if (ts.includes('noon')) {
      ts = ts.replace('noon', '12:00 a.m.');
    }

    if (ts.includes('posted on')) {
      ts = ts.replace('posted on', '').trim();
    }

    // SFMLab is wrecked up timestamps
    parsedDate = parse(ts, 'LLLL d, yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLLL d, yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLL. d, yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLL. d, yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLLL d yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLLL d yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLL. d yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = parse(ts, 'LLL. d yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
    }

    if (!isValid(parsedDate)) {
      parsedDate = new Date(0);
    }

    const date = format(parsedDate, 'T');

    return date;
  }
  /**
   * Find all commentaries for model from custom elements root
   * @param id model id
   */
  private async getComments(id: number): Promise<Comment[]> {
    try {
      const comments: Comment[] = [];

      const response = await this.gotInstance<any>(`comments/api/projectrepo-project/${id}/`, {
        searchParams: {
          format: 'json',
          limit: 1000,
          offset: 0,
          order_by: '-submit_date'
        },
        responseType: 'json'
      });

      response.body.results.map((result: any) => {
        comments.push({
          name: result.user_name,
          avatar: `https://${result.user_avatar}`,
          message: result.comment,
          date: Number(this.parseDate(result.submit_date))
        });
      });

      return comments;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  /**
   * Returns index of user-provided proxy or -1 if no proxy
   * @returns index of user-provided proxy or -1 if no proxy
   */
  private getRandomProxy() {
    if (this.proxies.length > 0) {
      const min = Math.ceil(-1);
      const max = Math.floor(this.proxies.length - 1);

      return Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      return -1;
    }
  }
  /**
   * Authenticate request
   * @param url url
   * @param params Got params
   * @returns Got response
   */
  private async authRequest<T>(url: string, params?: Options): Promise<Response<T>> {
    let siteCookies;
    if (this.cookieJar && this.credentials) {
      siteCookies = await this.cookieJar.getCookies(this.baseUrl);
      const sessionCookie = siteCookies.find((cookie) => cookie.key === 'sessionid');

      if (sessionCookie) {
        const currentDate = getUnixTime(new Date());
        const expiresDate = getUnixTime(new Date(sessionCookie.expires));

        const remainingDays = (expiresDate - currentDate) / 60 / 60 / 24;

        if (remainingDays <= 1) {
          await this.cookieJar.removeAllCookies();
          await this.authenticate(this.credentials);
        }
      }
    }

    const rand = this.getRandomProxy();

    const gotParams: Options = {
      ...params,
      agent: this.proxies.length > 0 && rand !== -1
        ? {
          https: new hpagent.HttpsProxyAgent({
            keepAlive: false,
            proxy: this.proxies[rand]
          })
        }
        : undefined
    };

    console.log(`send request ${rand === -1 ? 'directly' : 'through proxy ' + this.proxies[rand]}`);

    return this.gotInstance(url, gotParams) as Promise<Response<T>>;
  }
}
