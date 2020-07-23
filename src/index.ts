import {IDeployment} from 'proxy-cloud-pool';
import {
  genProxyServer,
  destroyProxyServer,
  genSshkey,
  Sshkey,
  Vps,
} from './api';
import axios from 'axios';

const PROXY_PORT = 3128;

let GlobalSshkey: Sshkey;
let genSshkeyPromise: Promise<Sshkey>;
export default class VultrDeployment implements IDeployment {
  vps: Vps | null = null;
  async deploy() {
    if (genSshkeyPromise === undefined) {
      genSshkeyPromise = genSshkey();
      GlobalSshkey = await genSshkeyPromise;
    } else if (GlobalSshkey === undefined) {
      GlobalSshkey = await genSshkeyPromise;
    }
    for (let i = 0, retry = 1; ; ++i) {
      try {
        const vps: Vps = await genProxyServer(GlobalSshkey);
        this.vps = vps;
        break;
      } catch (e) {
        if (i >= retry - 1) throw e;
        console.log('Fail to deploy:', e);
        await new Promise(r => setTimeout(r, 60000));
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  address(): string | null {
    if (this.vps) return `http://${this.vps.main_ip}:${PROXY_PORT}`;
    else return null;
  }
  async healthCheck() {
    if (this.vps === null) return false;
    const addr = this.address();
    if (addr === null) return false;
    try {
      await axios.get(addr);
      return true;
    } catch (e) {
      if (e.response.status === 400) return true;
      else return false;
    }
  }
  async destroy() {
    for (let i = 0, retry = 1; ; ++i) {
      try {
        if (this.vps) await destroyProxyServer(this.vps);
        break;
      } catch (e) {
        if (i >= retry - 1) throw e;
        console.log(e);
        await new Promise(r => setTimeout(r, 60000));
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}
