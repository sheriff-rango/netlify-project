const Moralis = require('moralis/node');
const { exit } = require('process');
const express = require("express");
const cors = require("cors");

const serverUrl = 'https://8dyuriovbupo.usemoralis.com:2053/server';
const appId = 'rLSZFQmw1hUwtAjRnjZnce5cxu1qcPJzy01TuyU1';

// const serverUrl = 'https://ea4ql61igwkq.usemoralis.com:2053/server';
// const appId = 'ayFgiTCfWrFcBtgXqvwiLJQqSlGbnxYezYipOJQx';
let history = null;

const app = express();
app.use(cors());
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at (http://localhost:${PORT}`);
});
app.get('/', function(req, res) {
  res.send({result,})
})

console.log('moralis starting...')
Moralis.start({ serverUrl, appId })
.then(() => {
  console.log('moralis successfully started');
  getWalletCostBasis(testData)
  .then((result) => {
    console.log('final result', result);
    history = result;
    exit(1);
  })
  .catch((e) => {
    console.log('get wallet cost basis error', e);
    // history = 'get wallet cost basis error';
    history = {
      message: 'get wallet cost basis error',
      error: e
    };
    exit(1);
  });
})
.catch((e) => {
  console.log('moralis start error', e);
  // history = 'moralis start error';
    history = {
      message: 'moralis start error',
      error: e
    };
  exit(1);
});


