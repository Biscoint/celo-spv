import { newKit } from "@celo/contractkit";
import Web3 from "web3";
import config from "config";
import Conf from "conf";
import erc20abi from "human-standard-token-abi";

const dataPath: string = config.get("dataPath");

const store = new Conf({
  cwd: dataPath,
});

const CELO_BLOCK_TIME_SECONDS = 13;

const MAX_DAYS_BLOCKS_RANGE = /* settings.core.maxPastDaysForBlockRange || */ 30;

const web3WsProvider = new Web3.providers.WebsocketProvider(
  "wss://forno.celo.org/ws",
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

const web3Cli = new Web3(web3WsProvider);

/** @type {Subscription<BlockHeader>} */
let ethSub = null;

const cUSDContract = new web3Cli.eth.Contract(
  erc20abi,
  settings.core.contractAddress
);
let cUSDEvents = null;

web3WsProvider.on("connect", async () => {
  console.log("Websocket provider connected");

  ethSub = web3Cli.eth.subscribe("newBlockHeaders", (err, block) => {
    if (!err) console.log(`${block.number} newBlockHeaders!`);
  });

  const blockNumber = await web3Cli.eth.getBlockNumber();
  console.log(`Current Block: ${blockNumber}`);

  const currentBlock = store.get("currentBlock") as number;

  const fromBlock =
    currentBlock + 1 ||
    blockNumber -
      Math.floor((MAX_DAYS_BLOCKS_RANGE * 24 * 60 * 60) / MAX_DAYS_BLOCKS_RANGE);

  console.log(`Getting events from block %d`, fromBlock);

  cUSDEvents = cUSDContract.events.allEvents({}, { fromBlock });

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
      console.log(data);
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
  if (ethSub) {
    ethSub.unsubscribe();
    ethSub = null;
  }

  if (cUSDEvents) {
    cUSDEvents.removeAllListeners();
    cUSDEvents = null;
  }
});

web3WsProvider.on("close", () => {
  console.log("Websocket provider disconnected");
});
