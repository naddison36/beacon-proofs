import axios from "axios";
// import { Tree } from "@chainsafe/persistent-merkle-tree";
// import { ssz } from "@lodestar/types";

import { sleep } from "./utils/time.js";
import { join } from "path";
import { logger } from "./utils/logger.js";
import { BlockHeaders, State, Validator } from "./types.js";

require("axios-debug-log");
const log = logger("client");

const gwei = 10n ** 9n;

export default class BeaconClient {
  constructor(
    public readonly url: string = "http://localhost",
    public readonly maxRetries = 3
  ) {}

  async getBlockHeaders(block: State = "head"): Promise<BlockHeaders> {
    const data = await this.get(`eth/v1/beacon/headers/${block}`);
    const header = data?.header?.message;

    return {
      slot: parseInt(header.slot),
      proposerIndex: parseInt(header.proposer_index),
      parentRoot: header.parent_root,
      stateRoot: header.state_root,
    };
  }

  async getValidator(
    validatorIndex: number,
    state: State = "head"
  ): Promise<Validator> {
    const data = await this.get(
      `eth/v1/beacon/states/${state}/validators/${validatorIndex}`
    );

    return {
      index: parseInt(data.index),
      balance: BigInt(data.balance) * gwei,
      status: data.status,
      pubkey: data?.validator.pubkey,
      withdrawalCredentials: data?.validator.withdrawal_credentials,
      effectiveBalance: BigInt(data?.validator.effective_balance) * gwei,
      slashed: data?.validator.slashed,
      activationEligibilityEpoch: parseInt(
        data?.validator.activation_eligibility_epoch ?? 0
      ),
      activationEpoch: parseInt(data?.validator.activation_epoch ?? 0),
      exitEpoch: BigInt(data?.validator.exit_epoch ?? 0),
      withdrawableEpoch: BigInt(data?.validator.withdrawable_epoch ?? 0),
    };
  }

  // async getBeaconState(state: State = "head"): Promise<any> {
  //   const sszData = await this.get(
  //     `/eth/v2/debug/beacon/states/${state}`,
  //     "application/octet-stream"
  //   );

  //   // const beaconState = ssz.deneb.BeaconState.deserialize(sszData);
  //   // const beaconStateView = ssz.deneb.BeaconState.toViewDU(beaconState);
  //   // const stateTree = new Tree(beaconStateView.node);

  //   // log(`Got Beacon state tree`);

  //   // return stateTree;
  // }

  private async get(
    subUrl: string,
    mediaType:
      | "application/octet-stream"
      | "application/json" = "application/json"
  ): Promise<any> {
    const url = join(this.url, subUrl);
    log(`About to get data from ${url}`);
    let retries = 0;
    while (true) {
      try {
        const response = await axios.get(url, {
          headers: { Accept: mediaType },
        });

        if (response.status === 429) {
          log("Rate limit exceeded");

          await sleep(1000);
          continue;
        }

        if (response.status !== 200) {
          throw Error(`status: ${response.status}`);
        }

        if (mediaType === "application/json") {
          if (!response?.data?.data) {
            throw new Error(`No data in the json response`);
          }
          log(response.data.data);
        }

        retries = 0;

        return response.data.data;
      } catch (error) {
        retries++;
        console.error(
          `Beacon rest api failed on try ${retries}: ${error.stack}`
        );
        if (retries >= this.maxRetries) {
          throw Error(`Failed to get Beacon data from url "${url}".`, {
            cause: error,
          });
        }
      }
    }
  }
}
