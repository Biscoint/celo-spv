export interface IBlockchainConfig {
  wsUrl: string;
  maxPastDaysForBlockRange?: number;
  blockTime: number;
}
