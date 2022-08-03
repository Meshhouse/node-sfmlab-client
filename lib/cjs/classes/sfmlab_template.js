"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const got_1 = __importDefault(require("got"));
const cheerio_1 = __importDefault(require("cheerio"));
const tough_cookie_1 = __importDefault(require("tough-cookie"));
const form_data_1 = __importDefault(require("form-data"));
const date_fns_1 = require("date-fns");
const ow_1 = __importDefault(require("ow"));
const qs_1 = __importDefault(require("qs"));
const hpagent_1 = __importDefault(require("hpagent"));
/**
 * SFMLab abstract class, handles all requests under hood
 */
class SFMLabTemplate {
    /**
     *
     * @param baseUrl root domain name
     */
    constructor(baseUrl, type, proxies) {
        this.baseUrl = '';
        this.siteType = 'sfmlab';
        this.proxies = [];
        this.baseUrl = baseUrl;
        this.siteType = type;
        if (proxies) {
            this.proxies = proxies;
        }
        this.gotInstance = got_1.default.extend({
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
    async authenticate(auth) {
        this.cookieJar = new tough_cookie_1.default.CookieJar();
        this.credentials = auth;
        try {
            ow_1.default(auth.login, ow_1.default.string.nonEmpty);
            ow_1.default(auth.password, ow_1.default.string.nonEmpty);
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
                        https: new hpagent_1.default.HttpsProxyAgent({
                            keepAlive: false,
                            proxy: this.proxies[rand]
                        })
                    }
                    : undefined
            });
            const formBody = cheerio_1.default.load(loginPage.body);
            const middlewareToken = formBody('form#signup_form input[name="csrfmiddlewaretoken"]').val();
            if (!middlewareToken) {
                throw new Error('sfmlab token not found');
            }
            const loginPageCookies = loginPage.headers['set-cookie'];
            if (!loginPageCookies) {
                throw new Error('set-cookie headers not sent');
            }
            const loginPageParsedCookies = loginPageCookies.map((v) => tough_cookie_1.default.parse(v)).filter((v) => v !== undefined);
            const csrftoken = loginPageParsedCookies.find((cookie) => cookie !== undefined && cookie.key === 'csrftoken');
            if (!csrftoken) {
                throw new Error('csrftoken not found');
            }
            if (this.cookieJar) {
                this.cookieJar.setCookieSync(csrftoken, this.baseUrl);
                const form = new form_data_1.default();
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
                            https: new hpagent_1.default.HttpsProxyAgent({
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
                const authResponseParsedCookies = authResponseCookies.map((v) => tough_cookie_1.default.parse(v)).filter((v) => v !== undefined);
                const session = authResponseParsedCookies.find((cookie) => cookie !== undefined && cookie.key === 'sessionid');
                const messages = authResponseParsedCookies.find((cookie) => cookie !== undefined && cookie.key === 'messages');
                if (!session || !messages) {
                    throw new Error('failed authentication');
                }
                this.cookieJar.setCookieSync(session, 'https://sfmlab.com');
                this.cookieJar.setCookieSync(messages, 'https://sfmlab.com');
                return JSON.stringify(this.cookieJar.toJSON());
            }
            else {
                throw new Error('cookiejar not set');
            }
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    /**
     * Fetch user information
     * @returns user object or error
     */
    async getUser() {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!this.cookieJar) {
            throw new Error('no cookies provided');
        }
        try {
            const root = await this.authRequest('', {
                cookieJar: this.cookieJar
            });
            const parser = cheerio_1.default.load(root.body);
            const userLink = (_b = (_a = parser('nav.subnav .nav-list a.nav-list__item span.username').parent('a.nav-list__item')) === null || _a === void 0 ? void 0 : _a.attr('href')) !== null && _b !== void 0 ? _b : '';
            if (!userLink.includes('/user/')) {
                throw new Error('user link not found');
            }
            else {
                const userRoot = await this.authRequest(userLink.substr(1, userLink.length), {
                    cookieJar: this.cookieJar
                });
                const userParser = cheerio_1.default.load(userRoot.body);
                const username = (_d = (_c = userParser('.sidebar h2 span.username')) === null || _c === void 0 ? void 0 : _c.attr('title')) !== null && _d !== void 0 ? _d : '';
                let avatar = (_f = (_e = userParser('.sidebar img.img-responsive')) === null || _e === void 0 ? void 0 : _e.attr('src')) !== null && _f !== void 0 ? _f : '';
                if (avatar) {
                    avatar = this.baseUrl + avatar;
                }
                let createdAt = (_g = userParser('.sidebar dl.dl-horizontal dd:first-of-type').text()) !== null && _g !== void 0 ? _g : '';
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
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    /**
     * Fetch models
     * @param page page
     * @returns
     */
    async getProjectsList(page) {
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
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    /**
   * Fetch models, categories, licenses and total pages count
   * @param query Query object
   * @deprecated use getProjectsList for faster response
   */
    async getModels(query, withParser) {
        let searchParams;
        if (query) {
            const params = this.generateQueryParams(query);
            searchParams = qs_1.default.stringify(params, {
                indices: false
            });
        }
        else {
            searchParams = undefined;
        }
        try {
            const root = await this.authRequest('', {
                searchParams,
                cookieJar: this.cookieJar
            });
            const parser = cheerio_1.default.load(root.body);
            const paginator = parser('.content-container .pagination');
            const models = await this.parseIndexPage(parser);
            const lastPage = this.calculateTotalPages(paginator);
            return {
                models,
                pagination: {
                    page: Number((query === null || query === void 0 ? void 0 : query.page) || 1),
                    totalPages: lastPage
                },
                parser: withParser ? parser : undefined
            };
        }
        catch (err) {
            console.error(err);
            return Promise.reject(err);
        }
    }
    /**
     * Fetch single model by project ID
     * @param query Query object
     */
    async getSingleModel(id) {
        ow_1.default(id, ow_1.default.number.positive);
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
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    /**
     * Fetch model commentaries
     * @param id model id
     * @returns commentaries
     */
    async getModelComments(id) {
        ow_1.default(id, ow_1.default.number.positive);
        return await this.getComments(id);
    }
    /**
     * Fetch available filters
     * @param parser index page cheerio instance
     * @returns available filters or error
     */
    async getAvailableFilters(parser) {
        let filters = {
            categories: [],
            tags: [],
            universes: [],
            characters: [],
            software: []
        };
        if (parser) {
            filters = this.parseFilters(parser);
            return filters;
        }
        else {
            try {
                const root = await this.authRequest('', {
                    cookieJar: this.cookieJar
                });
                const parser = cheerio_1.default.load(root.body);
                filters = this.parseFilters(parser);
                return filters;
            }
            catch (err) {
                console.error(err);
                return Promise.reject(err);
            }
        }
    }
    /**
     * Sets cookie jar (for authenticated requests)
     * @param jar serialized cookie jar
     */
    setCookieJar(jar) {
        try {
            JSON.parse(jar);
        }
        catch (error) {
            throw new Error('not a json');
        }
        try {
            this.cookieJar = tough_cookie_1.default.CookieJar.deserializeSync(jar);
            return true;
        }
        catch (error) {
            throw new Error(error);
        }
    }
    /**
     * Sets credentials object
     * @param auth user credentials
     */
    setCredentials(auth) {
        this.credentials = auth;
    }
    parseFilters(parser) {
        const categories = [];
        const software = [];
        const tags = [];
        const universes = [];
        const characters = [];
        if (this.siteType === 'sfmlab') {
            const categoryOptions = parser('.search-options__full select[name="category"] option');
            categoryOptions.each((idx, element) => {
                const el = cheerio_1.default(element);
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
        tagsOptions.each((idx, element) => {
            const el = cheerio_1.default(element);
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
        universesOptions.each((idx, element) => {
            const el = cheerio_1.default(element);
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
        charactersOptions.each((idx, element) => {
            const el = cheerio_1.default(element);
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
            softwareOptions.each((idx, element) => {
                const el = cheerio_1.default(element);
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
    generateQueryParams(query) {
        const params = {};
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
        }
        else {
            if (query.software) {
                params.software_tag = query.software;
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
    isSFMLabQuery(query) {
        return query.category !== undefined;
    }
    /**
     * Parses index page
     * @param parser cheerio parser instance
     * @param type site type
     * @returns models
     */
    async parseIndexPage(parser) {
        try {
            const body = parser('.content-container .entry-content .entry-list .entry');
            let models = [];
            body.each((idx, element) => {
                var _a, _b, _c, _d, _e;
                const body = cheerio_1.default.load(element);
                const title = (_b = (_a = body('.entry__body .entry__title a')) === null || _a === void 0 ? void 0 : _a.text()) !== null && _b !== void 0 ? _b : '';
                const link = (_c = body('.entry__body .entry__title a')) === null || _c === void 0 ? void 0 : _c.attr('href');
                const id = (link === null || link === void 0 ? void 0 : link.match(/\d+/))[0];
                const image = (_e = (_d = body('.entry__heading a img')) === null || _d === void 0 ? void 0 : _d.attr('src')) !== null && _e !== void 0 ? _e : '';
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
            models = await Promise.all(models.map(async (model) => {
                try {
                    const response = await this.parseModelPage(model);
                    return response;
                }
                catch (error) {
                    return model;
                }
            }));
            return models;
        }
        catch (err) {
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
    async parseModelPage(model) {
        var _a, _b;
        try {
            const root = await this.authRequest(`project/${model.id}`, {
                cookieJar: this.cookieJar
            });
            const parser = cheerio_1.default.load(root.body);
            const fileSize = parser('.content-container .main-upload table tbody tr:first-child td:last-child').text();
            const domImages = parser('.content-container .main-upload .text-center a picture.project-detail-image-main img');
            const category = parser('.content-container .side-upload .panel__footer dl:nth-child(5) dd').text();
            const tagsBlock = parser('.taglist .tag a');
            const images = [];
            const downloadLinks = await this.getDownloadLinks(parser);
            const commentaries = await this.getComments(model.id);
            const tags = [];
            domImages.each((idx, element) => {
                var _a;
                images.push((_a = element.attribs['src']) !== null && _a !== void 0 ? _a : '');
            });
            tagsBlock.each((idx, element) => {
                const title = element.children[0].data.split('(')[0].trim();
                tags.push(title);
            });
            if (domImages.length === 0) {
                const thubmnail = (_b = (_a = parser('.content-container .side-upload .panel .panel__body img')) === null || _a === void 0 ? void 0 : _a.attr('src')) !== null && _b !== void 0 ? _b : '';
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
            const updatedModel = {
                ...model,
                images,
                extension: this.siteType !== 'sfmlab' ? extension : '.sfm',
                file_size: fileSize,
                links: Array.isArray(downloadLinks) ? downloadLinks : [],
                tags,
                commentaries
            };
            return updatedModel;
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    /**
     * Traverse through model download links and fetch direct download links
     * @param parser
     * @returns
     */
    async getDownloadLinks(parser) {
        var _a;
        const linksArray = [];
        const linkInfo = parser('.content-container .main-upload table tbody tr td[data-file-id]');
        const links = parser('.content-container .main-upload table tbody tr td[colspan="9"] ul.download-set li.download-container:first-child a');
        try {
            for (let i = 0; i < links.length; i++) {
                const linkRow = cheerio_1.default.load(linkInfo[i].parent);
                const link = (links.get()[i].attribs['href']).substr(1);
                const downloadPage = await this.authRequest(link, {
                    cookieJar: this.cookieJar
                });
                const dom = cheerio_1.default.load(downloadPage.body);
                const downloadLink = dom('.content-container .main-upload .project-description-div p:first-child a');
                const title = linkRow('td:first-child strong').text();
                const fileSize = linkRow('td:last-child').text() || '';
                if (downloadLink !== null) {
                    linksArray.push({
                        url: (_a = downloadLink.attr('href')) !== null && _a !== void 0 ? _a : '',
                        title,
                        file_size: fileSize
                    });
                }
            }
            return linksArray;
        }
        catch (err) {
            console.error(err);
            return new Error(String(err));
        }
    }
    /**
     * Finds last page number
     * @param paginator paginator DOM object
     * @returns last page number
     */
    calculateTotalPages(paginator) {
        var _a, _b;
        const activeLink = (_a = paginator.find('li.active a').html()) !== null && _a !== void 0 ? _a : '';
        const lastLink = (_b = paginator.find('li.last a').attr('href')) !== null && _b !== void 0 ? _b : '';
        return lastLink !== ''
            ? Number(lastLink === null || lastLink === void 0 ? void 0 : lastLink.split('page=')[1])
            : Number(activeLink);
    }
    /**
     * Parses Django human-readable string to unix timestamp
     * @param timestamp date string
     * @returns unix timestamp
     */
    parseDate(timestamp) {
        ow_1.default(timestamp, ow_1.default.string.nonEmpty);
        let ts = timestamp;
        let parsedDate = null;
        if (ts.includes('noon')) {
            ts = ts.replace('noon', '12:00 a.m.');
        }
        if (ts.includes('posted on')) {
            ts = ts.replace('posted on', '').trim();
        }
        // SFMLab is wrecked up timestamps
        parsedDate = date_fns_1.parse(ts, 'LLLL d, yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLLL d, yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLL. d, yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLL. d, yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLLL d yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLLL d yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLL. d yyyy, h:mm aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = date_fns_1.parse(ts, 'LLL. d yyyy, h aaaa', new Date('February 15, 2021 19:23:00'));
        }
        if (!date_fns_1.isValid(parsedDate)) {
            parsedDate = new Date(0);
        }
        const date = date_fns_1.format(parsedDate, 'T');
        return date;
    }
    /**
     * Find all commentaries for model from custom elements root
     * @param id model id
     */
    async getComments(id) {
        try {
            const comments = [];
            const response = await this.gotInstance(`comments/api/projectrepo-project/${id}/`, {
                searchParams: {
                    format: 'json',
                    limit: 1000,
                    offset: 0,
                    order_by: '-submit_date'
                },
                responseType: 'json'
            });
            response.body.results.map((result) => {
                comments.push({
                    name: result.user_name,
                    avatar: `https://${result.user_avatar}`,
                    message: result.comment,
                    date: Number(this.parseDate(result.submit_date))
                });
            });
            return comments;
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    /**
     * Returns index of user-provided proxy or -1 if no proxy
     * @returns index of user-provided proxy or -1 if no proxy
     */
    getRandomProxy() {
        if (this.proxies.length > 0) {
            const min = Math.ceil(-1);
            const max = Math.floor(this.proxies.length - 1);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        else {
            return -1;
        }
    }
    /**
     * Authenticate request
     * @param url url
     * @param params Got params
     * @returns Got response
     */
    async authRequest(url, params) {
        let siteCookies;
        if (this.cookieJar && this.credentials) {
            siteCookies = await this.cookieJar.getCookies(this.baseUrl);
            const sessionCookie = siteCookies.find((cookie) => cookie.key === 'sessionid');
            if (sessionCookie) {
                const currentDate = date_fns_1.getUnixTime(new Date());
                const expiresDate = date_fns_1.getUnixTime(new Date(sessionCookie.expires));
                const remainingDays = (expiresDate - currentDate) / 60 / 60 / 24;
                if (remainingDays <= 1) {
                    await this.cookieJar.removeAllCookies();
                    await this.authenticate(this.credentials);
                }
            }
        }
        const rand = this.getRandomProxy();
        const gotParams = {
            ...params,
            agent: this.proxies.length > 0 && rand !== -1
                ? {
                    https: new hpagent_1.default.HttpsProxyAgent({
                        keepAlive: false,
                        proxy: this.proxies[rand]
                    })
                }
                : undefined
        };
        console.log(`send request ${rand === -1 ? 'directly' : 'through proxy ' + this.proxies[rand]}`);
        return this.gotInstance(url, gotParams);
    }
}
exports.default = SFMLabTemplate;
