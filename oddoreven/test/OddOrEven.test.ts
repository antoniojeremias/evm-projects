import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

type GameData = {
  hashOptionP1: string;
  timeOutP1: string;    
  timeOutP2: string;    
  nLockTime: string;    
  player1: string;      
  player2: string;      
  timeOut: string;      
  optionP2: number;     
  optionP1: number;     
  isOdd: boolean;       
  isAccepted: boolean;  
  keyGame: string;      
};

function fetchGameData(rawGameData: any) {
  const gameData: GameData = {
    hashOptionP1: rawGameData[0],
    timeOutP1: rawGameData[1],
    timeOutP2: rawGameData[2],
    nLockTime: rawGameData[3],
    player1: rawGameData[4],
    player2: rawGameData[5],
    timeOut: rawGameData[6],
    optionP2: Number(rawGameData[7]),
    optionP1: Number(rawGameData[8]),
    isOdd: rawGameData[9],
    isAccepted: rawGameData[10],
    keyGame: rawGameData[11]
  };
  return gameData;
}

function hexStringToUint8Array(hexString: string): Uint8Array {
  if (hexString.length % 2 !== 0) {
      throw new Error("Hex string must have an even length");
  }
  const byteArray = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < byteArray.length; i++) {
      const byte = hexString.substr(i * 2, 2);
      byteArray[i] = parseInt(byte, 16);
  }
  return byteArray;
}

let keySeed = hexStringToUint8Array("abcddbe576b4818846aa77e82f4ed5fa78f92766b141f282d36703886d196df39322abcddbe576b4818846aa77e82f4ed5fa78f92766b141f282d36703886d196df39322");
let gameKey = ethers.keccak256(keySeed);

const DEFAULT_BID = ethers.parseEther("0.01");

