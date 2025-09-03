// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract Swap {
    address public owner;
    uint256 public fee; // in basis points (e.g., 10 = 0.1%)

    event SwapExecuted(address indexed user, uint256 coreAmount, address indexed tokenOut, uint256 tokenAmount);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event Withdrawal(address indexed token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 _fee) {
        owner = msg.sender;
        fee = _fee; // e.g. 10 = 0.1%
    }

    receive() external payable {
        // Accept CORE deposits
    }

    function swapCoreToToken(address tokenOut) external payable {
        require(msg.value > 0, "Send CORE to swap");

        uint256 feeAmount = (msg.value * fee) / 10000;
        uint256 swapAmount = msg.value - feeAmount;

        uint256 tokenBalance = IERC20(tokenOut).balanceOf(address(this));
        require(tokenBalance >= swapAmount, "Not enough token liquidity");

        bool sent = IERC20(tokenOut).transfer(msg.sender, swapAmount);
        require(sent, "Token transfer failed");

        emit SwapExecuted(msg.sender, msg.value, tokenOut, swapAmount);
    }

    function updateFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // max 10%
        emit FeeUpdated(fee, newFee);
        fee = newFee;
    }

    function withdrawToken(address token) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(msg.sender, amount), "Token withdrawal failed");
        emit Withdrawal(token, amount);
    }

    function withdrawCore() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "CORE withdrawal failed");
        emit Withdrawal(address(0), amount);
    }
}
