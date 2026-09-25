# Syndication Shares

![banner](assets/banner.jpg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-627EEA.svg)](https://etherscan.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

A mini-REIT factory: tokenize LP interests in a real-estate syndication as
capped ERC-20 shares, then push rental profits on-chain for pro-rata
distribution. Built on [Hardhat](https://hardhat.org),
[OpenZeppelin Contracts](https://openzeppelin.com/contracts), and
[viem](https://viem.sh).

## What it is

- **`contracts/SyndicationPool.sol`** — ERC-20 shares (name/symbol/cap set at
  deploy) plus dividend distribution in one contract:
  - `mint(to, amount)` — owner-only, enforces the cap. Shares = LP interests.
  - `distribute()` — payable, owner-only. Push rental profits in; the contract
    credits every shareholder pro-rata.
  - `claim()` — pull pattern. Each holder withdraws what's owed, whenever.
  - `withdrawableDividendOf(account)` / `accumulativeDividendOf(account)` /
    `withdrawnDividendOf(account)` / `totalDividendsDistributed()` — views.
- **`src/deploy.ts`** — deploys the pool (`POOL_NAME`, `POOL_SYMBOL`, `CAP`).
- **`src/mint-investor.ts`** — mints shares to an LP (`INVESTOR`, `AMOUNT`).
- **`src/distribute.ts`** — sends profits for distribution (`AMOUNT_ETH`).
- **`src/claim.ts`** — claims the caller's dividends.

## Quickstart

```bash
npm install
npx hardhat compile
npm run build

cp .env.example .env   # fill in RPC_URL, PRIVATE_KEY

# 1. Deploy the pool (cap in whole tokens, 18 decimals)
POOL_NAME="Maple St Syndication" POOL_SYMBOL=MSS CAP=1000000 npm run deploy
#    → set CONTRACT_ADDRESS in .env

# 2. Mint shares to investors
INVESTOR=0xInvestorAddress AMOUNT=250000 npm run mint

# 3. Push this month's rental profits
AMOUNT_ETH=12.5 npm run distribute

# 4. Investors pull their share any time
npm run claim
```

## How dividend accounting works

The contract uses magnified-dividend-per-share accounting (magnitude 2**128):

1. Each `distribute()` adds `msg.value * 2**128 / totalSupply()` to a running
   per-share total.
2. Every account carries a signed correction so shares minted — or transferred
   — *after* a distribution earn nothing retroactively. Late money never
   dilutes early money, and selling your shares moves the earned-but-unclaimed
   credit to the buyer.
3. `withdrawableDividendOf` = lifetime earned − already claimed. `claim()`
   pays it out and records it.

Dust from integer division stays in the contract and rolls into the next
distribution — nobody's payout is ever inflated, only microscopically rounded.

## ⚠️ Securities note

Tokenized interests in a real-estate syndication may be **securities** under
the Howey test (investment of money, common enterprise, expectation of profits
from the efforts of others). This template is educational software, not legal
advice: get a securities attorney before offering shares to real investors,
and consider transfer restrictions, investor accreditation checks, and
jurisdiction-specific exemptions (e.g. Reg D / Reg S) for any production use.

## Security

- The owner can mint up to the cap and controls distributions — in production,
  put ownership behind a multisig or timelock.
- `distribute()` reverts on zero value or zero supply; plain ETH transfers to
  the contract revert (profits must enter through `distribute()`).
- Not audited. Do not use with real funds until reviewed by qualified
  professionals.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
