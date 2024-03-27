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

    let specResponse = await this.client.config.getSpec();
    if (!specResponse.ok) {
      throw specResponse.error;
    }

    this.secsPerSlot = parseInt(specResponse.response.data.SECONDS_PER_SLOT);
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

    const blockResponse = await this.client.beacon.getBlockV2(slot);
    if (!blockResponse.ok) {
      throw blockResponse.error;
    }

    // @ts-ignore
    const blockView = BeaconBlock.toView(blockResponse.response.data.message);
    const blockRoot = blockView.hashTreeRoot();

    log(`block root: 0x${hexlify(blockRoot)}`);

    /** @type {import('@chainsafe/persistent-merkle-tree').Tree} */
    // @ts-ignore
    const tree = blockView.tree.clone();
    // Patching the tree by attaching the response in the `stateRoot` field of the block.
    tree.setNode(blockView.type.getPropertyGindex("stateRoot"), stateView.node);

    // Create a proof for the response of the validator against the block.
    const gI = concatGindices([
      blockView.type.getPathInfo(["stateRoot"]).gindex,
      stateView.type.getPathInfo(["validators", validatorIndex]).gindex,
    ]);
    const proof = createProof(tree.rootNode, {
      type: ProofType.single,
      gindex: gI,
    });

    log(`Proof created for validator ${validatorIndex} at gIndex ${gI}`);

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

    return {
      blockRoot: hexlify(blockRoot),
      // @ts-ignore
      proof: proof.witnesses.map(hexlify),
      validator: stateView.validators.type.elementType.toJson(
        stateView.validators.get(validatorIndex)
      ),
      validatorIndex: validatorIndex,
      // ts: this.client.slotToTS(nextBlock.message.slot),
      gI,
    };
  }

  slotToTS = (slot: number) => {
    return this.genesisTime + slot * this.secsPerSlot;
  };
}
