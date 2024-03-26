import axios from "axios";
import { sleep } from "./utils/time";
import { join } from "path";
import { logger } from "./utils/logger";
import { BlockHeaders, Validator } from "./types";

require("axios-debug-log");
const log = logger("client");

const gwei = 10n ** 9n;

export default class BeaconClient {
  constructor(
    public readonly url: string = "http://localhost",
    public readonly maxRetries = 3
  ) {}

  async getBlockHeaders(
    block: number | "head" = "head"
  ): Promise<BlockHeaders> {
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
    state: string = "head"
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

  private async get(subUrl: string): Promise<any> {
    const url = join(this.url, subUrl);
    log(`About to get data from ${url}`);
    let retries = 0;
    while (true) {
      try {
        const response = await axios.get(url);

        if (response.status === 429) {
          log("Rate limit exceeded");

          await sleep(1000);
          continue;
        }

        if (response.status !== 200) {
          throw Error(`status: ${response.status}`);
        }

        if (!response?.data?.data) {
          throw new Error(`No data in the response`);
        }

        log(response.data.data);

        retries = 0;

        return response.data.data;
      } catch (error) {
        retries++;
        if (retries >= this.maxRetries) {
          throw Error(`Failed to get Beacon data from url "${url}".`, {
            cause: error,
          });
        }

        console.error(`Beacon rest api failed on try ${retries}: ${error}`);
      }
    }
  }
}
