const VultrNode = require('@vultr/vultr-node');
const vultr = VultrNode.initialize({
  apiKey: process.env.VULTR_API_KEY,
});
import {IDeployment} from 'proxy-cloud-pool';
import {promisify} from 'util';
const keygen = promisify(require('ssh-keygen'));
import path from 'path';
import Ssh from 'node-ssh';

const VULTR_DEPLOYMENT_SSHKEY_NAME = 'proxy-pool-deployment-ssh-key';
const VULTR_PROXY_WORKER_VPS_LABEL = 'proxy-pool-worker';
const SSH_KEY_PATH = path.join(__dirname, '/sshkey');

const OSID = 167; // centos 7 x64
const VPSPLANID = 201; // $5 starter
const REGIONID = 34; // SEOUL

export interface VpsIndex {
  SUBID: number;
}
export interface Vps {
  SUBID: number;
  main_ip: string;
}
export interface SshkeyIndex {
  SSHKEYID: string;
}
export interface Sshkey {
  SSHKEYID: string;
  privateKey: string;
}

export async function genSshkey(): Promise<Sshkey> {
  let sshkey: SshkeyIndex = Object.values(await vultr.sshkey.list()).find(
    (key: any) => key.name === VULTR_DEPLOYMENT_SSHKEY_NAME
  ) as SshkeyIndex;
  if (sshkey) {
    console.log('destroy existing ssh key...');
    await vultr.sshkey.delete(sshkey);
  }
  console.log(new Date(), 'gen ssh key..');
  const {key, pubKey} = await keygen({location: SSH_KEY_PATH});
  sshkey = await vultr.sshkey.create({
    name: VULTR_DEPLOYMENT_SSHKEY_NAME,
    ssh_key: pubKey,
  });
  return Object.assign(sshkey, {privateKey: key});
}

async function bootstrap(vps: Vps, sshkey: Sshkey) {
  const ssh = new Ssh();
  await ssh.connect({
    host: vps.main_ip,
    username: 'root',
    privateKey: sshkey.privateKey,
  });
  console.log(new Date(), 'run startup script...');
  await ssh.putDirectory('data', '/var/app', {
    validate: itemPath => path.basename(itemPath) !== 'node_modules',
  });
  await ssh.execCommand('sh startup_script.sh', {cwd: '/var/app'});
  ssh.dispose();
}

async function waitVpsServerReady(index: Required<VpsIndex>): Promise<Vps> {
  let vps = await vultr.server.list(index);
  vps.SUBID = parseInt('' + vps.SUBID);
  while (
    vps.server_state === 'locked' ||
    vps.status === 'pending' ||
    vps.power_status === 'stopped'
  ) {
    await new Promise(r => setTimeout(r, 1000));
    vps = await vultr.server.list(index);
    vps.SUBID = parseInt('' + vps.SUBID);
  }
  return vps;
}

export async function genProxyServer(sshkey: Sshkey): Promise<Vps> {
  console.log(new Date(), 'create worker vps..');
  const vpsIndex = (await vultr.server.create({
    OSID,
    VPSPLANID,
    DCID: REGIONID,
    SSHKEYID: sshkey.SSHKEYID,
    label: VULTR_PROXY_WORKER_VPS_LABEL,
  })) as VpsIndex;
  vpsIndex.SUBID = parseInt('' + vpsIndex.SUBID);
  try {
    const vps = await waitVpsServerReady(vpsIndex);
    vps.SUBID = parseInt('' + vps.SUBID);
    console.log(new Date(), 'ip of worker vps: ', vps.main_ip);
    await new Promise(r => setTimeout(r, 60 * 1000));
    await bootstrap(vps, sshkey);
    return vps;
  } catch (e) {
    await destroyProxyServer(vpsIndex);
    throw e;
  }
}

export async function destroyProxyServer(
  vpsIndex: Required<VpsIndex>
): Promise<void> {
  await vultr.server.delete(vpsIndex);
}
