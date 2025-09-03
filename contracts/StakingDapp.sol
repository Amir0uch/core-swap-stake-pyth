// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * Staking pays rewards in the SAME ERC-20 (USDT) held by this contract.
 * Owner can update the per-second reward rate (APR-like), no redeploy needed.
 *
 * reward = amount * elapsedSeconds * rewardRatePerSecond / 1e18
 *
 * IMPORTANT: Keep enough USDT in this contract to cover claims/unstakes.
 */
contract StakingDapp is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;          // USDT
    uint256 public rewardRatePerSecond;            // 1e18-scaled per-token per-second

    struct Stake { uint256 amount; uint256 lastRewardTime; }
    mapping(address => Stake) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 previous, uint256 next);

    constructor(address _stakingToken, uint256 _rate) Ownable(msg.sender) {
        require(_stakingToken != address(0), "invalid token");
        stakingToken = IERC20(_stakingToken);
        rewardRatePerSecond = _rate;
    }

    // --- Admin ---

    function setRewardRatePerSecond(uint256 _rate) external onlyOwner {
        emit RewardRateUpdated(rewardRatePerSecond, _rate);
        rewardRatePerSecond = _rate;
    }

    // --- Views ---

    function getStakedAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    function getRewardAmount(address user) public view returns (uint256) {
        Stake memory s = stakes[user];
        if (s.amount == 0) return 0;
        uint256 elapsed = block.timestamp - s.lastRewardTime;
        return (s.amount * elapsed * rewardRatePerSecond) / 1e18;
    }

    function rewardPool() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }

    // --- Actions ---

    function stake(uint256 amount) external {
        require(amount > 0, "amount = 0");

        // pay accrued so far
        uint256 pending = getRewardAmount(msg.sender);
        if (pending > 0) {
            require(stakingToken.balanceOf(address(this)) >= pending, "insufficient rewards");
            stakingToken.safeTransfer(msg.sender, pending);
            emit RewardClaimed(msg.sender, pending);
        }

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        Stake storage s = stakes[msg.sender];
        s.amount += amount;
        s.lastRewardTime = block.timestamp;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        Stake storage s = stakes[msg.sender];
        require(s.amount >= amount, "not enough staked");

        // pay accrued so far
        uint256 pending = getRewardAmount(msg.sender);
        if (pending > 0) {
            require(stakingToken.balanceOf(address(this)) >= pending, "insufficient rewards");
            stakingToken.safeTransfer(msg.sender, pending);
            emit RewardClaimed(msg.sender, pending);
        }

        s.amount -= amount;
        s.lastRewardTime = block.timestamp;

        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external {
        uint256 reward = getRewardAmount(msg.sender);
        require(reward > 0, "no reward");

        stakes[msg.sender].lastRewardTime = block.timestamp;

        require(stakingToken.balanceOf(address(this)) >= reward, "insufficient rewards");
        stakingToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }
}
