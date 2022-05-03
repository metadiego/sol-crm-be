const solana = require("@solana/web3.js");

const SOLANA_NETWORK = 'devnet';
const SOLANA_NETWORK_COMMITMENT = 'confirmed';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/// Builds a connection object to Solana network.
function getConnection() {
  // return new solana.Connection(
  //   solana.clusterApiUrl(SOLANA_NETWORK),
  //   SOLANA_NETWORK_COMMITMENT
  // );
  return new solana.Connection("https://spring-blue-dust.solana-devnet.quiknode.pro/2a0a9e8ffcd7cadc47b1997f54034a4af1adc374/");
}

async function GetTokenHolders(
  connection,
  mintId
) {
  return connection.getParsedProgramAccounts(new solana.PublicKey(TOKEN_PROGRAM_ID), {
    filters: [
      {
        dataSize: 165, // number of bytes
      },
      {
        memcmp: {
          offset: 0, // number of bytes
          bytes: mintId, // base58 encoded string
        },
      },
    ],
  });
}

async function GetHolderSnapshot(connection, mintId, collectionIdx) {
  const accountsByMint = await GetTokenHolders(connection, mintId);

  const tokenMintHolders = [];

  for (let j = 0; j < accountsByMint.length; j += 1) {
    const accountData = accountsByMint[j].account.data;
    if ((accountData.parsed.info?.tokenAmount?.uiAmount ?? 0) > 0) {
      tokenMintHolders.push({
        publicKey: (accountData.parsed.info?.owner ?? ''),
        amount: accountData.parsed.info.tokenAmount.uiAmount,
        mint: mintId,
        collectionIdx
      });
    }
  }
  return tokenMintHolders;
};

async function GetTransactionsByAddress(connection, publicKey) {
  const transSignatures = await connection.getConfirmedSignaturesForAddress2(new solana.PublicKey(publicKey));

  /// Map with registry of all tokens acquired by the wallet by date.
  const acquiredTokens = new Map();

  for (let i = 0; i < transSignatures.length; i++) {
    const signature = transSignatures[i].signature;
    const confirmedTransaction = await connection.getTransaction(
      signature,
    );
    if (confirmedTransaction?.meta) {

      /// Create a map with balances pre-transaction for provided publicKey.
      const preTokenBalancesMap = new Map();
      confirmedTransaction?.meta?.preTokenBalances?.forEach((elem) => {
        if (elem.owner === publicKey) {
          preTokenBalancesMap.set(elem.mint, elem.uiTokenAmount.amount);
        }
      });

      /// Create a map with balances post-transaction for provided publicKey.
      const postTokenBalancesMap = new Map();
      confirmedTransaction?.meta?.postTokenBalances?.forEach((elem) => {
        if (elem.owner === publicKey) {
          postTokenBalancesMap.set(elem.mint, elem.uiTokenAmount.amount);
        }
      });

      /// Compare pre-post balance and return a map with all changes.
      postTokenBalancesMap.forEach((value, key,) => {
        const preBalance = preTokenBalancesMap.has(key) ? preTokenBalancesMap.get(key) : 0;
        if (value - preBalance) {
          const transactionDate = new Date((confirmedTransaction?.blockTime ?? 0) * 1000);
          if (!acquiredTokens.has(key) || transactionDate < (acquiredTokens.get(key)?.date ?? Date.now())) {
            acquiredTokens.set(key, { ammount: value - preBalance, date: transactionDate });
          }
        }
      });
    }
  }
  return acquiredTokens;
}

async function GetHolderTransactionData(connection, publicKey, data) {
  const transactionDates = await GetTransactionsByAddress(connection, publicKey);
  const holderData = { };
  for (const [collectionIdx, value] of Object.entries(data)) {
    let holdingStartDate = undefined;
    for (let mint of value.mints) {
      const mintAcquisitionDate = transactionDates.get(mint)?.date;
      if (mintAcquisitionDate !== undefined && (holdingStartDate === undefined || mintAcquisitionDate < (holdingStartDate))) {
        holdingStartDate = mintAcquisitionDate;
      }
    }
    holderData[collectionIdx] = {
      amount: value.amount,
      mints: value.mints,
      holdingStartDate,
    };
  }
  return {
    publicKey,
    data: holderData,
  }
}

/// Returns an observable of HolderData.
///
/// Inputs: 
/// @mintIds corresponds to an array of token collections. 
///
/// Any wallet (public key) that holds a non-zero balance of a token in any collection is 
/// included as a key in HolderData. For each wallet, the data about it's
/// holdings for each collection is stored in HolderData[wallet][collectionIdx]
///
/// Data is fetched in map-reduce fashion:
/// 1. Map each mint id in mintIds to it's corresponding owner.
/// 2. Reduce Step 1 into an array of owners, and aggregate all mint IDs by owner.
/// 3. Map each owner to additional owner metadata.
/// 4. Reduce step 3 into an array of owners, with Mint Ids from 2 and additional owner metadata from 3.
const GetHolderData = async (mintIds) => {
  const connection = getConnection();

  const preHolderSnapshotPromises = [];
  mintIds.forEach((mintList, idx) => 
    mintList.forEach((id) => 
      preHolderSnapshotPromises.push(GetHolderSnapshot(connection, id, idx))
    )
  );
  const preHolderSnapshots = await Promise.allSettled(preHolderSnapshotPromises);

  
  const holderSnapshots = preHolderSnapshots.reduce((acc, promise) => {
    /// TODO: handle the case where the value is rejected instead of fullfilled.
    if (promise.status == 'fulfilled') {
      for (let holder of promise.value) {
        const pk = holder.publicKey;
        if (!acc[pk]) {
          acc[pk] = {};
        }
        if (!acc[pk][holder.collectionIdx]) {
          acc[pk][holder.collectionIdx] = {
            amount: holder.amount,
            mints: [holder.mint],
          };
        } else {
          let obj = acc[pk][holder.collectionIdx];
          acc[pk][holder.collectionIdx] = {
            amount: obj.amount + holder.amount,
            mints: [...obj.mints, holder.mint],
          };
        }
      }
    }
    return acc;
  }, {});

  const holderSnapshotsWithDataPromises = [];
  Object.keys(holderSnapshots).map(function(publicKey, ) {
    holderSnapshotsWithDataPromises.push(GetHolderTransactionData(connection, publicKey, holderSnapshots[publicKey]));
  });

  const holderSnapshotsWithData = await Promise.allSettled(holderSnapshotsWithDataPromises);

  const holderData = {};
  holderSnapshotsWithData.forEach(holder => {
    if (holder.status == 'fulfilled') {
      holderData[holder.value.publicKey] = holder.value.data;
    }
  });

  return holderData;
};

module.exports = { GetHolderData };