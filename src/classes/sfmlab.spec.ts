import SFMLab from './sfmlab';

const proxies = [
  'http://54.36.103.37:3128',
  'http://185.38.111.1:8080',
  'http://109.86.152.78:55443'
];

const singleModelExpect = {
  id: 26959,
  title: 'Heroes of the Storm - Tyrande',
  author: 'SFMLab-Import',
  thumbnail: 'https://thumb.sfmlab.com/item-preview/item_preview/111111_uh2hMER.detail.png',
  extension: '.sfm',
  mature_content: true,
  created_at: 1435132740000,
  images: [
    'https://thumb.sfmlab.com/item-preview/item_preview/111111_uh2hMER.detail.png'
  ],
  links: [
    {
      title: 'Tyrande_WO1Z2KA.zip',
      file_size: '3.01 MB'
    }
  ],
  tags: [
    'heroes of the storm',
    'world of warcraft',
    'tyrande whisperwind',
    'character',
    'elf',
    'fantasy',
    'female',
    'warcraft',
    'source'
  ],
  file_size: '3.01 MB'
};

const userExpect = {
  id: 66831,
  username: 'meshhouse',
  avatar: 'https://sfmlab.com/static/img/mike.jpg',
  created_at: 1602774300000
};

describe('sfmlab integration - authentication', () => {
  test('expect successful authentication', async() => {
    const instance = new SFMLab(proxies);

    const userCookies = await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    expect(userCookies).toContain('"version":"tough-cookie@4.0.0"');
  }, 30000);

  test('expect failed authentication on empty credentials', async() => {
    const instance = new SFMLab(proxies);
    await expect(instance.authenticate({ login: '', password: '' })).rejects.toThrow(Error);
  }, 30000);

  test('expect failed authentication on incorrect credentials', async() => {
    const instance = new SFMLab(proxies);
    await expect(instance.authenticate({ login: 'test', password: 'qwerty123' })).rejects.toThrow(Error);
  }, 30000);

  test('expect failed validation', async() => {
    const instance = new SFMLab(proxies);
    await expect(instance.authenticate({ login: 1234, password: [123123] })).rejects.toThrow(Error);
  }, 30000);

  test('expect successful cookie jar replace', async() => {
    const instance = new SFMLab(proxies);
    const userCookies = (await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    }) as string);
    expect(instance.setCookieJar(userCookies)).toEqual(true);
  }, 30000);

  test('expect failed cookie jar replace', () => {
    const instance = new SFMLab(proxies);
    expect(() => instance.setCookieJar('')).toThrow('not a json');
  }, 30000);

  test('expect successful user object', async() => {
    const instance = new SFMLab(proxies);
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const user = await instance.getUser();

    expect(user).toMatchObject(userExpect);
  }, 30000);

  test('expect failed user request on empty cookie jar', async() => {
    const instance = new SFMLab(proxies);
    await expect(instance.getUser()).rejects.toThrow(Error);
  }, 30000);
});

describe('sfmlab integration - fetch filters', () => {
  test('expect return filters', async() => {
    const instance = new SFMLab();
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const filters = (await instance.getAvailableFilters() as SFMLabFilters);
    expect(filters.categories).toContainEqual({ text: 'Maps', value: '15' });
    expect(filters.characters).toContainEqual({ text: '2b', value: '1236' });
    expect(filters.software).toHaveLength(0);
    expect(filters.tags).toContainEqual({ text: 'alien', value: '12' });
    expect(filters.universes).toContainEqual({ text: 'alien', value: '89' });
  }, 30000);

  test('expect return filters, using parser from getModels handler', async() => {
    const instance = new SFMLab();
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const response = (await instance.getModels({}, true) as SFMLabResponse);
    const filters = (await instance.getAvailableFilters(response.parser) as SFMLabFilters);
    expect(filters.categories).toContainEqual({ text: 'Maps', value: '15' });
    expect(filters.characters).toContainEqual({ text: '2b', value: '1236' });
    expect(filters.software).toHaveLength(0);
    expect(filters.tags).toContainEqual({ text: 'alien', value: '12' });
    expect(filters.universes).toContainEqual({ text: 'alien', value: '89' });
  }, 30000);
});

describe('sfmlab integration - fetch single model', () => {
  test('expect return model object (test model "Heroes of the Storm - Tyrande", id 26959)', async() => {
    const instance = new SFMLab(proxies);
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const model = (await instance.getSingleModel(26959) as SFMLabModel);
    expect(model).toMatchObject(singleModelExpect);
  }, 30000);

  test('expect return 404', async() => {
    const instance = new SFMLab(proxies);
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    await expect(instance.getSingleModel(0)).rejects.toThrow(Error);
  }, 30000);
});
