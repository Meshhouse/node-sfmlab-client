# node-sfmlab-client
Unofficial SFMLab-based sites client, written on Typescript, decoupled from sfmlab-unofficial-api.

# Requirements
It's intended to use with Node.js, not tested with browser environment.

# Installation
```bash
npm install github:Meshhouse/node-sfmlab-client
```

# Usage
Supported sites:
* https://sfmlab.com (SFMLab class)
* https://smutba.se (Smutbase class)
* https://open3dlab.com (Open3DLab class)

## Creating new instance
```js
import { SFMLab, Smutbase, Open3DLab } from 'node-sfmlab-client';


const sfmlabInstance = new SFMLab();
const smutbaseInstance = new Smutbase();
const open3dlabInstance = new Open3DLab(['http://localhost:8080']); // Tells current instance to use proxy servers
```

## Authenticate user
Even if accounts is same across those sites, cookies is domain-locked
```js
const credentials = {
  login: '<your_login>',
  password: '<your_password>'
};

const usercookies = await sfmlabInstance.authenticate(credentials);
// Returns serialized cookies (can be used for future authentication, without request to origin)
```

## Re-authenticate user (using previously saved cookies)
```js
const usercookies = '<serialized_cookies>'

sfmlabInstance.setCookieJar(usercookies);
```

## Get user info
Assumed, that you already authenticated

```js
const user = await sfmlabInstance.getUser();

{
  id: 0,
  username: 'test',
  avatar: 'user_avatar,
  created_at: 0
}
```

## Fetch index page
```js
const response = await sfmlabInstance.getModels();

{
  models: ['see example below'],
  pagination: {
    page: 1,
    totalPages: 100
  }
}
```

Available params (SFMLab):
```ts
type SFMLabQuery = {
  category?: number;
  order?: 'created' | '-created' | 'published_date' | '-published_date' | 'last_file_date' | '-last_file_date' | 'views' | '-views' | 'popularity' | '-popularity';
  search?: string;
  page?: number;
  adultContent?: boolean;
  furryContent?: boolean;
  tags?: number[];
  universe?: number[];
  character?: number[];
}
```

Available params (Smutbase, Open3DLab):
```ts
type SmutbaseQuery = {
  order?: 'created' | '-created' | 'published_date' | '-published_date' | 'last_file_date' | '-last_file_date' | 'views' | '-views' | 'popularity' | '-popularity';
  search?: string;
  page?: number;
  tags?: number[];
  universe?: number[];
  character?: number[];
  software?: number[];
}
```

## Fetch single model
Some models can be hidden from unauthenticated users, in that case method returns HTTP 404 error

```js
const model = await sfmlabInstance.getSingleModel(26959);

{
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
      url: 'file_url',
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
  commentaries: []
  file_size: '3.01 MB'
}

```

## Fetch model commentaries
In case you want to fetch comments only
```js
const commentaries = await sfmlabInstance.getModelComments(26959);

[
  {
    name: 'username',
    avatar: 'avatar_url',
    message: 'sanitized_message',
    date: 0,
  }
]
```

## Fetch filters
```js
const filters = await sfmlabInstance.getAvailableFilters();
// Or reuse parser from getModels handler
const response = await sfmlabInstance.getModels({}, true);
const filters = await sfmlabInstance.getAvailableFilters(response.parser);

{
  categories: [
    { text: 'text', value: '0' }
  ],
  characters: [
    { text: 'text', value: '0' }
  ],
  software: [
    { text: 'text', value: '0' }
  ],
  tags: [
    { text: 'text', value: '0' }
  ],
  universes: [
    { text: 'text', value: '0' }
  ]
}
```

# Proxy support
You can use proxy/proxies to bypass HTTP 429 error. Proxy support handled by [hpagent](https://github.com/delvedor/hpagent) package. To use proxy, you need to pass in class constructor array of proxy addresses:
```js
const proxies = [
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082'
];

const instance = new SFMLab(proxies);
```
Proxy address selected by Math.random, sometimes request will be sended without proxy (also for bypass HTTP 429 error)
