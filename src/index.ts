import { newKit } from "@celo/contractkit";

(async () => {
  const kit = newKit("https://alfajores-forno.celo-testnet.org");

  // 3. Get the Gold Token contract
  let goldtoken = await kit.contracts.getGoldToken();

  // 4. Address to look up
  let anAddress = "0xD86518b29BB52a5DAC5991eACf09481CE4B0710d";

  // 5. Get Gold Token balance
  let balance = await goldtoken.balanceOf(anAddress);

  // Print balance
  console.log(`${anAddress} balance: ${balance.toString()}`);
})();
