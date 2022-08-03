import SFMLabTemplate from './sfmlab_template';
export default class SFMLab extends SFMLabTemplate {
    constructor(proxies) {
        super('https://sfmlab.com', 'sfmlab', proxies);
    }
}
