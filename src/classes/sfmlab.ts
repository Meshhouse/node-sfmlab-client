import SFMLabTemplate from './sfmlab_template';

export default class SFMLab extends SFMLabTemplate {
  constructor(proxies?: string[]) {
    super('https://sfmlab.com', 'sfmlab', proxies);
  }
}
