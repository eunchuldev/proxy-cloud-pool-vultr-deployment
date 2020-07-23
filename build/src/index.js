"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./api");
const axios_1 = __importDefault(require("axios"));
const PROXY_PORT = 3128;
let GlobalSshkey;
let genSshkeyPromise;
class VultrDeployment {
    constructor() {
        this.vps = null;
    }
    async deploy() {
        if (genSshkeyPromise === undefined) {
            genSshkeyPromise = api_1.genSshkey();
            GlobalSshkey = await genSshkeyPromise;
        }
        else if (GlobalSshkey === undefined) {
            GlobalSshkey = await genSshkeyPromise;
        }
        for (let i = 0, retry = 1;; ++i) {
            try {
                const vps = await api_1.genProxyServer(GlobalSshkey);
                this.vps = vps;
                break;
            }
            catch (e) {
                if (i >= retry - 1)
                    throw e;
                console.log('Fail to deploy:', e);
                await new Promise(r => setTimeout(r, 60000));
            }
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    address() {
        if (this.vps)
            return `http://${this.vps.main_ip}:${PROXY_PORT}`;
        else
            return null;
    }
    async healthCheck() {
        if (this.vps === null)
            return false;
        const addr = this.address();
        if (addr === null)
            return false;
        try {
            await axios_1.default.get(addr);
            return true;
        }
        catch (e) {
            if (e.response.status === 400)
                return true;
            else
                return false;
        }
    }
    async destroy() {
        for (let i = 0, retry = 1;; ++i) {
            try {
                if (this.vps)
                    await api_1.destroyProxyServer(this.vps);
                break;
            }
            catch (e) {
                if (i >= retry - 1)
                    throw e;
                console.log(e);
                await new Promise(r => setTimeout(r, 60000));
            }
        }
        await new Promise(r => setTimeout(r, 3000));
    }
}
exports.default = VultrDeployment;
//# sourceMappingURL=index.js.map