describe("OddOrEven - Versão Otimizada", function () {
  let oddOrEven: any;
  let owner: any;
  let player1: any;
  let player2: any;

  beforeEach(async () => {
    [owner, player1, player2] = await ethers.getSigners();
    oddOrEven = await ethers.deployContract("OddOrEven");
  });
  
  it("should have created with default values", async function () {
    let gameData = fetchGameData(await oddOrEven.gameData());
    expect(gameData.optionP2).to.equal(0);
    expect(gameData.isAccepted).to.equal(false);
  });

  it("should init game", async function () {
    let player1Instance = oddOrEven.connect(player1);
    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');

    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));
    let isOdd = false;

    await player1Instance.playerInit(isOdd, hashOptionP1In, { value: DEFAULT_BID });

    let gameData = fetchGameData(await oddOrEven.gameData()); 
    expect(gameData.hashOptionP1).to.equal(hashOptionP1In);
  });

  it("should NOT init game (Invalid Bid)", async function () {
    const player1Instance = oddOrEven.connect(player1);
    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));

    await expect(player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID - 1n }))
      .to.be.revertedWith("Invalid Bid");
  });  
  
  it("should NOT init game (Player1 already chose)", async function () {
    const player1Instance = oddOrEven.connect(player1);
    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));
    
    await player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID });

    await expect(player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID }))
      .to.be.revertedWith("Player1 already chose");
  });

  it("should quit game", async function () {
    const player1Instance = oddOrEven.connect(player1);
    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));

    await player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID });

    await player1Instance.quitGame();

    const balanceContractAfter = await ethers.provider.getBalance(oddOrEven.target);
    expect(balanceContractAfter).to.equal(0n);

    let gameData = fetchGameData(await oddOrEven.gameData());
    expect(gameData.hashOptionP1).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("should NOT quit game (Accepted)", async function () {
    const player1Instance = oddOrEven.connect(player1);
    const player2Instance = oddOrEven.connect(player2);

    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));

    await player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID });
    let gameData = fetchGameData(await oddOrEven.gameData());

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(gameData.nLockTime.toString()) + 1]);
    await ethers.provider.send("evm_mine", []);

    await player2Instance.acceptGame(4, { value: DEFAULT_BID });

    await expect(player1Instance.quitGame())
      .to.be.revertedWith("Cant quit game after other player acceptance");
  });

  it("should NOT quit game (Not Player 1)", async function () {
    const player1Instance = oddOrEven.connect(player1);
    const player2Instance = oddOrEven.connect(player2);

    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));

    await player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID });

    await expect(player2Instance.quitGame())
      .to.be.revertedWith("Only player1 can quit");
  });

  it("should accept game", async function () {
    const player1Instance = oddOrEven.connect(player1);
    const player2Instance = oddOrEven.connect(player2);

    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str)); 
 
    await player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID });
    let gameData = fetchGameData(await oddOrEven.gameData());

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(gameData.nLockTime.toString()) + 1]);
    await ethers.provider.send("evm_mine", []);

    let balanceOwnerbefore = await ethers.provider.getBalance(owner.address);
    let balanceContractBefore = await ethers.provider.getBalance(oddOrEven.target);

    await player2Instance.acceptGame(4, { value: DEFAULT_BID });

    let balanceOwnerafter = await ethers.provider.getBalance(owner.address);
    let balanceContractAfter = await ethers.provider.getBalance(oddOrEven.target);

    gameData = fetchGameData(await oddOrEven.gameData());
   
    expect((balanceOwnerafter - balanceOwnerbefore) + balanceContractAfter).to.equal(2n * balanceContractBefore);
    expect(gameData.optionP2).to.equal(4);
    expect(gameData.isAccepted).to.equal(true);
  });

  it("should NOT accept game (Negative Option)", async function () {
    const player2Instance = oddOrEven.connect(player2);
    try {
      await player2Instance.acceptGame(-4, { value: DEFAULT_BID });
      expect.fail("Deveria ter falhado por out-of-bounds");
    } catch (error: any) {
      expect(error.message).to.include("value out-of-bounds");
    }
  });

  it("should give victory to Player 1 (3 + 5 even)", async function () {
    const player1Instance = oddOrEven.connect(player1);
    const player2Instance = oddOrEven.connect(player2);

    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 3;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));

    await player1Instance.playerInit(false, hashOptionP1In, { value: DEFAULT_BID });
    let gameData = fetchGameData(await oddOrEven.gameData());

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(gameData.nLockTime.toString()) + 10]);
    await ethers.provider.send("evm_mine", []);

    await player2Instance.acceptGame(5, { value: DEFAULT_BID });
    gameData = fetchGameData(await oddOrEven.gameData());

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(gameData.nLockTime.toString()) + 20]);
    await ethers.provider.send("evm_mine", []);

    let balanceP1before = await ethers.provider.getBalance(player1.address);

    await player1Instance.resultGame(hexStringToUint8Array(keygame), optionP1In);

    let balanceP1after = await ethers.provider.getBalance(player1.address);
    let gameDataLast = fetchGameData(await oddOrEven.lastGameRecord());
  
    expect(balanceP1after > balanceP1before).to.equal(true);
    expect(gameDataLast.keyGame).to.equal(gameKey);
  });

  it("should claim game after timeout", async function () {
    const player1Instance = oddOrEven.connect(player1);
    const player2Instance = oddOrEven.connect(player2);

    let keygame: string = gameKey.substring(2, gameKey.length);
    let optionP1In: number = 2;
    let optionP1str = optionP1In.toString(16).padStart(2, '0');
    let hashOptionP1In = ethers.keccak256(hexStringToUint8Array(keygame + optionP1str));

    await player1Instance.playerInit(true, hashOptionP1In, { value: DEFAULT_BID });
    let gameData = fetchGameData(await oddOrEven.gameData());

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(gameData.nLockTime.toString()) + 1]);
    await ethers.provider.send("evm_mine", []);

    await player2Instance.acceptGame(5, { value: DEFAULT_BID });
    gameData = fetchGameData(await oddOrEven.gameData());

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(gameData.timeOutP2.toString()) + 1]);
    await ethers.provider.send("evm_mine", []);

    let balanceP2before = await ethers.provider.getBalance(player2.address);

    await player2Instance.claimGame();

    let balanceP2after = await ethers.provider.getBalance(player2.address);
    expect(balanceP2after > balanceP2before).to.equal(true);
  });
});