// common data
const chainCoins = {
  polygon: {
    name: 'Wrapped Matic',
    decimals: 18,
    symbol: 'WMATIC',
    address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  },
  eth: {
    name: 'Wrapped Ether',
    decimals: 18,
    symbol: 'WETH',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  bsc: {
    name: 'Wrapped BNB',
    decimals: 18,
    symbol: 'WBNB',
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  },
};

let testData = {
  wallet: '0x704111eDBee29D79a92c4F21e70A5396AEDCc44a',
  token: '0x510d776fea6469531f8be69e669e553c0de69621',
  blockheight: 20138207,
  chain: 'polygon',
};

function sortBlockNumber_reverseChrono(a, b) {
  if (a.block_number > b.block_number) {
    return -1;
  }
  if (a.block_number < b.block_number) {
    return 1;
  }
  return 0;
}

// Moralis functions
async function getTokenMetadata(_chain, _tokenAddresses) {
  let options;
  try {
    var page = 0, tokenMetadata = [], result;
    while (page < Math.ceil(_tokenAddresses.length / 10)) {
      options = {
        chain: _chain,
        addresses: _tokenAddresses.splice(0, 10)
      }
      result = await Moralis.Web3API.token.getTokenMetadata(options);
      console.log('token meta data', result.total)
      tokenMetadata = tokenMetadata.concat(result);
      page++;
    }
    return tokenMetadata;
  } catch (e) {
    console.log('get token meta data error', e);
  // history = 'get token meta data error';
    history = {
      message: 'get token meta data error',
      error: e
    };
    return null;
  }
}

async function getTransactions(_chain, _tokenAddress, _toBlock) {
  let options = {
    chain: _chain,
    address: _tokenAddress,
    order: 'desc',
    offset: 0
  };
  if (_toBlock) options.to_block = _toBlock;
  try {
    const result = await Moralis.Web3API.account.getTransactions(options);
    console.log('transaction', result.total)
    if (Number(result.total) > 500) {
      let page = 1, txFunctions = [], mergeResult = result.result;
      while (page < Math.ceil(result.total / 500)) {
        options.offset = page * 500;
        txFunctions.push(Moralis.Web3API.account.getTransactions(options));
        if (page % 1 === 0) {
          await Promise.all(txFunctions).then(results => {
            results.map(each => {
              mergeResult = mergeResult.concat(each.result);
            })
          }).catch(e => console.log(e))
          txFunctions = [];
        }
        page++;
      }
      if (txFunctions.length) {
        await Promise.all(txFunctions).then(results => {
          results.map(each => {
            mergeResult = mergeResult.concat(each.result);
          }) 
          return mergeResult;
        }).catch(e => console.log(e))
      } else return mergeResult;
    }
    else return result.result;
    return result.result;
  } catch (e) {
    console.log('get transactions error', e);
    // history = 'get transactions error';
    history = {
      message: 'get transactions error',
      error: e
    };
    return null;
  }
}

async function getTokenPrice(_chain, _address, _toBlock) {
  const options = { address: _address, chain: _chain, to_block: _toBlock };
  try {
    return await Moralis.Web3API.token.getTokenPrice(options);
  } catch (e) {
    return null;
  }
}

async function getTokenBalances(_chain, _address, _toBlock) {
  let options = {
    chain: _chain,
    address: _address
  };
  if (_toBlock) options.to_block = _toBlock;
  try {
    // console.log('get token balances', Moralis.Web3API.account);
    const getTokenBalancesResult = await Moralis.Web3API.account.getTokenBalances(options);
    // console.log('get token balances result', getTokenBalancesResult);
    return getTokenBalancesResult;
  } catch (e) {
    console.log('get token balances error', e);
    history = {
      message: 'get token balances error',
      error: e
    };
    return null;
  }
}

async function getTokenTransfers(_chain, _address, _toBlock) {
  let options = {
    address: _address,
    chain: _chain,
    offset: 0
  };
  if (_toBlock) options.to_block = _toBlock;
  try {
    const result = await Moralis.Web3API.account.getTokenTransfers(options);
    console.log('get token transfer result', result.total);
    if (Number(result.total) > 500) {
      let page = 1, transferFunctions = [], mergeResult = result.result;
      while (page < Math.ceil(result.total / 500)) {
        options.offset = page * 500;
        transferFunctions.push(Moralis.Web3API.account.getTokenTransfers(options));
        if (page % 1 === 0) {
          await Promise.all(transferFunctions).then(results => {
            results.map(each => {
              mergeResult = mergeResult.concat(each.result);
            })
          }).catch(e => console.log(e))
          transferFunctions = [];
        }
        page++;
      }
      if (transferFunctions.length) {
        await Promise.all(transferFunctions).then(results => {
          results.map(each => {
            mergeResult = mergeResult.concat(each.result);
          }) 
          return mergeResult;
        }).catch(e => console.log(e))
      } else return mergeResult;
    }
    else return result.result;
  } catch (e) {
    console.log('get token transfers error', e);
    history = {
      message: 'get token transfer error',
      error: e
    };
    return null;
  }
}

// main function
async function getWalletCostBasis(data) {
  let returnData = [];

  //Get global data
  await Promise.all([
    getTokenBalances(data.chain, data.wallet.toLowerCase(), data.blockheight),
    getTokenTransfers(data.chain, data.wallet.toLowerCase(), data.blockheight),
    getTransactions(data.chain, data.wallet.toLowerCase(), data.blockheight),
  ]).then((result) => {
    global_balances = result[0];
    global_transfers = result[1];
    global_tx = result[2];
  });

  //Copy native transfers to ERC20 transfers
  native_xfers = global_tx.filter((xfer) => xfer.value > 0);
  for (let i = 0; i < native_xfers.length; i++) {
    const tx = native_xfers[i];
    global_transfers.push({
      address: chainCoins[data.chain].address, //token address = wmatic
      block_hash: tx.block_hash,
      block_number: tx.block_number,
      block_timestamp: tx.block_timestamp,
      from_address: tx.from_address,
      to_address: tx.to_address,
      transaction_hash: tx.hash,
      value: tx.value, //tx value
      gas: tx.gas,
      gas_price: tx.gas_price
    });
  }

  //Sort global_transfers reverse-chronological by block_number
  global_transfers = global_transfers.sort(sortBlockNumber_reverseChrono);

  //Get token metadata
  var token_list = global_transfers.map((xfer) => xfer.address);
  token_list.push(chainCoins[data.chain].address); //add native token
  token_list = Array.from(new Set(token_list)); //de-dupe
  console.log('token list', token_list.length)
  global_token_meta = await getTokenMetadata(data.chain, token_list);

  //If token specified in request, just do that token instead of the whole wallet
  if (data.token) {
    global_balances = global_balances.filter((each) => each.token_address == data.token);
  }

  //Run cost basis for illiquid tokens
  //TODO: Make this loop asynchronous using Promise.allSettled
  for (let i = 0; i < global_balances.length; i++) {
    global_balances[i].usdPrice = null;
    console.log('global balances', global_balances[i])
    const tokenHistory = await getTokenCostBasis(
      data.chain,
      data.blockheight,
      data.wallet.toLowerCase(),
      {
        ...global_balances[i],
        address: global_balances[i].token_address
      },
      global_balances[i].balance / 10 ** global_balances[i].decimals,
      1,
      {}
    );
    returnData = returnData.concat(tokenHistory.history);
  }

  return returnData.reverse();
}

async function getTokenCostBasis(chain, blockheight, wallet, token, balance, hierarchy_level, parent_transaction) {
  console.log('Cost basis for: Token:' + token.address + ' Block:' + blockheight + ' balance: ' + balance);

  // initialize cost_basis and balance
  let cost_basis = 0, current_balance = balance, newHistory = [];

  // get token meta data
  const token_meta = global_token_meta.filter((meta) => meta.address == token.address)[0];
  // console.log('token meta', token_meta);

  // get native price
  const native_price = await getTokenPrice(chain, chainCoins[chain].address, blockheight);
  console.log('native price', native_price);

  // confirm wether token is valued or not
  let price = await getTokenPrice(chain, token.address, blockheight);
  console.log('price', price);
  if (price) {
    cost_basis = balance * price.usdPrice;
    newHistory.push({
      units: token.value / 10 ** (token_meta.decimals || 18),
      transaction_id: parent_transaction.transaction_hash,
      datetime: parent_transaction.block_timestamp,
      token_id: token.address,
      token_name: token_meta.name,
      fee_native_coin: 'MATIC',
      cost_basis,
      hierarchy_level,
      valued_directly: true,
    })
    console.log('Token: ' + token.address + ' Cost= ' + cost_basis);
    return {cost_basis, history: newHistory};
  }

  // retrieve list of token transactions to/from wallet, prior to block
  const token_transactions = global_transfers.filter((xfer) => xfer.address == token.address && xfer.used == undefined);
  console.log('token transactions', token_transactions.length);

  // process token transactions in reverse chronological order is skipped because global_transfers is already in that form

  // For each transactions
  for (let i = 0; i < token_transactions.length; i++) {
    const transaction = token_transactions[i];
    console.log('transaction', transaction);

    const transaction_detail = global_tx.filter((tx) => tx.hash === transaction.transaction_hash)[0] || {};

    // confirm whether token is received or not
    let isReceived = true;
    if (transaction.from_address.toLowerCase() == wallet) {
      isReceived = false; //from my wallet. debit outflow
    } else if (transaction.to_address.toLowerCase() == wallet) {
      isReceived = true; //to my wallet. credit inflow
    } else {
      console.log('Error: wallet address ' + wallet + ' not found in transaction ' + transaction.transaction_hash);
      continue;
    }

    //calculate the balance of token in wallet, just before transaction.
    const units_of_token = transaction.value / 10 ** (token_meta.decimals || 18);
    current_balance = current_balance + (isReceived? -1 : 1) * units_of_token;
    console.log('current balance', current_balance);

    // calculate the cost basis of current transaction
    const offsetting_coins = global_transfers.filter((xfer) =>
      xfer.transaction_hash == transaction.transaction_hash &&
      xfer.used == undefined &&
      (isReceived? (xfer.from_address.toLowerCase() == wallet) : (xfer.to_address.toLowerCase() == wallet))
    );

    // console.log('offsetting coins', offsetting_coins.length);
    
    for (let i = 0; i < offsetting_coins.length; i++) {
      let offsetting_coin = offsetting_coins[i];
      // console.log('offsetting coin', offsetting_coin);
      offsetting_coin.used = true;
      const coin_meta = global_token_meta.filter((t) => t.address == offsetting_coin.address)[0];
      const balance_of_offsetting_coin = offsetting_coin.value / 10 ** (coin_meta.decimals || 18);
      const getTokenCostBasisResult = await getTokenCostBasis(
        chain,
        offsetting_coin.block_number,
        wallet,
        offsetting_coin,
        balance_of_offsetting_coin,
        hierarchy_level + 1,
        transaction,
      );
      cost_basis = cost_basis + (isReceived? 1 : -1) * getTokenCostBasisResult.cost_basis;
      newHistory = newHistory.concat(getTokenCostBasisResult.history);
    }
    const fee_native_units = transaction_detail.gas * transaction_detail.gas_price / 10 ** (token_meta.decimals || 18);
    newHistory.push({
      units: transaction.value / 10 ** (token_meta.decimals || 18),
      transaction_id: transaction.transaction_hash,
      datetime: transaction.block_timestamp,
      token_id: token.address,
      token_name: token_meta.name,
      fee_native_coin: 'MATIC',
      fee_native_units,
      fee_usd: fee_native_units * native_price.usdPrice,
      cost_basis,
      hierarchy_level,
      valued_directly: false,
    })
    
    // ********* STOP CONDITION *********
    if (current_balance <= 0) break;
  }
  
  return {cost_basis, history: newHistory};
}