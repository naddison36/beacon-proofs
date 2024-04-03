import {
  concatGindices,
  createProof,
  ProofType,
} from "@chainsafe/persistent-merkle-tree";
import { getClient, Api } from "@lodestar/api";
import { config } from "@lodestar/config/default";
import { ssz } from "@lodestar/types";
import { hexlify } from "ethers";

import logger from "./utils/logger.js";
const log = logger("proofs");

const BeaconState = ssz.deneb.BeaconState;
const BeaconBlock = ssz.deneb.BeaconBlock;

export default class BeaconProofs {
  private client: Api;
  private genesisTime: number;
  private secsPerSlot: number;

  constructor(public readonly url: string = "http://localhost") {
    this.client = getClient(
      { baseUrl: this.url, timeoutMs: 60_000 },
      { config }
    );
  }

  async initialize(): Promise<void> {
    let genesisResponse = await this.client.beacon.getGenesis();
    if (!genesisResponse.ok) {
      throw genesisResponse.error;
    }

    this.genesisTime = genesisResponse.response.data.genesisTime;
    log(`Genesis time: ${this.genesisTime}`);

    let specResponse = await this.client.config.getSpec();
    if (!specResponse.ok) {
      throw specResponse.error;
    }

    // should be 12 seconds
    this.secsPerSlot = parseInt(specResponse.response.data.SECONDS_PER_SLOT);
    log(`Seconds per slot: ${this.secsPerSlot}`);
  }

  async createValidatorProof(
    validatorIndex: number,
    slot: "finalized" | number = "finalized"
  ): Promise<any> {
    const stateResponse = await this.client.debug.getStateV2(slot, "ssz");
    if (!stateResponse.ok) {
      throw stateResponse.error;
    }

    log(
      `Got serialized BeaconState of ${(stateResponse.response.length / 1048576).toFixed(2)} MB`
    );

    const stateView = BeaconState.deserializeToView(stateResponse.response);
    log(`Beacon state for ${stateView.validators.length} validators`);
    log(`Beacon state for ${stateView.balances.length} balances`);

    const blockResponse = await this.client.beacon.getBlockV2(slot);
    if (!blockResponse.ok) {
      throw blockResponse.error;
    }

    log(`Got block with:`);
    log(`slot        ${blockResponse.response.data.message.slot}`);
    log(
      `parent root ${hexlify(blockResponse.response.data.message.parentRoot)}`
    );
    log(
      `state root  ${hexlify(blockResponse.response.data.message.stateRoot)}`
    );
    log(
      `block hash  ${hexlify(blockResponse.response.data.message.body.eth1Data.blockHash)}`
    );

    // @ts-ignore
    const blockView = BeaconBlock.toView(blockResponse.response.data.message);
    const blockRoot = blockView.hashTreeRoot();

    log(`block root  ${hexlify(blockRoot)}`);

    // @ts-ignore
    const tree = blockView.tree.clone();
    // Patching the tree by attaching the response in the `stateRoot` field of the block.
    tree.setNode(blockView.type.getPropertyGindex("stateRoot"), stateView.node);

    // Create a proof for the response of the validator against the block.
    const generalizedIndex = concatGindices([
      blockView.type.getPathInfo(["stateRoot"]).gindex,
      stateView.type.getPathInfo(["validators", validatorIndex]).gindex,
    ]);

    log(`generalized merkle index to validator ${generalizedIndex}`);

    const proof = createProof(tree.rootNode, {
      type: ProofType.single,
      gindex: generalizedIndex,
    });

    log(
      `${proof.type} proof created for validator ${validatorIndex} at gIndex ${generalizedIndex}`
    );

    // Since EIP-4788 stores parentRoot, we have to find the descendant block of
    // the block from the response.
    const blockHeaderResponse = await this.client.beacon.getBlockHeaders({
      parentRoot: hexlify(blockRoot),
    });
    if (!blockHeaderResponse.ok) {
      throw blockHeaderResponse.error;
    }

    const nextBlock = blockHeaderResponse.response.data[0]?.header;
    if (!nextBlock) {
      throw new Error("No block to fetch timestamp from");
    }

    log(`Got next block header with slot ${nextBlock.message.slot}`);

    // const proofHex = hexlify(serializeProof(proof));
    // log(`serialized proof is ${proofHex.length / 2} bytes`);

    return {
      blockRoot: hexlify(blockRoot),
      // @ts-ignore
      proof: proof.witnesses.map(hexlify),
      validator: stateView.validators.type.elementType.toJson(
        stateView.validators.get(validatorIndex)
      ),
      balance: stateView.balances.get(validatorIndex),
      validatorIndex: validatorIndex,
      timestamp: this.slotToTimestamp(nextBlock.message.slot),
      generalizedIndex,
    };
  }

  slotToTimestamp = (slot: number) => {
    return this.genesisTime + slot * this.secsPerSlot;
  };
}
