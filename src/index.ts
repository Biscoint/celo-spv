import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import config from "config";
import Conf from "conf";
import { BlockHeader } from "web3-eth";
import { Subscription } from "web3-core-subscriptions";
import { IBlockchainConfig, IEventData } from "./types";
import { EventEmitter } from "events";

const dataPath: string = config.get("dataPath");
const blockchainConfig: IBlockchainConfig = config.get("blockchainConfig");

const store = new Conf({
  cwd: dataPath,
});

const CELO_BLOCK_TIME_SECONDS = blockchainConfig.blockTime;
const MAX_DAYS_BLOCKS_RANGE = blockchainConfig.maxPastDaysForBlockRange;
const WS_URL = blockchainConfig.wsUrl;

const web3WsProvider = new Web3.providers.WebsocketProvider(WS_URL, {
  timeout: 30000,
  reconnect: {
    auto: true,
    delay: 5000,
    maxAttempts: 5,
    onTimeout: false,
  },
});

const web3Instance = new Web3(web3WsProvider);
// @ts-ignore
const kit = newKitFromWeb3(web3Instance);

let celoSub: Subscription<BlockHeader>;
let cUSDEvents: EventEmitter;

web3WsProvider.on("connect", async () => {
  console.log("<ws provider> connected");

  celoSub = web3Instance.eth.subscribe(
    "newBlockHeaders",
    (err, blockHeader) => {
      if (!err) console.log(`<celo> blockHeader - ${blockHeader.number}`);
    }
  );

  const stabletoken = await kit.contracts.getStableToken();

  const blockNumber = await web3Instance.eth.getBlockNumber();

  console.log(`<spv> current Block: ${blockNumber}`);

  const currentBlock = store.get("currentBlock") as number;

  const fallbackFromBlock =
    blockNumber -
    Math.floor(
      (MAX_DAYS_BLOCKS_RANGE * 24 * 60 * 60) / CELO_BLOCK_TIME_SECONDS
    );

  const fromBlock = currentBlock + 1 || fallbackFromBlock;

  console.log(`<spv> getting events from block: ${fromBlock}`);

  cUSDEvents = stabletoken.events.allEvents({}, { fromBlock });

  cUSDEvents.on("connected", (subscriptionId: string) => {
    console.log(`<cusd> subscription ID: ${subscriptionId}`);
  });

  cUSDEvents.on("data", (data: IEventData) => {
    if (data.event === "Transfer") {
      store.set("currentBlock", data.blockNumber);
      // new TX
      console.log(`<cusd> transfer - ${data.transactionHash}`);

      if (data.removed)
        console.log(`<cusd> unconfirmed - ${data.transactionHash}`);
      else console.log(`<cusd> confirmed - ${data.transactionHash}`);
    } else {
      // handle this if necessary
      // console.log(data);
    }
  });

  cUSDEvents.on("error", (err: any) => {
    console.log("<cusd> contract error: ", err);
  });
});

web3WsProvider.on("error", () => {
  console.log("<ws provider> error");

  if (!web3WsProvider.connected) {
    process.exit(1);
  }
});

web3WsProvider.on("reconnect", () => {
  console.log("<ws provider> reconnecting");

  if (celoSub) {
    celoSub.unsubscribe();
    celoSub = null;
  }

  if (cUSDEvents) {
    cUSDEvents.removeAllListeners();
    cUSDEvents = null;
  }
});

web3WsProvider.on("close", () => {
  console.log("<ws provider> disconnected");
});
