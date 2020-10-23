import { EventData } from "web3-eth-contract";

export interface IBlockchainConfig {
  wsUrl: string;
  maxPastDaysForBlockRange?: number;
  blockTime: number;
}

export interface IEventData extends EventData {
  removed: boolean;
}