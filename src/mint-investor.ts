import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, parseEther, type Abi } from "viem";
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

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not set — deploy first (`npm run deploy`).");
  }

  const investor = required("INVESTOR") as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(investor)) {
    throw new Error(`INVESTOR must be a 20-byte hex address, got "${investor}".`);
  }
  const amount = parseEther(required("AMOUNT"));

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Pool:     ${config.contractAddress}`);
  console.log(`Investor: ${investor}`);
  console.log(`Amount:   ${required("AMOUNT")} shares`);

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "mint",
    args: [investor, amount],
  });
  console.log(`Mint tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
