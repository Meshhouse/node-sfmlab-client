import Open3DLab from './open3dlab';

const proxies = [
  'http://54.36.103.37:3128',
  'http://185.38.111.1:8080',
  'http://109.86.152.78:55443'
];

const singleModelExpect = {
  id: 31653,
  title: 'Clinton Residence',
  author: 'Starbrain',
  thumbnail: 'https://thumb.sfmlab.com/item-preview/clinton_thumb.detail.jpg',
  extension: '.blend',
  mature_content: false,
  created_at: 1624306620000,
  images: [
    'https://thumb.sfmlab.com/item-preview/projectfile/preview_1_tfisJaq_thumb.detail.png',
    'https://thumb.sfmlab.com/item-preview/projectfile/preview_2_BWyP3uQ_thumb.detail.png',
    'https://thumb.sfmlab.com/item-preview/projectfile/preview_3_thumb_Hu88o0S.detail.png',
    'https://thumb.sfmlab.com/item-preview/projectfile/preview_4_thumb_9EhXtHW.detail.png'
  ],
  links: [
    {
      title: 'Clinton_Residence.zip',
      file_size: '50.11 MB'
    }
  ],
  tags: [
    'grand theft auto',
    'house',
    'blender 2.9'
  ],
  file_size: '50.11 MB'
};

const userExpect = {
  id: 66831,
  username: 'meshhouse',
  avatar: 'https://open3dlab.com/static/img/mike.jpg',
  created_at: 1602774300000
};

describe('open3dlab integration - authentication', () => {
  test('expect successful authentication', async() => {
    const instance = new Open3DLab(proxies);

    const userCookies = await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    expect(userCookies).toContain('"version":"tough-cookie@4.0.0"');
  }, 30000);

  test('expect failed authentication on empty credentials', async() => {
    const instance = new Open3DLab(proxies);
    await expect(instance.authenticate({ login: '', password: '' })).rejects.toThrow(Error);
  }, 30000);

  test('expect failed authentication on incorrect credentials', async() => {
    const instance = new Open3DLab(proxies);
    await expect(instance.authenticate({ login: 'test', password: 'qwerty123' })).rejects.toThrow(Error);
  }, 30000);

  test('expect failed validation', async() => {
    const instance = new Open3DLab(proxies);
    await expect(instance.authenticate({ login: 1234, password: [123123] })).rejects.toThrow(Error);
  }, 30000);

  test('expect successful cookie jar replace', async() => {
    const instance = new Open3DLab(proxies);
    const userCookies = (await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    }) as string);
    expect(instance.setCookieJar(userCookies)).toEqual(true);
  }, 30000);

  test('expect failed cookie jar replace', () => {
    const instance = new Open3DLab(proxies);
    expect(() => instance.setCookieJar('')).toThrow('not a json');
  }, 30000);

  test('expect successful user object', async() => {
    const instance = new Open3DLab(proxies);
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const user = await instance.getUser();

    expect(user).toMatchObject(userExpect);
  }, 30000);

  test('expect failed user request on empty cookie jar', async() => {
    const instance = new Open3DLab(proxies);
    await expect(instance.getUser()).rejects.toThrow(Error);
  }, 30000);
});

describe('open3dlab integration - fetch filters', () => {
  test('expect return filters', async() => {
    const instance = new Open3DLab();
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const filters = (await instance.getAvailableFilters() as SFMLabFilters);
    expect(filters.categories).toHaveLength(0);
    expect(filters.characters).toContainEqual({ text: '2b', value: '1236' });
    expect(filters.software).toContainEqual({ text: '3d', value: '17' });
    expect(filters.tags).toContainEqual({ text: 'alien', value: '12' });
    expect(filters.universes).toContainEqual({ text: 'alien', value: '89' });
  }, 30000);

  test('expect return filters, using parser from getModels handler', async() => {
    const instance = new Open3DLab();
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const response = (await instance.getModels({}, true) as SFMLabResponse);
    const filters = (await instance.getAvailableFilters(response.parser) as SFMLabFilters);
    expect(filters.categories).toHaveLength(0);
    expect(filters.characters).toContainEqual({ text: '2b', value: '1236' });
    expect(filters.software).toContainEqual({ text: '3d', value: '17' });
    expect(filters.tags).toContainEqual({ text: 'alien', value: '12' });
    expect(filters.universes).toContainEqual({ text: 'alien', value: '89' });
  }, 30000);
});

describe('open3dlab integration - fetch single model', () => {
  test('expect return model object (test model "Clinton Residence", id 31653)', async() => {
    const instance = new Open3DLab(proxies);
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    const model = (await instance.getSingleModel(31653) as SFMLabModel);
    expect(model).toMatchObject(singleModelExpect);
  }, 30000);

  test('expect return 404', async() => {
    const instance = new Open3DLab(proxies);
    await instance.authenticate({
      login: 'meshhouse',
      password: 'ML0RKjl3Os80n4b49RLi'
    });

    await expect(instance.getSingleModel(0)).rejects.toThrow(Error);
  }, 30000);
});
