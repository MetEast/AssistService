const cookieParser = require("cookie-parser");
const res = require("express/lib/response");
const {MongoClient} = require("mongodb");
const config = require("../config");

module.exports = {
    getLastStickerSyncHeight: async function () {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token_event');
            let doc = await collection.findOne({}, {sort:{blockNumber: -1}});
            if(doc) {
                return doc.blockNumber
            } else {
                return config.stickerContractDeploy - 1;
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },
    verifyEvents: function(result) {
        for(var i = 0; i < result.length; i++) {
            if(result[i]['event'] == "notSetYet") {
                if(result[i]['from'] == '0x0000000000000000000000000000000000000000') {
                    result[i]['event'] = 'Mint';
                }
                if(result[i]['to'] == '0x0000000000000000000000000000000000000000') {
                    result[i]['event'] = 'Burn';
                }
                if(result[i]['from'] != '0x0000000000000000000000000000000000000000' && result[i]['to'] != '0x0000000000000000000000000000000000000000') {
                    if(result[i]['price'] == '')
                        result[i]['event'] = 'SafeTransferFrom';
                    else result[i]['event'] = 'SafeTransferFromWithMemo';
                }
                result[i]['price'] = '0';
            }
            if(result[i]['event'] == 'OrderFilled')
                result[i]['event'] = "BuyOrder";
            if(result[i]['event'] == 'OrderCanceled')
                result[i]['event'] = "CancelOrder";
            if(result[i]['event'] == 'OrderPriceChanged')
                result[i]['event'] = "ChangeOrderPrice";
            if(result[i]['event'] == 'OrderForSale')
                result[i]['event'] = "CreateOrderForSale";
        }
        return result;
    },
    composeMethodCondition: function(method, requestType, data) {
        let methodCondition = [];
        switch(method)
        {
            case "Mint":
                methodCondition.push({'from': "0x0000000000000000000000000000000000000000"});
                if(requestType == "walletAddr")
                    methodCondition.push({'to': data});
                methodCondition.push({'event': 'notSetYet'});
                break;
            case 'SafeTransferFrom':
                if(requestType == "walletAddr")
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                else {
                    methodCondition.push({'from': {$ne: "0x0000000000000000000000000000000000000000"}});
                    methodCondition.push({'to': {$ne: "0x0000000000000000000000000000000000000000"}});   
                }
                methodCondition.push({'event': 'notSetYet'});
                break;
            case 'SafeTransferFromWithMemo':
                if(requestType == "walletAddr")
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                else {
                    methodCondition.push({'from': {$ne: "0x0000000000000000000000000000000000000000"}});
                    methodCondition.push({'to': {$ne: "0x0000000000000000000000000000000000000000"}});   
                }                
                methodCondition.push({'event': 'notSetYet'});
                methodCondition.push({'price': {$ne: ''}});
                break;
            case 'Burn':
                methodCondition.push({'to': "0x0000000000000000000000000000000000000000"});
                if(requestType == "walletAddr")
                    methodCondition.push({'from': data});
                methodCondition.push({'event': 'notSetYet'});
                break;
            case 'BuyOrder':
                methodCondition.push({'event': "OrderFilled"});
                if(requestType == 'walletAddr')
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                break;
            case 'CreateOrderForSale':
                methodCondition.push({'event': 'OrderForSale'});
                if(requestType == 'walletAddr')
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                break;
            case 'CancelOrder':
                methodCondition.push({'event': 'OrderCanceled'});
                if(requestType == 'walletAddr')
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                break;
            case 'ChangeOrderPrice':
                methodCondition.push({'event': 'OrderPriceChanged'});
                if(requestType == 'walletAddr')
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                break;
            case 'All':
                if(requestType == 'walletAddr')
                    methodCondition.push({$or: [{'from': data}, {'to': data}]});
                else methodCondition.push({'event': {$ne: 'All'}});
                break;
        }
        return methodCondition;
    },
    listStickers: async function(pageNum, pageSize) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('pasar_token');
            let total = await collection.find().count();
            let result = await collection.find().sort({createTime: -1})
                .project({"_id": 0}).limit(pageSize).skip((pageNum-1)*pageSize).toArray();
            return {code: 200, message: 'success', data: {total, result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    addEvent: async function(transferEvent) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('pasar_token_event');
            await collection.insertOne(transferEvent);
        } catch (err) {
            logger.error(err);
        } finally {
            await client.close();
        }
    },

    replaceEvent: async function(transferEvent) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let {tokenId, blockNumber} = transferEvent
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('pasar_token_event');
            await collection.replaceOne({tokenId, blockNumber}, transferEvent, {upsert: true});
        } catch (err) {
            logger.error(err);
        } finally {
            await client.close();
        }
    },

    burnToken: async function (tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token');
            await collection.updateOne({tokenId}, {$set: {
                    royaltyOwner: '0x0000000000000000000000000000000000000000',
                    holder: '0x0000000000000000000000000000000000000000'
                }});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    replaceToken: async function (token) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token');
            await collection.replaceOne({tokenId: token.tokenId}, token, {upsert: true});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    replaceGalleriaToken: async function (token) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token_galleria');
            await collection.replaceOne({tokenId: token.tokenId}, token, {upsert: true});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateToken: async function (tokenId, holder, timestamp) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token');
            await collection.updateOne({tokenId, updateTime: {"$lt": timestamp}}, {$set: {holder, updateTime: timestamp}});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    search: async function(keyword) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('pasar_token');
            let result = await collection.find({$or: [{tokenId: keyword}, {royaltyOwner: keyword}, {name: {$regex: keyword}}, {description: {$regex: keyword}}]}).project({"_id": 0}).toArray();
            return {code: 200, message: 'success', data: {result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    query: async function(owner, creator, types) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let collection = client.db(config.dbName).collection('pasar_token_event');

            let match = {}, result;
            if(owner) {
                match["to"] = owner;
            }
            if(creator) {
                match["token.royaltyOwner"] = creator;
            }

            if(types !== undefined) {
                match['token.type'] = { "$in": types };
            }

            if(types !== undefined && types[0] === 'feeds-chanel') {
                result = await collection.aggregate([
                    { $sort: {tokenId: 1, blockNumber: -1}},
                    { $group: {_id: "$tokenId", doc: {$first: "$$ROOT"}}},
                    { $replaceRoot: { newRoot: "$doc"}},
                    { $lookup: {from: "pasar_token_galleria", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                    { $unwind: "$token"},
                    { $match: {...match}},
                    { $project: {"_id": 0, tokenId:1, blockNumber:1, timestamp:1, value: 1,memo: 1, to: 1, holder: "$to",
                            tokenIndex: "$token.tokenIndex", quantity: "$token.quantity", royalties: "$token.royalties",
                            royaltyOwner: "$token.royaltyOwner", createTime: '$token.createTime', tokenIdHex: '$token.tokenIdHex',
                            name: "$token.name", description: "$token.description", type: "$token.type", tippingAddress: "$token.tippingAddress",
                            entry: "$token.entry", avatar: "$token.avatar", tokenDid: "$token.did", version: '$token.tokenJsonVersion'}}
                ]).toArray();
            } else {
                result = await collection.aggregate([
                    { $sort: {tokenId: 1, blockNumber: -1}},
                    { $group: {_id: "$tokenId", doc: {$first: "$$ROOT"}}},
                    { $replaceRoot: { newRoot: "$doc"}},
                    { $lookup: {from: "pasar_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                    { $unwind: "$token"},
                    { $match: {...match}},
                    { $project: {"_id": 0, tokenId:1, blockNumber:1, timestamp:1, value: 1,memo: 1, to: 1, holder: "$to",
                            tokenIndex: "$token.tokenIndex", quantity: "$token.quantity", royalties: "$token.royalties",
                            royaltyOwner: "$token.royaltyOwner", createTime: '$token.createTime', tokenIdHex: '$token.tokenIdHex',
                            name: "$token.name", description: "$token.description", kind: "$token.kind", type: "$token.type",
                            thumbnail: "$token.thumbnail", asset: "$token.asset", size: "$token.size", tokenDid: "$token.did",
                            adult: "$token.adult"}}
                ]).toArray();

                let tokenIds = [];
                result.map(item => tokenIds.push(item.tokenId));
            }
            return {code: 200, message: 'success', data: {result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    stickerCount: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token');
            return await collection.find({}).count();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    stickerOrderEventCount: async function(startBlock, endBlock) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token_event');
            return await collection.find({blockNumber: {$gte: startBlock, $lte: endBlock}}).count();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    tokenTrans: async function(tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token_event');
            return await collection.find({tokenId}).sort({blockNumber: -1}).toArray();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },
    
    listTrans: async function(pageNum, pageSize, method, timeOrder) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "null", "null");
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_event');
            let result = await collection.aggregate([
                {   $facet: {
                    "collection1": [
                        { $limit: 1 },
                        { $lookup: {
                            from: "pasar_order_event",
                            pipeline: [
                                { $lookup : {from: 'pasar_order', localField: 'orderId', foreignField: 'orderId', as: 'order'} },
                                { $unwind : "$order" },
                                { $project: {'_id': 0, event: 1, tHash: 1, from: "$order.sellerAddr", to: "$order.buyerAddr",
                                    timestamp: "$order.updateTime", price: "$order.price", tokenId: "$order.tokenId", blockNumber: 1, royaltyFee: "$order.royaltyFee", data: 1} },
                                { $match: {$and: [...methodCondition]} }
                            ],
                            "as": "collection1"
                            }
                        }
                    ],
                  "collection2": [
                    { $limit: 1 },
                    {   $lookup: {
                        from: "pasar_token_event",
                        pipeline: [
                            { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1,
                                timestamp: 1, price: "$memo", tokenId: 1, blockNumber: 1, royaltyFee: "0"} },
                            { $match: {$and: [...methodCondition]} }
                    ],
                      "as": "collection2"
                    }}
                  ]
                }},
                { $project: {
                  data: {
                    $concatArrays: [
                      { "$arrayElemAt": ["$collection1.collection1", 0] },
                      { "$arrayElemAt": ["$collection2.collection2", 0] },
                    ]
                  }
                }},
                { $unwind: "$data" },
                { $replaceRoot: { "newRoot": "$data" } },
                { $lookup: {from: 'pasar_token', localField: 'tokenId', foreignField: 'tokenId', as: 'token'} },
                { $unwind: "$token" },
                { $project: {event: 1, tHash: 1, from: 1, to: 1, timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, name: "$token.name", royalties: "$token.royalties", asset: "$token.asset", data: 1} },
                { $sort: {blockNumber: timeOrder}},
            ]).toArray();
            let results = [];
            for(var i = (pageNum - 1) * pageSize; i < pageSize * pageNum; i++)
            {
                if(i >= result.length)
                    break;
                results.push(result[i]);
            }
            results = this.verifyEvents(results);
            let total = result.length;
            return {code: 200, message: 'success', data: {total, results}};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    nftnumber: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_token');
            let result = await collection.aggregate([
                {
                    $group: { 
                        _id  : "$status", 
                        value: {$sum: 1 }
                    }
                } 
            ]).toArray();
            return {code: 200, message: 'success', data: (result.length == 0 ? 0 : result[0]['value'])};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    relatednftnum: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const clientDB = mongoClient.db(config.dbName);
            let total = await clientDB.collection('pasar_token_event').find().count() + await clientDB.collection('pasar_order_event').find().count();
            return {code: 200, message: 'success', data: total};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    walletaddressnum: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_address_did');
            let result = await collection.aggregate([
                {
                    $group: { 
                        _id  : "$status",
                        value: { $sum:1 }
                    }
                }
            ]).toArray();
            return {code: 200, message: 'success', data: (result.length == 0 ? 0 : result[0]['value'])};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    gettv: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order');
            let result = await collection.aggregate([
                { 
                    $match :{
                        orderState: "2"
                    }
                }
            ]).toArray();
            let sum = 0;
            result.forEach(ele => {
                sum += parseInt(ele['price']) * parseInt(ele['amount']);
            });
            sum = Math.floor(sum / Math.pow(10, 18));
            result = {code: 200, message: 'success', data : sum};
          return result;
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },
      
    getTranVolumeByTokenId: async function(tokenId, type) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection = mongoClient.db(config.dbName).collection('pasar_order');
            await collection.find({}).forEach( function (x) {
                x.updateTime = new Date(x.updateTime * 1000);
                x.price = type == 0 ? parseInt(x.price) : parseInt(x.royaltyFee);
                mongoClient.db(config.dbName).collection('token_temp').save(x);
            });
            collection =  mongoClient.db(config.dbName).collection('token_temp');
            let result = await collection.aggregate([
            { $addFields: {onlyDate: {$dateToString: {format: '%Y-%m-%d', date: '$updateTime'}}} }, 
            { $sort: {onlyDate: -1} },
            { $match: {$and : [{"tokenId": new RegExp('^' + tokenId)}, { 'orderState': '2'}]} },
            { $group: { "_id"  : { tokenId: "$tokenId", onlyDate: "$onlyDate"}, "price": {$sum: "$price"}} },
            { $project: {_id: 0, tokenId : "$_id.tokenId", onlyDate: "$_id.onlyDate", price:1} }
            ]).toArray();
            await collection.drop();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },
    
    getTranDetailsByTokenId: async function(tokenId, method, timeOrder) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "tokenId", tokenId);
        switch(method)
        {
            case "Mint":
                methodCondition.push({'from': "0x0000000000000000000000000000000000000000"});
                methodCondition.push({'event': 'notSetYet'});
                break;
            case 'SafeTransferFrom':
                methodCondition.push({'from': {$ne: "0x0000000000000000000000000000000000000000"}});
                methodCondition.push({'to': {$ne: "0x0000000000000000000000000000000000000000"}});
                methodCondition.push({'event': 'notSetYet'});
                break;
            case 'SafeTransferFromWithMemo':
                methodCondition.push({'from': {$ne: "0x0000000000000000000000000000000000000000"}});
                methodCondition.push({'to': {$ne: "0x0000000000000000000000000000000000000000"}});
                methodCondition.push({'event': 'notSetYet'});
                methodCondition.push({'price': {$ne: ''}});
                break;
            case 'Burn':
                methodCondition.push({'to': "0x0000000000000000000000000000000000000000"});
                methodCondition.push({'event': 'notSetYet'});
                break;
            case 'BuyOrder':
                methodCondition.push({'event': "OrderFilled"});
                break;
            case 'CreateOrderForSale':
                methodCondition.push({'event': 'OrderForSale'});
                break;
            case 'CancelOrder':
                methodCondition.push({'event': 'OrderCanceled'});
                break;
            case 'ChangeOrderPrice':
                methodCondition.push({'event': 'OrderPriceChanged'});
                break;

        }
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_event');
            
            let result = await collection.aggregate([
                { $facet: {
                  "collection1": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "pasar_order_event",
                      pipeline: [
                        { $lookup : {from: 'pasar_order', localField: 'orderId', foreignField: 'orderId', as: 'order'} },
                        { $unwind : "$order" },
                        { $project: {'_id': 0, event: 1, tHash: 1, from: "$order.sellerAddr", to: "$order.buyerAddr", data: 1,
                            timestamp: "$order.updateTime", price: "$order.price", tokenId: "$order.tokenId", blockNumber: 1, royaltyFee: "$order.royaltyFee"} },
                        { $match : {$and: [{tokenId : tokenId.toString()}, ...methodCondition]} }
                      ],
                      "as": "collection1"
                    }}
                  ],
                  "collection2": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "pasar_token_event",
                      pipeline: [
                        { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1,
                            timestamp: 1, price: "$memo", tokenId: 1, blockNumber: 1, royaltyFee: "0"} }, 
                        { $match : {$and: [{tokenId : tokenId.toString()}, ...methodCondition]} }],
                      "as": "collection2"
                    }}
                  ]
                }},
                { $project: {
                  data: {
                    $concatArrays: [
                      { "$arrayElemAt": ["$collection1.collection1", 0] },
                      { "$arrayElemAt": ["$collection2.collection2", 0] },
                    ]
                  }
                }},
                { $unwind: "$data" },
                { $replaceRoot: { "newRoot": "$data" } },
                { $lookup: {from: 'pasar_token', localField: 'tokenId', foreignField: 'tokenId', as: 'token'} },
                { $unwind: "$token" },
                { $project: {event: 1, tHash: 1, from: 1, to: 1, timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, data: 1, name: "$token.name", royalties: "$token.royalties", asset: "$token.asset"} },
                { $sort: {blockNumber: parseInt(timeOrder)} }
            ]).toArray();
            result = this.verifyEvents(result);
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },
      
    getCollectibleByTokenId: async function(tokenId) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let collection = client.db(config.dbName).collection('pasar_token');

            let result = await collection.find({tokenId: tokenId.toString()}).toArray();
            return {code: 200, message: 'success', data: result[0]};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    getTranvolumeTotalRoyaltySaleVolumeByWalletAddr: async function(walletAddr, type) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let addressCondition = [];
            addressCondition.push({"sellerAddr": new RegExp('^' + walletAddr)});
            if(type != 2) {
                // type: 0 => transaction volume, 1 => total royalty, 2 => sale volume
                addressCondition.push({"buyerAddr": new RegExp('^' + walletAddr)});
            }
            let collection = client.db(config.dbName).collection('pasar_order');
            await collection.find({}).forEach( function (x) {
                x.updateTime = new Date(x.updateTime * 1000);
                x.price = type == 1 ? parseInt(x.royaltyFee) : parseInt(x.price);
                client.db(config.dbName).collection('token_temp').save(x);
            });
            collection =  client.db(config.dbName).collection('token_temp');
            let result = await collection.aggregate([
                { $addFields: {onlyDate: {$dateToString: {format: '%Y-%m-%d', date: '$updateTime'}}} }, 
                { $sort: {onlyDate: -1} },
                { $match: {$and : [{$or :[...addressCondition]}, { 'orderState': '2'}]} },
                { $group: { "_id"  : { tokenId: "$tokenId", onlyDate: "$onlyDate"}, "price": {$sum: "$price"}} },
                { $project: {_id: 0, tokenId : "$_id.tokenId", onlyDate: "$_id.onlyDate", price:1} }
            ]).toArray();
            await collection.drop();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    getStastisDataByWalletAddr: async function(walletAddr) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let result = {};
            let collection = mongoClient.db(config.dbName).collection('pasar_token');
            let count_collectibles = await collection.find({royaltyOwner: walletAddr}).count();
            collection = mongoClient.db(config.dbName).collection('pasar_order');
            let count_sold = await collection.find({sellerAddr: walletAddr, orderState: '2'}).count();
            let count_purchased = await collection.find({buyerAddr: walletAddr, orderState: '2'}).count();
            collection = mongoClient.db(config.dbName).collection('pasar_order_event');
            let count_transactions = await collection.aggregate([
                { $project: {"_id": 0, orderId: 1} },
                { $lookup: {from: 'pasar_order', localField: 'orderId', foreignField: 'orderId', as: 'order'} },
                { $unwind: '$order' },
                { $project: {orderId: 1, from: '$order.sellerAddr', to: '$order.buyerAddr'} },
                { $match: { $or: [{from: walletAddr}, {to: walletAddr}] } }
            ]).toArray();
            result = {assets: count_collectibles, sold: count_sold, purchased: count_purchased, transactions: count_transactions.length};
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    
    getTranDetailsByWalletAddr: async function(walletAddr, method, timeOrder, keyword, pageNum, pageSize) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "walletAddr", walletAddr);
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_order_event');
            let result = await collection.aggregate([
                { $facet: {
                  "collection1": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "pasar_order_event",
                      pipeline: [
                        { $sort: {blockNumber: parseInt(timeOrder)} },
                        { $skip: pageSize * (pageNum - 1) },
                        { $limit: pageSize },
                        { $lookup : {from: 'pasar_order', localField: 'orderId', foreignField: 'orderId', as: 'order'} },
                        { $unwind : "$order" },
                        { $project: {'_id': 0, event: 1, tHash: 1, from: "$order.sellerAddr", to: "$order.buyerAddr", data: 1,
                            timestamp: "$order.updateTime", price: "$order.price", tokenId: "$order.tokenId", blockNumber: 1, royaltyFee: "$order.royaltyFee"} },
                        { $match : {$and: [...methodCondition]} }
                      ],
                      "as": "collection1"
                    }}
                  ],
                  "collection2": [
                    { $lookup: {
                      from: "pasar_token_event",
                      pipeline: [
                        { $sort: {blockNumber: parseInt(timeOrder)} },
                        { $skip: pageSize * (pageNum - 1) },
                        { $limit: pageSize },
                        { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1,
                            timestamp: 1, price: "$memo", tokenId: 1, blockNumber: 1, royaltyFee: "0"} }, 
                        { $match : {$and: [...methodCondition]} }],
                      "as": "collection2"
                    }}
                  ]
                }},
                { $project: {
                  data: {
                    $concatArrays: [
                      { "$arrayElemAt": ["$collection1.collection1", 0] },
                      { "$arrayElemAt": ["$collection2.collection2", 0] },
                    ]
                  }
                }},
                { $unwind: "$data" },
                { $replaceRoot: { "newRoot": "$data" } },
                { $lookup: {from: 'pasar_token', localField: 'tokenId', foreignField: 'tokenId', as: 'token'} },
                { $unwind: "$token" },
                { $project: {event: 1, tHash: 1, from: 1, to: 1, timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, data: 1, name: "$token.name", royalties: "$token.royalties", asset: "$token.asset"} },
                { $match: {$or: [{name: new RegExp(keyword.toString())}, {tokenId: keyword}]}},
                { $sort: {blockNumber: parseInt(timeOrder)} }
            ]).toArray();
            let results = [];
            for(var i = (pageNum - 1) * pageSize; i < pageSize * pageNum; i++)
            {
                if(i >= result.length)
                    break;
                results.push(result[i]);
            }
            results = this.verifyEvents(results);
            let total = result.length;
            return {code: 200, message: 'success', data: {total, results}};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    }
}
