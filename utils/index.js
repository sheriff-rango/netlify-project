const axios = require('axios');
const Moralis = require('moralis/node');

const { chain_details, transfer_topic, per_cycle, debank_baseurl } = require('./constant.js')

const serverUrl = 'https://8dyuriovbupo.usemoralis.com:2053/server';
const appId = 'rLSZFQmw1hUwtAjRnjZnce5cxu1qcPJzy01TuyU1';
Moralis.start({ serverUrl, appId });

// Moralis functions

async function getTokenMetadata (_chain, _tokenAddress) {
    const options = { chain: _chain, addresses: _tokenAddress };
    return await Moralis.Web3API.token.getTokenMetadata(options);
}

async function getTransactions (_chain, _tokenAddress, _fromBlock, _toBlock) {
    const options = { chain: _chain, address: _tokenAddress, order: 'desc', from_block: _fromBlock, to_block: _toBlock };
    return await Moralis.Web3API.account.getTransactions(options);
}

async function getTransactionDetails (_chain, _transactionHash) {
    const options = { chain: _chain, transaction_hash: _transactionHash };
    return await Moralis.Web3API.native.getTransaction(options);
}

async function runContractFunction (_chain, _contractAddress, _functionName, _abi, _params) {
    const options = { chain: _chain, address: _contractAddress, function_name: _functionName, abi: _abi, params: _params };
    let result;
    try {
        result = await Moralis.Web3API.native.runContractFunction(options);
    } catch (e) {
        result = null;
    }
    return result;
}

async function getLogsByAddress (_chain, _address, _fromBlock, _toBlock) {
    const options = { address: _address, chain: _chain, from_block: _fromBlock, to_block: _toBlock };
    return await Moralis.Web3API.native.getLogsByAddress(options);
}

async function getTokenPrice (_chain, _address, _toBlock) {
    const options = { address: _address, chain: _chain, to_block: _toBlock };
    try {
        return await Moralis.Web3API.token.getTokenPrice(options);
    } catch (e) {
        return null;
    }
}

function getAddress(topic) {
    if (topic === null || topic === '') return '';
    return '0x'+topic.substring(topic.length - 40);
}

async function getBlockHeight(_chain, _date) {
    const options = {
        chain: _chain,
        date: _date
    };
    return await Moralis.Web3API.native.getDateToBlock(options);
}

const getTokenLists = async (walletAddress) => {

    const response = await axios.get(`${debank_baseurl}user/token_list?id=${walletAddress}&is_all=false&has_balance=true`);
    const data = response.data;
    var tokens = [];
    data.forEach(element => {
        var token = {};
        const chain = chain_details[element.chain];
        token.chain = chain.name;
        token.chain_id = chain.community_id;
        token.chain_logo = chain.logo_url;
        token.type = "Wallet";
        token.protocol = element.protocol_id;
        token.assets = [{
            "id": element.id,
            "ticker": element.symbol,
            "logo": element.logo_url
        }];
        token.units = element.amount;
        token.cost = element.price;
        token.value = element.price * element.amount;

        tokens.push(token);
    });

    return tokens;
}

const getTokenBalances = async (_chain, address) => {
    const options = { chain: _chain, address: address }
    const balances = await Moralis.Web3API.account.getTokenBalances(options);
    return balances
}

const getComplexProtocolLists = async (address) => {
    const response = await axios.get(`${debank_baseurl}user/complex_protocol_list?id=${address}`);
    const data = response.data;
    var protocols = [];
    var returnData = [];
    for (let i = 0; i < data.length; i++) {
        let site = data[i];
        protocols = protocols.concat(site.portfolio_item_list.map((element) => {
            var protocol = {};
            const chain = chain_details[site.chain];
            protocol.chain = chain.name;
            protocol.chain_id = chain.community_id;
            protocol.chain_logo = chain.logo_url;
            protocol.type = element.name;
            protocol.protocol = '';
            var token_list = element.detail.supply_token_list || element.detail.token_list || [element.detail.token];
            protocol.assets = token_list.map(each => {
                return {
                    "id": each.id,
                    "ticker": each.symbol,
                    "logo": each.logo_url
                }
            });
            protocol.units = element.tvl;
            protocol.cost = '';
            protocol.value = element.stats.net_usd_value;
            // if (protocol.type === 'Yield') {
            //     protocol.history = await getTokenHistory(protocol.chain, address, )
            // }
            return protocol;
        }))
    }

    await Promise.all(protocols).then((result) => {returnData = result}).catch(e => { console.log('complex protocol list error') });
    return returnData;
}


