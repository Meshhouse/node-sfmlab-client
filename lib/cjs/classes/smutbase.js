"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sfmlab_template_1 = __importDefault(require("./sfmlab_template"));
class Smutbase extends sfmlab_template_1.default {
    constructor(proxies) {
        super('https://smutba.se', 'smutbase', proxies);
    }
}
exports.default = Smutbase;
