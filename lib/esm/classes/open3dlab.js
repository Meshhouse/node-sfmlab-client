import SFMLabTemplate from './sfmlab_template';
export default class Open3DLab extends SFMLabTemplate {
    constructor(proxies) {
        super('https://open3dlab.com', 'open3dlab', proxies);
    }
}
