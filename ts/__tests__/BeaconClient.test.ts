import BeaconClient from "../BeaconClient";
import "dotenv/config";
import { bytes32 } from "../utils/regex";

const client = new BeaconClient(process.env.PROVIDER_URL, 0);

describe("Beacon chain API client", () => {
  describe("blocks", () => {
    test("latest", async () => {
      const result = await client.getBlockHeaders();
      expect(result).toBeDefined();
      expect(result.slot).toBeGreaterThan(0);
      expect(result.proposerIndex).toBeGreaterThan(0);
      expect(result.parentRoot).toMatch(bytes32);
      expect(result.stateRoot).toMatch(bytes32);
    });
  });
  describe("validators", () => {
    test("active", async () => {
      const result = await client.getValidator(1275252);
      expect(result).toBeDefined();
      expect(result.index).toEqual(1275252);
      expect(result.balance).toBeGreaterThan(32n * 10n ** 18n);
      expect(result.effectiveBalance).toEqual(32n * 10n ** 18n);
      expect(result.status).toEqual("active_ongoing");
    });

    test("exited", async () => {
      const result = await client.getValidator(450461);
      expect(result).toBeDefined();
      expect(result.index).toEqual(450461);
      expect(result.balance).toEqual(0n);
      expect(result.effectiveBalance).toEqual(0n);
      expect(result.status).toEqual("withdrawal_done");
      expect(result.exitEpoch).toEqual(255542n);
      expect(result.withdrawableEpoch).toEqual(255798n);
    });
  });
});
