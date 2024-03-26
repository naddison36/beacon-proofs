export interface BlockHeaders {
  slot: number;
  proposerIndex: number;
  parentRoot: string;
  stateRoot: string;
}

export interface Validator {
  index: number;
  balance: bigint;
  status: string;
  pubkey: string;
  withdrawalCredentials: string;
  effectiveBalance: bigint;
  slashed: boolean;
  activationEligibilityEpoch: number;
  activationEpoch: number;
  exitEpoch: bigint;
  withdrawableEpoch: bigint;
}
