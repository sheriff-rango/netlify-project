const express = require("express");

const { getTokenLists, getTokenHistory, getComplexProtocolLists } = require('../../utils/index.js');

const router = express.Router();
    
router.get('/wallet/:id', async (req, res) => {

    await Promise.all([getTokenLists(req.params.id), getComplexProtocolLists(req.params.id)]).then(result => {
        res.send({tokens: result[0].concat(result[1])});
    }).catch(e => { res.send({tokens: []}); })

});

router.get('/wallet/:id/token_history', function(req, res) {
    const data = req.query;
    const _walletAddress = (req.params.id || '').toLowerCase();
    const _inputTokenAddress = (data.token || '').toLowerCase();
    const _chain = data.chain;
    const _block = data.blockheight;
    if (!_walletAddress || !_inputTokenAddress || !_chain) res.send({err: 'Input error'});
    getTokenHistory(_chain, _walletAddress, _inputTokenAddress, _block, _block, 1, 0)
    .then((result) => {
        res.send({
            history: result
        });
    })
    // .catch((err) => {
    //     res.send({
    //         err: 'Something error'
    //     });
    // })
});
// router.get('/:id/:offset/:limit', async (req, res) => {
//     const offset = parseInt(req.params.offset)
//     const limit = parseInt(req.params.limit)

//     const chains = await axios.get("https://openapi.debank.com/v1/chain/list")//, axios.get("https://chainid.network/chains.json")])

//     const url = baseurl + "user/token_list?id=" + req.params.id + "&is_all=false&has_balance=true"
//     const response = await axios.get(url)

//     const data = response.data.sort((a, b) => b.price * b.amount - a.price * a.amount)

//     var tokens = []

//     try {
//         for (i = offset; i < offset + limit; i++) {
//             const element = data[i]
//             var token = {}
//             const chain = chains.data.filter(ele => ele.id == element.chain)[0]            
//             token.chain = chain.name
//             token.chain_id = chain_ids[element.chain]
//             token.chain_logo = chain.logo_url
//             token.type = "Wallet"
//             token.protocol = element.protocol_id
//             token.assets = [{
//                 "id": element.id,
//                 "ticker": element.symbol,
//                 "logo": element.logo_url
//             }]
//             token.units = element.amount
//             token.cost = element.price
//             token.value = element.price * element.amount

//             tokens.push(token)
//         }
//     } catch (e) {
//         console.log(e)
//     }
    
//     return res.status(200).json({ "total": data.length, "offset": offset, "count": tokens.length, "positions": tokens });
// });

// router.get('/:id/:net', async (req, res) => {
//     const url = baseurl + "user/token_list?id=" + req.params.id + "&is_all=true&has_balance=true&chain_id=" + req.params.net
//     const response = await axios.get(url)

//     const data = response.data.filter(ele => ele.is_wallet == true).sort((a, b) => b.price * b.amount - a.price * a.amount)

//     return res.status.json({ "count": data.length, "data": data });
// });

module.exports = router;