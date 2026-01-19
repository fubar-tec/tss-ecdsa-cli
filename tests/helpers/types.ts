export type Algorithm = "ecdsa" | "eddsa";

export interface EcdsaKeyFile {
  party_keys: {
    u_i: string;
    y_i: {
      x: string;
      y: string;
    };
    party_index: number;
  };
  shared_keys: {
    y: {
      x: string;
      y: string;
    };
  };
  chain_code: string;
  vss_scheme: {
    parameters: {
      threshold: number;
      share_count: number;
    };
    commitments: {
      x: string;
      y: string;
    }[];
  };
  paillier_key_vec: {
    n: string;
    nn: string;
  }[];
  h1_h2_n_tilde_vec: {
    N: string;
    g: string;
    ni: string;
  }[];
}

export interface EddsaKeyFile {
  party_keys: {
    u_i: string;
    y_i: string;
    party_index: number;
  };
  shared_keys: {
    y: string;
  };
  chain_code: string;
  vss_scheme: {
    parameters: {
      threshold: number;
      share_count: number;
    };
    commitments: string[];
  };
}

export interface SignatureOutput {
  r: string;
  s: string;
  recid?: number;
  recovery_id?: number;
}

export interface PublicKeyOutput {
  x: string;
  y: string;
  compressed?: string;
}

export interface SignupRequest {
  uuid: string;
}

export interface SignupResponse {
  party_id: number;
}

export interface StoreRequest {
  party_from: number;
  party_to: number;
  round: string;
  uuid: string;
  data: string;
}

export interface PollRequest {
  party_from: number;
  party_to: number;
  round: string;
  uuid: string;
}

export interface PollResponse {
  data: string;
}

export interface TestConfig {
  algorithm: Algorithm;
  managerUrl: string;
  keyFiles: string[];
  timeout?: number;
}

export interface TestMetrics {
  keygenTime: number;
  signTime: number;
  verifyTime: number;
  totalTime: number;
}

export interface PartyConfig {
  partyId: number;
  keyFile: string;
  jwtKey?: string;
  jwtSecret?: string;
}

export interface SigningRoomState {
  uuid: string;
  parties: number[];
  message?: string;
  status: "waiting" | "in_progress" | "completed" | "failed";
}
