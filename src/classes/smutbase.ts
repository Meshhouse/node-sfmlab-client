import SFMLabTemplate from './sfmlab_template';

export default class Smutbase extends SFMLabTemplate {
  constructor(proxies?: string[]) {
    super('https://smutba.se', 'smutbase', proxies);
  }
}
