import "dotenv/config";

import BeaconProofs from "./BeaconProofs.js";

const main = async () => {
  const proofs = new BeaconProofs(process.env.PROVIDER_URL);
  await proofs.initialize();

  const validatoProof = await proofs.createValidatorProof(1275252);

  console.log(validatoProof);
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
