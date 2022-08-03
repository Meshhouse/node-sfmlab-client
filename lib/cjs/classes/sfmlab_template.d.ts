/// <reference types="cheerio" />
/**
 * SFMLab abstract class, handles all requests under hood
 */
export default abstract class SFMLabTemplate {
    private baseUrl;
    private gotInstance;
    private siteType;
    private cookieJar;
    private credentials;
    private proxies;
    /**
     *
     * @param baseUrl root domain name
     */
    constructor(baseUrl: string, type: 'sfmlab' | 'smutbase' | 'open3dlab', proxies?: string[]);
    /**
     * Authenticate user
     * @param auth user credentials
     * @returns user cookie json (stringified) or error
     */
    authenticate(auth: SFMLabAuthCredentials): Promise<string | Error>;
    /**
     * Fetch user information
     * @returns user object or error
     */
    getUser(): Promise<SFMLabUser | Error>;
    /**
     * Fetch models
     * @param page page
     * @returns
     */
    getProjectsList(page: number): Promise<any>;
    /**
   * Fetch models, categories, licenses and total pages count
   * @param query Query object
   * @deprecated use getProjectsList for faster response
   */
    getModels(query?: SFMLabQuery | SmutbaseQuery | Open3DLabQuery, withParser?: boolean): Promise<SFMLabResponse | Error>;
    /**
     * Fetch single model by project ID
     * @param query Query object
     */
    getSingleModel(id: number): Promise<SFMLabModel | Error>;
    /**
     * Fetch model commentaries
     * @param id model id
     * @returns commentaries
     */
    getModelComments(id: number): Promise<Comment[] | Error>;
    /**
     * Fetch available filters
     * @param parser index page cheerio instance
     * @returns available filters or error
     */
    getAvailableFilters(parser?: cheerio.Root): Promise<SFMLabFilters | Error>;
    /**
     * Sets cookie jar (for authenticated requests)
     * @param jar serialized cookie jar
     */
    setCookieJar(jar: string): boolean | Error;
    /**
     * Sets credentials object
     * @param auth user credentials
     */
    setCredentials(auth: SFMLabAuthCredentials): void;
    private parseFilters;
    /**
     * Generates GET params object, that can be consumed by origin
     * @param query query object
     * @returns transformed object
     */
    private generateQueryParams;
    /**
     * Type guard of SFMLabQuery
     * @param query SFMLabQuery | SmutbaseQuery | Open3DLabQuery
     * @returns type is SFMLabQuery
     */
    private isSFMLabQuery;
    /**
     * Parses index page
     * @param parser cheerio parser instance
     * @param type site type
     * @returns models
     */
    private parseIndexPage;
    /**
     * Parses model page
     * @param model source model object
     * @param type site type
     * @returns updated model object
     */
    private parseModelPage;
    /**
     * Traverse through model download links and fetch direct download links
     * @param parser
     * @returns
     */
    private getDownloadLinks;
    /**
     * Finds last page number
     * @param paginator paginator DOM object
     * @returns last page number
     */
    private calculateTotalPages;
    /**
     * Parses Django human-readable string to unix timestamp
     * @param timestamp date string
     * @returns unix timestamp
     */
    private parseDate;
    /**
     * Find all commentaries for model from custom elements root
     * @param id model id
     */
    private getComments;
    /**
     * Returns index of user-provided proxy or -1 if no proxy
     * @returns index of user-provided proxy or -1 if no proxy
     */
    private getRandomProxy;
    /**
     * Authenticate request
     * @param url url
     * @param params Got params
     * @returns Got response
     */
    private authRequest;
}
