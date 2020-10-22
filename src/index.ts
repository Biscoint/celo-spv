import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import config from "config";
import Conf from "conf";
import { BlockHeader } from "web3-eth";
import { Subscription } from "web3-core-subscriptions";
import { IBlockchainConfig } from "./types";


const dataPath: string = config.get("dataPath");
const blockchainConfig: IBlockchainConfig = config.get("blockchainConfig");

const store = new Conf({
  cwd: dataPath,
});

const CELO_BLOCK_TIME_SECONDS = blockchainConfig.blockTime;
const MAX_DAYS_BLOCKS_RANGE = blockchainConfig.maxPastDaysForBlockRange;
const WS_URL = blockchainConfig.wsUrl;

const web3WsProvider = new Web3.providers.WebsocketProvider(
  WS_URL,
  {
    timeout: 30000,
    reconnect: {
      auto: true,
      delay: 5000, // ms
      maxAttempts: 5,
      onTimeout: false,
    },
  }
);

const web3Instance = new Web3(web3WsProvider);
// @ts-ignore
const kit = newKitFromWeb3(web3Instance);

let cUSDEvents = null;

web3WsProvider.on("connect", async () => {
  console.log("Websocket provider connected");

  const celoSub: Subscription<BlockHeader> = web3Instance.eth.subscribe("newBlockHeaders", (err, blockHeader) => {
    if (!err) console.log(`${blockHeader.number} newBlockHeaders!`);
  });

  const stabletoken = await kit.contracts.getStableToken();

  const blockNumber = await web3Instance.eth.getBlockNumber();
  console.log(`Current Block: ${blockNumber}`);

  const currentBlock = store.get("currentBlock") as number;

  const fromBlock =
    currentBlock + 1 ||
    blockNumber -
      Math.floor(
        (MAX_DAYS_BLOCKS_RANGE * 24 * 60 * 60) / CELO_BLOCK_TIME_SECONDS
      );

  console.log(`Getting events from block %d`, fromBlock);

  cUSDEvents = stabletoken.events.allEvents({}, { fromBlock });

  cUSDEvents.on("connected", (connectionID) => {
    console.log(`Connected with ${connectionID}!`);
  });

  cUSDEvents.on("data", (data) => {
    console.log("New Data");
    if (data.event === "Transfer") {
      store.set("currentBlock", data.blockNumber);
      console.log(`tx ${data.transactionHash}`);
      if (!data.removed) {
        console.log(`hash confirmed ${data.transactionHash}`);
      } else {
        console.log(`hash unconfirmed ${data.transactionHash}`);
      }
      console.log("new TX!", data.transactionHash);
    } else {
      // console.log(data);
    }
  });

  cUSDEvents.on("error", (err: any) => {
    console.log("Contract error: ", err);
  });
});

web3WsProvider.on("error", () => {
  console.log("Websocket provider error");

  if (!web3WsProvider.connected) {
    process.exit(1);
  }
});

web3WsProvider.on("reconnect", () => {
  console.log("Websocket provider reconnecting...");
});

web3WsProvider.on("close", () => {
  console.log("Websocket provider disconnected");
});
