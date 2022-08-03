"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sfmlab_template_1 = __importDefault(require("./sfmlab_template"));
class Open3DLab extends sfmlab_template_1.default {
    constructor(proxies) {
        super('https://open3dlab.com', 'open3dlab', proxies);
    }
}
exports.default = Open3DLab;
