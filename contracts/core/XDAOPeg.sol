/*
██   ██ ██████   █████   ██████      ████████  ██████  ██   ██ ███████ ███    ██ 
 ██ ██  ██   ██ ██   ██ ██    ██        ██    ██    ██ ██  ██  ██      ████   ██ 
  ███   ██   ██ ███████ ██    ██        ██    ██    ██ █████   █████   ██ ██  ██ 
 ██ ██  ██   ██ ██   ██ ██    ██        ██    ██    ██ ██  ██  ██      ██  ██ ██ 
██   ██ ██████  ██   ██  ██████         ██     ██████  ██   ██ ███████ ██   ████ 
*/
// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract XDAOPeg is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    constructor() ERC20("XDAO", "XDAO") ERC20Permit("XDAO") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
