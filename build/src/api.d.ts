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
export declare function genSshkey(): Promise<Sshkey>;
export declare function genProxyServer(sshkey: Sshkey): Promise<Vps>;
export declare function destroyProxyServer(vpsIndex: Required<VpsIndex>): Promise<void>;
