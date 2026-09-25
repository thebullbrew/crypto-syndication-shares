// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SyndicationPool — tokenized LP interests with on-chain dividend distribution
/// @notice A mini-REIT factory: the owner (syndicator) mints capped ERC-20 shares
///         to limited partners, then pushes rental profits through `distribute()`.
///         Each holder pulls their pro-rata share with `claim()`. Dividend
///         accounting uses the classic magnified-dividend-per-share method, so
///         late mints and transfers never dilute or inflate anyone's payout.
///
///         ⚠️ Tokenized real-estate interests may be securities. Get counsel
///         before using this with real investors — see README.
contract SyndicationPool is ERC20, Ownable {
    /// @notice Maximum total share supply. Set once in the constructor.
    uint256 public immutable cap;

    /// @notice Cumulative ETH ever distributed through this pool.
    uint256 public totalDividendsDistributed;

    /// @dev Precision factor for dividend accounting (avoids rounding dust).
    uint256 internal constant MAGNITUDE = 2 ** 128;

    /// @dev Cumulative dividends per share, magnified by MAGNITUDE.
    uint256 internal magnifiedDividendPerShare;

    /// @dev Per-account correction so mints/transfers after distributions
    ///      don't credit unearned dividends (can be negative).
    mapping(address => int256) internal magnifiedDividendCorrections;

    /// @dev ETH already claimed per account.
    mapping(address => uint256) internal withdrawnDividends;

    event DividendsDistributed(uint256 amount);
    event DividendClaimed(address indexed account, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 cap_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(cap_ > 0, "SyndicationPool: cap is zero");
        cap = cap_;
    }

    /// @notice Mint shares to an LP. Enforces the cap. Owner only.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "SyndicationPool: zero address");
        require(totalSupply() + amount <= cap, "SyndicationPool: cap exceeded");
        _mint(to, amount);
    }

    /// @notice Push rental profits into the pool for pro-rata distribution.
    ///         ETH must enter through here — plain transfers revert.
    function distribute() external payable onlyOwner {
        require(msg.value > 0, "SyndicationPool: no value sent");
        require(totalSupply() > 0, "SyndicationPool: no shares outstanding");
        magnifiedDividendPerShare += (msg.value * MAGNITUDE) / totalSupply();
        totalDividendsDistributed += msg.value;
        emit DividendsDistributed(msg.value);
    }

    /// @notice Pull pattern: claim everything owed to the caller so far.
    function claim() external {
        uint256 amount = withdrawableDividendOf(msg.sender);
        require(amount > 0, "SyndicationPool: nothing to claim");
        withdrawnDividends[msg.sender] += amount;
        emit DividendClaimed(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "SyndicationPool: ETH transfer failed");
    }

    /// @notice ETH the account can claim right now.
    function withdrawableDividendOf(address account) public view returns (uint256) {
        return accumulativeDividendOf(account) - withdrawnDividends[account];
    }

    /// @notice Total ETH ever earned by the account (claimed or not).
    function accumulativeDividendOf(address account) public view returns (uint256) {
        return
            uint256(
                int256(magnifiedDividendPerShare * balanceOf(account)) +
                    magnifiedDividendCorrections[account]
            ) / MAGNITUDE;
    }

    /// @notice Total ETH the account has already claimed.
    function withdrawnDividendOf(address account) external view returns (uint256) {
        return withdrawnDividends[account];
    }

    /// @dev Keeps dividend accounting exact across mints and transfers:
    ///      newly minted shares start earning only from future distributions,
    ///      and transfers move the earned-but-unclaimed credit with the shares.
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        if (from == address(0)) {
            // Mint: new shares earn nothing retroactively.
            magnifiedDividendCorrections[to] -= int256(magnifiedDividendPerShare * value);
        } else if (to == address(0)) {
            // Burn: remove the credit with the shares.
            magnifiedDividendCorrections[from] += int256(magnifiedDividendPerShare * value);
        } else {
            // Transfer: move the earned credit along with the shares.
            magnifiedDividendCorrections[from] += int256(magnifiedDividendPerShare * value);
            magnifiedDividendCorrections[to] -= int256(magnifiedDividendPerShare * value);
        }
    }
}
