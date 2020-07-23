"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.destroyProxyServer = exports.genProxyServer = exports.genSshkey = void 0;
const VultrNode = require('@vultr/vultr-node');
const vultr = VultrNode.initialize({
    apiKey: process.env.VULTR_API_KEY,
});
const util_1 = require("util");
const keygen = util_1.promisify(require('ssh-keygen'));
const path_1 = __importDefault(require("path"));
const node_ssh_1 = __importDefault(require("node-ssh"));
const VULTR_DEPLOYMENT_SSHKEY_NAME = 'proxy-pool-deployment-ssh-key';
const VULTR_PROXY_WORKER_VPS_LABEL = 'proxy-pool-worker';
const SSH_KEY_PATH = path_1.default.join(__dirname, '/sshkey');
const OSID = 167; // centos 7 x64
const VPSPLANID = 201; // $5 starter
const REGIONID = 34; // SEOUL
async function genSshkey() {
    let sshkey = Object.values(await vultr.sshkey.list()).find((key) => key.name === VULTR_DEPLOYMENT_SSHKEY_NAME);
    if (sshkey) {
        console.log('destroy existing ssh key...');
        await vultr.sshkey.delete(sshkey);
    }
    console.log(new Date(), 'gen ssh key..');
    const { key, pubKey } = await keygen({ location: SSH_KEY_PATH });
    sshkey = await vultr.sshkey.create({
        name: VULTR_DEPLOYMENT_SSHKEY_NAME,
        ssh_key: pubKey,
    });
    return Object.assign(sshkey, { privateKey: key });
}
exports.genSshkey = genSshkey;
async function bootstrap(vps, sshkey) {
    const ssh = new node_ssh_1.default();
    await ssh.connect({
        host: vps.main_ip,
        username: 'root',
        privateKey: sshkey.privateKey,
    });
    console.log(new Date(), 'run startup script...');
    await ssh.putDirectory('data', '/var/app', {
        validate: itemPath => path_1.default.basename(itemPath) !== 'node_modules',
    });
    await ssh.execCommand('sh startup_script.sh', { cwd: '/var/app' });
    ssh.dispose();
}
async function waitVpsServerReady(index) {
    let vps = await vultr.server.list(index);
    vps.SUBID = parseInt('' + vps.SUBID);
    while (vps.server_state === 'locked' ||
        vps.status === 'pending' ||
        vps.power_status === 'stopped') {
        await new Promise(r => setTimeout(r, 1000));
        vps = await vultr.server.list(index);
        vps.SUBID = parseInt('' + vps.SUBID);
    }
    return vps;
}
async function genProxyServer(sshkey) {
    console.log(new Date(), 'create worker vps..');
    const vpsIndex = (await vultr.server.create({
        OSID,
        VPSPLANID,
        DCID: REGIONID,
        SSHKEYID: sshkey.SSHKEYID,
        label: VULTR_PROXY_WORKER_VPS_LABEL,
    }));
    vpsIndex.SUBID = parseInt('' + vpsIndex.SUBID);
    try {
        const vps = await waitVpsServerReady(vpsIndex);
        vps.SUBID = parseInt('' + vps.SUBID);
        console.log(new Date(), 'ip of worker vps: ', vps.main_ip);
        await new Promise(r => setTimeout(r, 60 * 1000));
        await bootstrap(vps, sshkey);
        return vps;
    }
    catch (e) {
        await destroyProxyServer(vpsIndex);
        throw e;
    }
}
exports.genProxyServer = genProxyServer;
async function destroyProxyServer(vpsIndex) {
    await vultr.server.delete(vpsIndex);
}
exports.destroyProxyServer = destroyProxyServer;
//# sourceMappingURL=api.js.map