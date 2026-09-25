import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

// Produced by `npx hardhat compile` — this script assumes the artifact exists.
const ARTIFACT_PATH = join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "SyndicationPool.sol",
  "SyndicationPool.json"
);

interface ContractArtifact {
  abi: Abi;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not set — deploy first (`npm run deploy`).");
  }

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const owed = (await publicClient.readContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "withdrawableDividendOf",
    args: [account.address],
  })) as bigint;

  console.log(`Pool:      ${config.contractAddress}`);
  console.log(`Claimant:  ${account.address}`);
  console.log(`Claimable: ${formatEther(owed)} ETH`);
  if (owed === 0n) {
    console.log("Nothing to claim.");
    return;
  }

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "claim",
  });
  console.log(`Claim tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