const getTokenHistory = async (_chain, _wallet, _token, _startBlock, _endBlock, hierarchy_level, units) => {

    if (!_endBlock) {
        const currentBlock = await getBlockHeight(_chain, new Date()).catch((e) => console.log('get current block height error'));
        _endBlock = currentBlock.block;
    }

    let allPoolTokenLogs, walletLogs, tokenTransactionLists = [], tokenMetadata, tokenPrice, tokenTransaction, transactionDetail, returnData = [], coinPrice, currentBlock = _endBlock > _startBlock + per_cycle ? _endBlock - per_cycle : _startBlock, relatedTokens = [], relatedTokensPrice, relatedTokensMetadata, cost_basis = 0, prevHistory, stopLoop = false;

    returnData.push({
        hierarchy_level: hierarchy_level,
        transaction_id: null,
        datetime: null,
        token_id: null,
        token_name: null,
        units: null,
        fee_usd: null,
        fee_native_coin: null,
        fee_native_units: null,
        cost_basis: null
    })

    
    while (currentBlock >= _startBlock) {

        if (stopLoop) break;

        // get all token transactions, token price in certain block, token metadata
        await Promise.all([getLogsByAddress(_chain, _token, currentBlock, _endBlock), getTokenMetadata(_chain, _token)]).then(result => {
            allPoolTokenLogs = result[0].result;
            tokenMetadata = result[1][0];
        }).catch((e) => console.log('get logs by address error', e));

        // get all wallet-poolToken transactions in certain block
        walletLogs = allPoolTokenLogs ? allPoolTokenLogs.filter(each => getAddress(each.topic1) === _wallet || getAddress(each.topic2) === _wallet) : [];

        tokenTransactionLists = []

        for (let k = walletLogs.length - 1; k >= 0; k--) {
            if (tokenTransactionLists.find(each => each.transaction_hash) !== walletLogs[k].transaction_hash) tokenTransactionLists.push(walletLogs[k]);
        }

        for (let i = 0; i < tokenTransactionLists.length; i++) {

            if (stopLoop) break;

            tokenTransaction = tokenTransactionLists[i];

            await Promise.all([getTokenPrice(_chain, _token, tokenTransaction.block_number), getTransactionDetails(_chain, tokenTransaction.transaction_hash), getTokenPrice(_chain, chain_details[_chain].wrapped_token.address, tokenTransaction.block_number)]).then((result) => {
                tokenPrice = result[0];
                transactionDetail = result[1];
                coinPrice = result[2];

            }).catch((e) => console.log('get token price and details error'));

            returnData[0].transaction_id = transactionDetail.hash;
            returnData[0].datetime = transactionDetail.block_timestamp;
            returnData[0].token_id = _token;
            returnData[0].token_name = tokenMetadata.name;
            returnData[0].fee_native_coin = chain_details[_chain].wrapped_token.symbol;
            returnData[0].fee_native_units = (transactionDetail.gas_price * transactionDetail.receipt_gas_used) / Math.pow(10, chain_details[_chain].wrapped_token.decimals);
            returnData[0].fee_usd = (transactionDetail.gas_price * transactionDetail.receipt_gas_used) / Math.pow(10, chain_details[_chain].wrapped_token.decimals) * coinPrice.usdPrice;

            cost_basis += (transactionDetail.gas_price * transactionDetail.receipt_gas_used) / Math.pow(10, chain_details[_chain].wrapped_token.decimals) * coinPrice.usdPrice;

            if (units === 0) stopLoop = true;

            if (tokenPrice === null) {

                transactionDetail.logs.map((log) => {

                    if (log.address === _token && getAddress(log.topic2) === _wallet && log.topic0 === transfer_topic) {
                        returnData[0].units = parseInt(log.data, 16) / (Math.pow(10, tokenMetadata.decimals));
                        if (units) {
                            units += returnData[0].units;
                            if (units === 0) stopLoop = true;
                        }
                    }

                    if (log.address === _token && getAddress(log.topic1) === _wallet && log.topic0 === transfer_topic) {
                        returnData[0].units = 0 - parseInt(log.data, 16) / (Math.pow(10, tokenMetadata.decimals));
                        if (units) {
                            units += returnData[0].units;
                            if (units === 0) stopLoop = true;
                        }
                    }

                    if ((getAddress(log.topic2) === _token && log.topic0 === transfer_topic) || (getAddress(log.topic1) === _token && log.topic0 === transfer_topic)) {
                        relatedTokens.push({
                            address: log.address, units: getAddress(log.topic1) === _token ? parseInt(log.data, 16) : 0 - parseInt(log.data, 16)
                        });
                    }

                })

                if (returnData[0].units) relatedTokens = relatedTokens.filter(each => (returnData[0].units > 0 && each.units < 0) || (returnData[0].units < 0 && each.units > 0));

                if (hierarchy_level === 1 && returnData[0].units < 0) return [];

                // console.log(returnData)

                if (relatedTokens.length) {
                    await Promise.all(relatedTokens.map(each => getTokenPrice(_chain, each.address, transactionDetail.block_number))).then(result => {
                        relatedTokensPrice = result;
                    })
                    await getTokenMetadata(_chain, relatedTokens.map(each => each.address)).then(result => {
                        relatedTokensMetadata = result;
                    })
                    for (let j = 0; j < relatedTokensPrice.length; j++) {

                        if (relatedTokensPrice[j] !== null) {
                            returnData.push({
                                hierarchy_level: hierarchy_level + 1,
                                transaction_id: transactionDetail.hash,
                                datetime: transactionDetail.block_timestamp,
                                token_id: relatedTokens[j].address,
                                token_name: relatedTokensMetadata[j].name,
                                units: relatedTokens[j].units / (Math.pow(10, relatedTokensMetadata[j].decimals)),
                                fee_usd: returnData[0].fee_usd,
                                fee_native_coin: chain_details[_chain].wrapped_token.symbol,
                                fee_native_units: returnData[0].fee_native_units,
                                cost_basis: Math.abs(relatedTokens[j].units) / (Math.pow(10, relatedTokensMetadata[j].decimals)) * relatedTokensPrice[j].usdPrice
                            })
                            cost_basis += Math.abs(relatedTokens[j].units) / (Math.pow(10, relatedTokensMetadata[j].decimals)) * relatedTokensPrice[j].usdPrice
                            // console.log(returnData)
                        } else {
                            prevHistory = await getTokenHistory(_chain, _wallet, relatedTokens[j].address, 1, Number(transactionDetail.block_number) - 1, hierarchy_level + 1, relatedTokens[j].units / (Math.pow(10, relatedTokensMetadata[j].decimals)));

                            cost_basis += prevHistory[0].cost_basis;
                            returnData = returnData.concat(prevHistory);
                        }

                    }
                }

            } else {
                transactionDetail.logs.map((log) => {

                    if (log.address === _token && getAddress(log.topic2) === _wallet && getAddress(log.topic3) === '') {
                        returnData[0].units = parseInt(log.data, 16) / (Math.pow(10, tokenMetadata.decimals));
                    }

                    if (log.address === _token && getAddress(log.topic1) === _wallet && getAddress(log.topic2) !== '' && getAddress(log.topic3) === '') {
                        returnData[0].units = 0 - parseInt(log.data, 16) / (Math.pow(10, tokenMetadata.decimals));
                    }

                    returnData[0].cost_basis = returnData[0].units * tokenPrice + returnData[0].fee_usd;
                })
            }
        }

        _endBlock = currentBlock - 1;
        if (_endBlock < _startBlock) break;

        currentBlock = _endBlock > _startBlock + per_cycle ? _endBlock - per_cycle : _startBlock;
    }

    returnData[0].cost_basis = cost_basis;

    return returnData;
}

module.exports = { getTokenLists, getTokenHistory, getTokenBalances, getComplexProtocolLists };
