import { IDeployment } from 'proxy-cloud-pool';
import { Vps } from './api';
export default class VultrDeployment implements IDeployment {
    vps: Vps | null;
    deploy(): Promise<void>;
    address(): string | null;
    healthCheck(): Promise<boolean>;
    destroy(): Promise<void>;
}
