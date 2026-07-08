import { encodeFunctionData, parseAbi, maxUint256 } from "viem";
import type { WalletInterFaceAPI } from "@trustware/sdk";
import { getPublicClient } from "./publicClient";

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

function requireEip1193(wallet: WalletInterFaceAPI) {
  if (wallet.ecosystem !== "evm" || wallet.type !== "eip1193") {
    throw new Error("Approval flow requires an eip1193 EVM wallet");
  }
  return wallet;
}

/**
 * Trustware routes here through LI.FI's Diamond contract, whose facets pull
 * funds with a plain `IERC20.safeTransferFrom(msg.sender, address(this), ...)`
 * (confirmed against LI.FI's own LibAsset.depositAsset source on GitHub) —
 * a direct ERC-20 allowance to the Diamond address itself, not Permit2.
 * Only sends an approval if the current allowance is actually insufficient.
 */
export async function ensureErc20Allowance({
  chainId,
  wallet,
  owner,
  token,
  spender,
  amount,
  onStep,
}: {
  chainId: number | string;
  wallet: WalletInterFaceAPI;
  owner: `0x${string}`;
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: bigint;
  onStep?: (message: string) => void;
}) {
  const client = getPublicClient(chainId);
  const evm = requireEip1193(wallet);

  const current = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (current >= amount) return;

  onStep?.("Approving token spend...");
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
  });
  const hash = (await evm.request({
    method: "eth_sendTransaction",
    params: [{ from: owner, to: token, data, chainId: `0x${Number(chainId).toString(16)}` }],
  })) as `0x${string}`;

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Approval transaction ${hash} reverted`);
  }
}
