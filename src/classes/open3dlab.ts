import SFMLabTemplate from './sfmlab_template';

export default class Open3DLab extends SFMLabTemplate {
  constructor(proxies?: string[]) {
    super('https://open3dlab.com', 'open3dlab', proxies);
  }
}
