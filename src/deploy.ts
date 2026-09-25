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
  bytecode: `0x${string}`;
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

  // POOL_NAME / POOL_SYMBOL / CAP (whole tokens, 18 decimals) come from the environment.
  const poolName = required("POOL_NAME");
  const poolSymbol = required("POOL_SYMBOL");
  const cap = parseEther(required("CAP"));

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Network:  ${chain.name} (chain id ${chain.id})`);
  console.log(`Deployer: ${account.address}`);
  console.log(`Pool:     ${poolName} (${poolSymbol})`);
  console.log(`Cap:      ${required("CAP")} tokens`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [poolName, poolSymbol, cap],
  });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`SyndicationPool deployed at: ${receipt.contractAddress}`);
  console.log(`\nSet CONTRACT_ADDRESS=${receipt.contractAddress} in your .env`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
