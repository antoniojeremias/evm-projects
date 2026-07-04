// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Altamente recomendado instalar

library Keccak256Utils {
    function appendByteToBytes(bytes memory b, uint8 x) internal pure returns (bytes memory) {
        return abi.encodePacked(b, x);
    }
}

contract OddOrEven is ReentrancyGuard {

    struct GameData {
        bytes32 hashOptionP1;   // 32 bytes
        uint256 timeOutP1;     // 32 bytes
        uint256 timeOutP2;     // 32 bytes
        uint256 nLockTime;     // 32 bytes
        address player1;       // 20 bytes
        address player2;       // 20 bytes
        uint64 timeOut;        // 8 bytes
        uint8 optionP2;        // 1 byte (Alterado de int8 para uint8)
        uint8 optionP1;        // 1 byte (Alterado de int8 para uint8)
        bool isOdd;            // 1 byte
        bool isAccepted;       // 1 byte (Melhor do que checar -1)
        bytes keyGame;         // Dinâmico (fim da struct)
    }

    GameData public gameData;
    GameData public lastGameRecord;

    address payable public immutable owner;
    uint256 public bidMin = 0.01 ether;
    uint8 public commission = 1;

    // Eventos cruciais para o ecossistema Hardhat / Front-end
    event GameInitialized(address indexed player1, uint256 bid, bool isOdd);
    event GameAccepted(address indexed player2, uint8 optionP2);
    event GameFinished(address indexed winner, uint256 prize);
    event GameCanceled();

    constructor() {
        owner = payable(msg.sender);
        resetState();
    }

    function setBid(uint256 newBid) external {
        require(msg.sender == owner, "You do not have permission");
        require(gameData.hashOptionP1 == 0, "Game in progress");
        bidMin = newBid;
    }

    function setComission(uint8 newComission) external {
        require(msg.sender == owner, "You do not have permission");
        require(gameData.hashOptionP1 == 0, "Game in progress");
        commission = newComission;
    }

    function resetState() private {
        gameData.hashOptionP1 = 0;
        gameData.timeOut = 60 * 20;
        gameData.timeOutP1 = 0;
        gameData.timeOutP2 = 0;
        gameData.nLockTime = 0;
        gameData.isOdd = true;
        gameData.isAccepted = false;
        gameData.player1 = address(0);
        gameData.player2 = address(0);
        gameData.optionP2 = 0;
        gameData.optionP1 = 0;
        gameData.keyGame = new bytes(0);
    }

    function playerInit(bool isOddIn, bytes32 hashOptionP1In) public payable {
        require(msg.value >= bidMin, "Invalid Bid");
        require(gameData.hashOptionP1 == 0, "Player1 already chose");

        gameData.isOdd = isOddIn;
        gameData.hashOptionP1 = hashOptionP1In;
        gameData.player1 = msg.sender;
        gameData.nLockTime = block.timestamp;
        gameData.timeOutP1 = block.timestamp + gameData.timeOut;
        gameData.timeOutP2 = gameData.timeOutP1;

        emit GameInitialized(msg.sender, msg.value, isOddIn);
    }

    function quitGame() public nonReentrant {
        require(!gameData.isAccepted, "Cant quit game after other player acceptance");
        require(msg.sender == gameData.player1, "Only player1 can quit");

        uint256 totalBalance = address(this).balance;
        uint256 p1Share = (totalBalance * (100 - commission)) / 100;
        uint256 ownerShare = totalBalance - p1Share;

        lastGameRecord = gameData;
        resetState();

        emit GameCanceled();

        (bool success1, ) = payable(gameData.player1).call{value: p1Share}("");
        require(success1, "Transfer to P1 failed");
        (bool success2, ) = owner.call{value: ownerShare}("");
        require(success2, "Transfer to owner failed");
    }

    function acceptGame(uint8 optionP2In) public payable nonReentrant {
        require(!gameData.isAccepted, 'Game Already Accepted');
        require(msg.value == bidMin, "Invalid amount");
        require(block.timestamp > gameData.nLockTime, "Locktime error");
        require(block.timestamp <= gameData.timeOutP1, "Timeout reached");

        gameData.player2 = msg.sender;
        gameData.timeOutP2 = block.timestamp + (2 * gameData.timeOut);
        gameData.optionP2 = optionP2In;
        gameData.isAccepted = true;

        uint256 contractBalance = address(this).balance;
        uint256 commissionAmount = (contractBalance * commission) / 100;

        emit GameAccepted(msg.sender, optionP2In);

        (bool success, ) = owner.call{value: commissionAmount}("");
        require(success, "Commission transfer failed");
    }

    function resultGame(bytes memory keygame, uint8 optionP1In) public nonReentrant {
        require(msg.sender == gameData.player1, "You cannot result a game");
        require(gameData.isAccepted, "Cant verify before player 2 acceptance");

        uint8 oddness = gameData.isOdd ? 1 : 0;
        gameData.keyGame = keygame;
        gameData.optionP1 = optionP1In;

        address winner;
        if (keccak256(Keccak256Utils.appendByteToBytes(keygame, optionP1In)) == gameData.hashOptionP1 
            && (uint16(optionP1In + gameData.optionP2) % 2 == oddness)) {
            winner = gameData.player1;
        } else {
            winner = gameData.player2;
        }

        uint256 prize = address(this).balance;
        lastGameRecord = gameData;
        resetState();

        emit GameFinished(winner, prize);

        (bool success, ) = payable(winner).call{value: prize}("");
        require(success, "Prize payout failed");
    }

    function claimGame() public nonReentrant {
        require(gameData.isAccepted, 'Only accepted game can be claimed');
        require(block.timestamp > gameData.timeOutP2, "Timeout not met");

        address winner = gameData.player2;
        uint256 prize = address(this).balance;

        lastGameRecord = gameData;
        resetState();

        emit GameFinished(winner, prize);

        (bool success, ) = payable(winner).call{value: prize}("");
        require(success, "Claim payout failed");
    }
}