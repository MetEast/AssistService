const fetch = require('node-fetch');
const cookieParser = require("cookie-parser");
const res = require("express/lib/response");
const {MongoClient} = require("mongodb");
let config = require("../config");
const meteastDBService = require("./meteastDBService");
const { ReplSet } = require('mongodb/lib/core');
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
module.exports = {
    getLastStickerSyncHeight: async function () {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token_event');
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
    removemeteastOrderByHeight: async function(lastHeight, eventType) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection_event = mongoClient.db(config.dbName).collection('meteast_order_event');
            await collection_event.deleteMany({$and: [ {blockNumber: lastHeight}, {event: eventType} ]});
            collection_event = mongoClient.db(config.dbName).collection('meteast_order');
            await collection_event.deleteMany({$and: [ {blockNumber: lastHeight}]});
            return true;
        } catch (err) {
            logger.error(err);
            return false;
        }
    },
    removePlatformFeeByHeight: async function(lastHeight) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection_event = mongoClient.db(config.dbName).collection('meteast_order_platform_fee');
            await collection_event.deleteMany({$and: [ {blockNumber: lastHeight} ]});
            return true;
        } catch (err) {
            logger.error(err);
            return false;
        }
    },
    removeApprovalByHeight: async function(lastHeight) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection_event = mongoClient.db(config.dbName).collection('meteast_approval_event');
            await collection_event.deleteMany({$and: [ {blockNumber: lastHeight} ]});
            return true;
        } catch (err) {
            logger.error(err);
            return false;
        }
    },
    removeTokenInfoByHeight: async function(lastHeight) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection_event = mongoClient.db(config.dbName).collection('meteast_token_event');
            await collection_event.deleteMany({$and: [ {blockNumber: lastHeight} ]});
            collection_event = mongoClient.db(config.dbName).collection('meteast_token');
            await collection_event.deleteMany({$and: [ {blockNumber: lastHeight}]});
            return true;
        } catch (err) {
            logger.error(err);
            return false;
        }
    },
    getGasFee: async function(txHash) {
        let transactionFee;
        try {
            const response = await fetch(
                config.elastos_transation_api_url + txHash
            );
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            let data = await response.json();
            data = data.result;
            transactionFee = data.gasUsed * data.gasPrice / (10 ** 18);
        } catch (err) {
            transactionFee = 0
        } finally {
            return transactionFee == 0 ? await this.getGasFee(txHash): transactionFee;
        }
    },
    getLatestElaPrice: async function () {
        let latest_price_api_url = config.elastos_latest_price_api_url;
        let latest_price;
        try {
            const response = await fetch(latest_price_api_url);
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            let data = await response.json();
            latest_price = data.coin_usd;
        } catch (err) {
            latest_price = 0;
        } finally {
            return {code: 200, message: 'success', data: latest_price};
        }
    },
    getTimestamp: async function(txHash) {
        let timeStamp;
        try {
            const response = await fetch(
                config.elastos_transation_api_url + txHash
            );
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            let data = await response.json();
            data = data.result;
            timeStamp = data.timeStamp;
        } catch (err) {
            timeStamp = 0;
        } finally {
            return timeStamp == 0 ? await this.getTimeStamp(txHash): timeStamp;
        }
    },
    verifyEvents: function(result) {
        for(var i = 0; i < result.length; i++) {
            if(result[i]['event'] == undefined || result[i]['event'] == "notSetYet") {
                if(result[i]['from'] == '0x0000000000000000000000000000000000000000') {
                    result[i]['event'] = 'Mint';
                }
                if(result[i]['to'] == '0x0000000000000000000000000000000000000000') {
                    result[i]['event'] = 'Burn';
                }
                if(result[i]['from'] != '0x0000000000000000000000000000000000000000' && result[i]['to'] != '0x0000000000000000000000000000000000000000') {
                    if(result[i]['memo'] == undefined || result[i]['memo'] == '')
                        result[i]['event'] = 'SafeTransferFrom';
                    else result[i]['event'] = 'SafeTransferFromWithMemo';
                }
            }
            if(result[i]['event'] == 'OrderFilled') {
                result[i]['event'] = "BuyOrder";
                if(result[i]['royaltyOwner'] == result[i]['from']) // this the primary sale
                    result[i]['royaltyFee'] = 0;
            }
            if(result[i]['event'] == 'OrderCanceled')
                result[i]['event'] = "CancelOrder";
            if(result[i]['event'] == 'OrderPriceChanged')
                result[i]['event'] = "ChangeOrderPrice";
            if(result[i]['event'] == 'OrderForSale')
                result[i]['event'] = "CreateOrderForSale";
        }
        return result;
    },
    composeMethodCondition: function(methodStr, requestType, data) {
        let methods = methodStr.split(",");
        let conditions_order_event = [];
        let conditions_token_event = [];
        for(var i = 0; i < methods.length; i++) {
            var method = methods[i];
            let methodCondition_order = [], methodCondition_token = [];
            if(method == 'SetApprovalForAll')
                continue;
            switch(method)
            {
                case "Mint":
                    methodCondition_token.push({'from': "0x0000000000000000000000000000000000000000"});
                    if(requestType == "walletAddr") {
                        methodCondition_token.push({'to': data});
                    }
                    methodCondition_order.push({'event': 'notSetYet'});
                    break;
                case 'SafeTransferFrom':
                    if(requestType == "walletAddr") {
                        methodCondition_token.push({$or: [{'from': data}, {'to': data}]});
                    }
                    else {
                        methodCondition_token.push({'from': {$ne: "0x0000000000000000000000000000000000000000"}});
                        methodCondition_token.push({'to': {$ne: "0x0000000000000000000000000000000000000000"}});
                    }
                    methodCondition_order.push({'event': 'notSetYet'});
                    break;
                case 'SafeTransferFromWithMemo':
                    if(requestType == "walletAddr") {
                        methodCondition_token.push({$or: [{'from': data}, {'to': data}]});
                    }
                    else {
                        methodCondition_token.push({'from': {$ne: "0x0000000000000000000000000000000000000000"}});
                        methodCondition_token.push({'to': {$ne: "0x0000000000000000000000000000000000000000"}});
                    }
                    methodCondition_order.push({'event': 'notSetYet'});
                    methodCondition_token.push({'memo': {$ne: ''}});
                    break;
                case 'Burn':
                    methodCondition_token.push({'to': "0x0000000000000000000000000000000000000000"});
                    if(requestType == "walletAddr") {
                        methodCondition_token.push({'from': data});
                    }
                    methodCondition_order.push({'event': 'notSetYet'});
                    break;
                case 'BuyOrder':
                    methodCondition_order.push({'event': "OrderFilled"});
                    methodCondition_token.push({'from': 'OrderFilled'});
                    if(requestType == 'walletAddr') {
                        methodCondition_order.push({$or: [{'sellerAddr': data}, {'buyerAddr': data}]});
                    }
                    break;
                case 'CreateOrderForSale':
                    methodCondition_order.push({'event': 'OrderForSale'});
                    methodCondition_token.push({'from': 'OrderForSale'});
                    if(requestType == 'walletAddr') {
                        methodCondition_order.push({$or: [{'sellerAddr': data}, {'buyerAddr': data}]});
                    }
                    break;
                case 'CancelOrder':
                    methodCondition_order.push({'event': 'OrderCanceled'});
                    methodCondition_token.push({'from': 'OrderCanceled'});
                    if(requestType == 'walletAddr') {
                        methodCondition_order.push({$or: [{'sellerAddr': data}, {'buyerAddr': data}]});
                    }
                    break;
                case 'ChangeOrderPrice':
                    methodCondition_order.push({'event': 'OrderPriceChanged'});
                    methodCondition_token.push({'from': 'OrderPriceChanged'});
                    if(requestType == 'walletAddr') {
                        methodCondition_order.push({$or: [{'sellerAddr': data}, {'buyerAddr': data}]});
                    }
                    break;
                case 'All':
                    if(requestType == 'walletAddr') {
                        methodCondition_token.push({$or: [{'from': data}, {'to': data}]});
                        methodCondition_order.push({$or: [{'sellerAddr': data}, {'buyerAddr': data}]});
                    }
                    methodCondition_order.push({event: {$ne: 'randomEvent'}});
                    methodCondition_token.push({from: {$ne: 'random'}});
                    break;
            }
            if(methodCondition_order.length > 0) 
                conditions_order_event.push({$and: [...methodCondition_order]});
            
            if(methodCondition_token.length > 0) 
                conditions_token_event.push({$and: [...methodCondition_token]});
        }
        return {'order': {$or:[...conditions_order_event]}, 'token':  {$or:[...conditions_token_event]}};
    },

    composeSort: function(orderType) {
        let sort;
        switch(orderType)
        {
            case 'price_l_to_h':
                sort = {price: -1};
                break;
            case 'price_h_to_l':
                sort = {price: 1};
                break;
            case 'mostviewed':
                sort = {views: -1};
                break;
            case 'mostliked':
                sort = {likes: -1};
                break;
            case 'mostrecent':
                sort = {timestamp: -1};
                break;
            case 'oldest':
                sort = {timestamp: 1};
                break;
            default:
                sort = {timestamp: -1};
                break;
        }
        return sort;
    },

    composeCondition: function(keyword, filter_status, filter_min_price, filter_max_price) {
        let condition = [];
        
        let filter_status_arr = filter_status.split(',');
        let or_condition = [];
        filter_status_arr.forEach(ele => {
            or_condition.push({status: ele});
        });
        if(or_condition.length > 0 && filter_status != '')
            condition.push({$or: or_condition});
        condition.push({$and: [{price: {$gte: filter_min_price}}, {price: {$lte: filter_max_price}}]});
        condition.push({$or: [{name: new RegExp(keyword.toString())}, {royaltyOwner: keyword}, {holder: keyword}, {tokenId: keyword}]});
        console.log(...condition)
        return condition;
    },

    paginateRows: function(rows, pageNum, pageSize) {
        let result = [];
        for(var i = (pageNum - 1) * pageSize; i < pageSize * pageNum; i++) {
            if(i >= rows.length)
                break;
            result.push(rows[i]);
        }
        return result;
    },

    listTokens: async function(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price) {
        
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_token');
            let total = await collection.find({$and: condition}).count();
            let result = await collection.find({$and: condition}).project({"_id": 0}).sort(sort).skip((pageNum-1)*pageSize).limit(pageSize).toArray();
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
            const collection = client.db(config.dbName).collection('meteast_token_event');
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
            const collection = client.db(config.dbName).collection('meteast_token_event');
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token_galleria');
            await collection.replaceOne({tokenId: token.tokenId}, token, {upsert: true});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateToken: async function (tokenId, holder, timestamp, blockNumber) {
        if(holder == config.meteastContract)
            return;
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            await collection.updateOne({tokenId, blockNumber: {"$lt": blockNumber}}, {$set: {holder, blockNumber, updateTime: timestamp, status: 'NEW'}});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateTokenStatus: async function (tokenId, blockNumber, status) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            await collection.updateOne({tokenId, blockNumber: {"$lt": blockNumber}}, {$set: {status}});
            if(status == 'NOT') {
                let collectible = await collection.findOne({tokenId: tokenId});
                if(collectible.royaltyOwner == collectible.holder) {
                    await collection.updateOne({tokenId, blockNumber: {"$lt": blockNumber}}, {$set: 'NEW'});
                }
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },
    updateTokenPrice: async function (tokenId, blockNumber, price) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            await collection.updateOne({tokenId, blockNumber: {"$lte": blockNumber}}, {$set: {price: new BigNumber(price)}});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    getLastApprovalSyncHeight: async function () {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_approval_event');
            let doc = await collection.findOne({}, {sort:{blockNumber: -1}});
            if(doc) {
                return doc.blockNumber
            } else {
                return 1;
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    addAprovalForAllEvent: async function (eventData) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const db = mongoClient.db(config.dbName);
            let transactionFee = await this.getGasFee(eventData.transactionHash);
            let timestamp = await this.getTimestamp(eventData.transactionHash);
            let record = {blockNumber: eventData.blockNumber, transactionHash: eventData.transactionHash, blockHash: eventData.blockHash,
                 owner: eventData.returnValues._owner, operator: eventData.returnValues._operator, approved: eventData.returnValues._approved, gasFee: transactionFee, timestamp: timestamp};
            if (db.collection('meteast_approval_event').find({}).count() == 0) {
                await db.createCollection('meteast_approval_event');
            }
            await db.collection('meteast_approval_event').insertOne(record);
            return;
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
            const collection = client.db(config.dbName).collection('meteast_token');
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
            let collection = client.db(config.dbName).collection('meteast_token_event');

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
                    { $lookup: {from: "meteast_token_galleria", localField: "tokenId", foreignField: "tokenId", as: "token"} },
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
                    { $lookup: {from: "meteast_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                    { $unwind: "$token"},
                    { $match: {...match}},
                    { $project: {"_id": 0, tokenId:1, blockNumber:1, timestamp:1, value: 1,memo: 1, to: 1, holder: "$to",
                            tokenIndex: "$token.tokenIndex", quantity: "$token.quantity", royalties: "$token.royalties",
                            royaltyOwner: "$token.royaltyOwner", createTime: '$token.createTime', tokenIdHex: '$token.tokenIdHex',
                            name: "$token.name", description: "$token.description", kind: "$token.kind", type: "$token.type",
                            thumbnail: "$token.thumbnail", asset: "$token.asset", size: "$token.size", tokenDid: "$token.did",
                            adult: "$token.adult", video: "$token.video"}}
                ]).toArray();
            }

            if(owner) {
                collection = client.db(config.dbName).collection('meteast_order');
                let pipeline = [
                    { $match: {sellerAddr: owner, orderState: "1"}},
                    { $lookup: {from: "meteast_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                    { $unwind: "$token"},
                    { $project: meteastDBService.resultProject},
                    { $sort: {blockNumber: -1}},
                ];

                let result2 = await collection.aggregate(pipeline).toArray();
                result = [...result, ...result2]
            }

            return {code: 200, message: 'success', data: result};
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token_event');
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            return await collection.find({tokenId}).sort({blockNumber: -1}).toArray();
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    updateOrderEventCollection: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection_event = mongoClient.db(config.dbName).collection('meteast_order_event');
            let result = await collection_event.aggregate([
                { $lookup : {from: 'meteast_order', localField: 'orderId', foreignField: 'orderId', as: 'order'} },
                { $unwind : "$order" },
                { $project: {'_id': 1, id: 1, orderId: 1, tIndex: 1, logIndex: 1, blockHash: 1, removed: 1, event: 1, tHash: 1, sellerAddr: "$order.sellerAddr", buyerAddr: "$order.buyerAddr",
                    timestamp: "$order.updateTime", price: "$order.price", tokenId: "$order.tokenId", blockNumber: 1, royaltyFee: "$order.royaltyFee", data: 1} }
            ]).toArray();
            await collection_event.deleteMany({});
            await collection_event.insertMany(result);
            return {result:result, total: result.length};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },
    updateAllEventCollectionForGasFee: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection_event = mongoClient.db(config.dbName).collection('meteast_order_event');
            let result = await collection_event.find({}).toArray();
            for(var i = 0; i < result.length; i++) {
                result[i]['gasFee'] = await this.getGasFee(result[i]['tHash']);
            }
            await collection_event.deleteMany({});
            await collection_event.insertMany(result);

            collection_event = mongoClient.db(config.dbName).collection('meteast_token_event');
            result = await collection_event.find({}).toArray();
            for(var i = 0; i < result.length; i++) {
                result[i]['gasFee'] = await this.getGasFee(result[i]['txHash']);
            }
            await collection_event.deleteMany({});
            await collection_event.insertMany(result);
            return {result:result, total: result.length};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    listTrans: async function(pageNum, pageSize, method, timeOrder) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "null", "null");
        let methodCondition_order = methodCondition['order'];
        let methodCondition_token = methodCondition['token'];
        console.log(methodCondition_order, methodCondition_token);
        try {
            await mongoClient.connect();
            let collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            let rows = await collection.aggregate([
                { $match: { $and: [methodCondition_order] }},
                { $project:{'_id': 0, event: 1, tHash: 1, from: "$sellerAddr", to: "$buyerAddr", orderId: 1,
                timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, royaltyFee: 1, data: 1, gasFee: 1} },
            ]).toArray();
            if(rows.length > 0)
                await mongoClient.db(config.dbName).collection('token_temp').insertMany(rows);

            collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            rows = await collection.aggregate([
                { $match: { $and: [methodCondition_token] } },
                { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1, gasFee: 1,
                timestamp: 1, memo: 1, tokenId: 1, blockNumber: 1, royaltyFee: "0"} }
            ]).toArray();
            if(rows.length > 0)
                await mongoClient.db(config.dbName).collection('token_temp').insertMany(rows);
            collection =  mongoClient.db(config.dbName).collection('token_temp');
            let result = await collection.find().sort({blockNumber: parseInt(timeOrder)}).toArray();
            if(result.length > 0)
                await collection.drop();
            let results = [];
            for(var i = (pageNum - 1) * pageSize; i < pageSize * pageNum; i++)
            {
                if(i >= result.length)
                    break;
                let res  = await collection_token.findOne({tokenId: result[i]['tokenId']});
                if(res != null) {
                    result[i]['name'] = res['name'];
                    result[i]['royalties'] = res['royalties'];
                    result[i]['asset'] = res['asset'];
                    result[i]['royaltyOwner'] = res['royaltyOwner'];
                }
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
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
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
            let total = await clientDB.collection('meteast_token_event').find().count() + await clientDB.collection('meteast_order_event').find().count();
            return {code: 200, message: 'success', data: total};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    owneraddressnum: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            let owners = await collection.aggregate([
                {
                    $group: {
                        _id: "$holder"
                    }
                }]).toArray();
            return {code: 200, message: 'success', data: owners.length};
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
            const collection = mongoClient.db(config.dbName).collection('meteast_order');
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

    getNftPriceByTokenId: async function(tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection = mongoClient.db(config.dbName).collection('meteast_order');
            await collection.find({"tokenId": tokenId}).forEach( function (x) {
                x.updateTime = new Date(x.updateTime * 1000);
                x.price = parseInt(x.price);
                mongoClient.db(config.dbName).collection('token_temp').save(x);
            });
            collection =  mongoClient.db(config.dbName).collection('token_temp');
            let result = await collection.aggregate([
            { $addFields: {onlyDate: {$dateToString: {format: '%Y-%m-%d %H', date: '$updateTime'}}} },
            { $match: {$and : [{"tokenId": new RegExp('^' + tokenId)}, { 'orderState': '2'}]} },
            { $group: { "_id"  : { tokenId: "$tokenId", onlyDate: "$onlyDate"}, "price": {$sum: "$price"}} },
            { $project: {_id: 0, tokenId : "$_id.tokenId", onlyDate: "$_id.onlyDate", price:1} },
            { $sort: {onlyDate: 1} }
            ]).toArray();
            if(result.length > 0)
                await collection.drop();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getTranDetailsByTokenId: async function(tokenId, method, timeOrder, pageNum, pageSize) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "tokenId", tokenId);
        let methodCondition_order = methodCondition['order'];
        let methodCondition_token = methodCondition['token'];
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token_event');

            let result = await collection.aggregate([
                { $facet: {
                  "collection1": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "meteast_order_event",
                      pipeline: [
                        { $project: {'_id': 0, event: 1, tHash: 1, from: "$sellerAddr", to: "$buyerAddr", data: 1, orderId: 1, gasFee: 1,
                            timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, royaltyFee: 1} },
                        { $match : {$and: [{tokenId : tokenId.toString()}, methodCondition_order]} }
                      ],
                      "as": "collection1"
                    }}
                  ],
                  "collection2": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "meteast_token_event",
                      pipeline: [
                        { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1, gasFee: 1, 
                            timestamp: 1, memo: 1, tokenId: 1, blockNumber: 1, royaltyFee: "0"} },
                        { $match : {$and: [{tokenId : tokenId.toString()}, methodCondition_token]} }],
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
                { $lookup: {from: 'meteast_token', localField: 'tokenId', foreignField: 'tokenId', as: 'token'} },
                { $unwind: "$token" },
                { $project: {event: 1, tHash: 1, from: 1, to: 1, timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, data: 1, name: "$token.name"
                , royalties: "$token.royalties", asset: "$token.asset", royaltyFee: 1, royaltyOwner: "$token.royaltyOwner", orderId: 1, gasFee: 1} },
                { $sort: {blockNumber: parseInt(timeOrder)} },
                { $skip: (pageNum - 1) * pageSize },
                { $limit: pageSize }
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
        let projectionToken = {"_id": 0, tokenId:1, blockNumber:1, timestamp:1, value: 1,memo: 1, to: 1, holder: "$to",
        tokenIndex: "$token.tokenIndex", quantity: "$token.quantity", royalties: "$token.royalties",
        royaltyOwner: "$token.royaltyOwner", createTime: '$token.createTime', tokenIdHex: '$token.tokenIdHex',
        name: "$token.name", description: "$token.description", kind: "$token.kind", type: "$token.type",
        thumbnail: "$token.thumbnail", asset: "$token.asset", size: "$token.size", tokenDid: "$token.did",
        adult: "$token.adult", authorName: "$token.authorName", authorDescription: "$token.authorDescription", status: "$token.status"}
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let collection = client.db(config.dbName).collection('meteast_token_event');

            let result = await collection.aggregate([
                { $match: {$and: [{tokenId: tokenId}, {to: {$ne: config.meteastContract}}] }},
                { $sort: {tokenId: 1, blockNumber: -1}},
                { $limit: 1},
                { $group: {_id: "$tokenId", doc: {$first: "$$ROOT"}}},
                { $replaceRoot: { newRoot: "$doc"}},
                { $lookup: {from: "meteast_token", localField: "tokenId", foreignField: "tokenId", as: "token"} },
                { $unwind: "$token"},
                { $project: projectionToken}
            ]).toArray();
            result = result[0];
            collection = client.db(config.dbName).collection('meteast_order');
            if(result.status == 'ON AUCTION') {
                let orderForAuctionRecord = await collection.find(
                    {$and: [{tokenId: tokenId}, {sellerAddr: result.holder}]}
                ).toArray();
                if(orderForAuctionRecord.length > 0) {
                    result.endTime = orderForAuctionRecord.endTime;
                }
            }
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    getCollectiblesByCreator: async function (creator) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let collection = client.db(config.dbName).collection('meteast_token');
            let result = collection.aggregate([
                { $match: {$and: [{royaltyOwner: creator.toString()}] }},
            ]).toArray();
            collection = client.db(config.dbName).collection('meteast_order');
            for(var i = 0; i < result.length; i++) {
                if(result[i].status == 'ON AUCTION') {
                    let orderForAuctionRecord = await collection.find(
                        {$and: [{tokenId: tokenId}, {sellerAddr: result[i].holder}]}
                    ).toArray();
                    if(orderForAuctionRecord.length > 0) {
                        result[i].endTime = orderForAuctionRecord.endTime;
                    }
                }
            }
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    getCollectiblesByNameDescription: async function (keyword) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let collection = client.db(config.dbName).collection('meteast_token');
            let result = collection.aggregate([
                { $match: {$or: [{name: new RegExp(keyword.toString())}, {description: new RegExp(keyword.toString())}] }},
            ]).toArray();
            collection = client.db(config.dbName).collection('meteast_order');
            for(var i = 0; i < result.length; i++) {
                if(result[i].status == 'ON AUCTION') {
                    let orderForAuctionRecord = await collection.find(
                        {$and: [{tokenId: tokenId}, {sellerAddr: result[i].holder}]}
                    ).toArray();
                    if(orderForAuctionRecord.length > 0) {
                        result[i].endTime = orderForAuctionRecord.endTime;
                    }
                }
            }
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    getTotalRoyaltyandTotalSaleByWalletAddr: async function(walletAddr, type) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let addressCondition = [];
            //type 0: total royalties, 1: total sales
            if(type == 0)
                addressCondition.push({"sellerAddr": new RegExp('^' + walletAddr)});
            else
                addressCondition.push({"royaltyOwner": new RegExp('^' + walletAddr)});
            let collection = client.db(config.dbName).collection('meteast_order');
            let rows = [];
            let result = await collection.aggregate([
                { $match: {$and : [{$or :[...addressCondition]}, { 'orderState': '2'}]} },
                { $sort: {updateTime: 1}},
                { $project: {"_id": 0, royaltyOwner: 1, sellerAddr: 1, tokenId: 1, orderId: 1, price: 1, royaltyFee: 1, updateTime: 1, amount: 1} },
                { $lookup: {from: "meteast_order_platform_fee", localField: "orderId", foreignField: "orderId", as: "platformFee"} },                
            ]).toArray();
            result.forEach(x => {
                x.time = new Date(x.updateTime * 1000);
                let platformFee = x.platformFee.length > 0 ? x.platformFee[0].platformFee: 0;
                x.value = type == 1 ? (x.sellerAddr == x.royaltyOwner? 0: parseInt(x.royaltyFee)) : parseInt(x.price) * parseFloat(x.amount) - parseInt(platformFee);
                rows.push(x);
            });
            if(rows.length > 0) {
                await client.db(config.dbName).collection('token_temp').insertMany(rows);
            }
            collection =  client.db(config.dbName).collection('token_temp');
            result = await collection.aggregate([
                { $addFields: {onlyDate: {$dateToString: {format: '%Y-%m-%d %H', date: '$time'}}} },
                { $group: { "_id"  : { onlyDate: "$onlyDate"}, "value": {$sum: "$value"}} },
                { $project: {_id: 0, onlyDate: "$_id.onlyDate", value:1} },
                { $sort: {onlyDate: 1} },
            ]).toArray();
            if(result.length > 0)
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
            let tokens_created = await mongoClient.db(config.dbName).collection('meteast_token').find({royaltyOwner: walletAddr}).project({"_id": 0, tokenId: 1}).toArray();
            let tokens = [];
            tokens_created.forEach(ele => {
                tokens.push(ele['tokenId']);
            });
            let collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            let mint_collectibles = await collection.find({$and: [{from: '0x0000000000000000000000000000000000000000'}, {to: walletAddr}]}).toArray();

            let burn_collectibles = await collection.find({$and: [{to: '0x0000000000000000000000000000000000000000'}, {from: walletAddr}, {tokenId: {$in: tokens}}]}).toArray();

            collection = mongoClient.db(config.dbName).collection('meteast_order');
            let count_sold = await collection.find({sellerAddr: walletAddr, orderState: '2'}).count();
            let count_purchased = await collection.find({buyerAddr: walletAddr, orderState: '2'}).count();
            collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            let count_transactions = await collection.aggregate([
                { $project: {"_id": 0, orderId: 1} },
                { $lookup: {from: 'meteast_order', localField: 'orderId', foreignField: 'orderId', as: 'order'} },
                { $unwind: '$order' },
                { $project: {orderId: 1, from: '$order.sellerAddr', to: '$order.buyerAddr'} },
                { $match: { $or: [{from: walletAddr}, {to: walletAddr}] } }
            ]).toArray();
            result = {assets: mint_collectibles.length - burn_collectibles.length, sold: count_sold, purchased: count_purchased, transactions: count_transactions.length};
            return {code: 200, message: 'success', data: result, data1ss: tokens_created};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getTranDetailsByWalletAddr: async function(walletAddr, method, timeOrder, keyword, pageNum, pageSize, performer) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "walletAddr", walletAddr);
        let methodCondition_order = methodCondition['order'];
        let methodCondition_token = methodCondition['token'];
        let condition_performer = performer == "By" ? {from: walletAddr} : {to: walletAddr};
        let methodCondition_approval = (method == 'All' || method.indexOf('SetApprovalForAll') != -1) ? {event: 'SetApprovalForAll'}: {event: 'notSetApprovalForAll'}
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            let result = await collection.aggregate([
                { $facet: {
                  "collection1": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "meteast_order_event",
                      pipeline: [
                        { $match : {$and: [methodCondition_order]} },
                        { $project: {'_id': 0, event: 1, tHash: 1, from: "$sellerAddr", to: "$buyerAddr", data: 1, gasFee: 1, 
                            timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, royaltyFee: 1, orderId: 1} }
                      ],
                      "as": "collection1"
                    }}
                  ],
                  "collection2": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "meteast_token_event",
                      pipeline: [
                        { $match : {$and: [methodCondition_token]} },
                        { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1, gasFee: 1,
                            timestamp: 1, memo: 1, tokenId: 1, blockNumber: 1, royaltyFee: "0"} }
                      ],
                      "as": "collection2"
                    }}
                  ],
                  "collection3": [
                    { $limit: 1 },
                    { $lookup: {
                      from: "meteast_approval_event",
                      pipeline: [
                        { $match: {owner: walletAddr} },
                        { $project: {'_id': 0, event: 'SetApprovalForAll', tHash: "$transactionHash", from: '$owner', to: '$operator', gasFee: 1, timestamp: 1} },
                        { $limit:  1 },
                        { $match: methodCondition_approval}],
                      "as": "collection3"
                    }}
                  ]
                }},
                { $project: {
                  data: {
                    $concatArrays: [
                      { "$arrayElemAt": ["$collection1.collection1", 0] },
                      { "$arrayElemAt": ["$collection2.collection2", 0] },
                      { "$arrayElemAt": ["$collection3.collection3", 0] },
                    ]
                  }
                }},
                { $unwind: "$data" },
                { $replaceRoot: { "newRoot": "$data" } },
                { $match: condition_performer },
                { $sort: {blockNumber: parseInt(timeOrder)} }
            ]).toArray();
            let results = [];
            let collection_token = mongoClient.db(config.dbName).collection('meteast_token');
            let collection_platformFee = mongoClient.db(config.dbName).collection('meteast_order_platform_fee');
            let start = (pageNum - 1) * pageSize;
            let tempResult = [];
            for(var i = 0; i < result.length; i++) {
                let res  = await collection_token.findOne({$and:[{tokenId: result[i]['tokenId']}, {$or: [{name: new RegExp(keyword.toString())}, {royaltyOwner: keyword}, {holder: keyword}, {tokenId: keyword}]}]});
                if(res != null) {
                    result[i]['name'] = res['name'];
                    result[i]['royalties'] = res['royalties'];
                    result[i]['asset'] = res['asset'];
                    result[i]['royaltyOwner'] = res['royaltyOwner'];
                } else if(result[i]['event'] != 'SetApprovalForAll') continue;
                tempResult.push(result[i]);
            };
            result = tempResult;
            for(var i = start, count = 0; count < pageSize; i++)
            {
                if(i >= result.length)
                    break;
                count++;
                if(result[i]['event'] == 'OrderFilled') {
                    let res  = await collection_platformFee.findOne({$and:[{blockNumber: result[i]['blockNumber']}, {orderId: result[i]['orderId']}]});
                    if(res != null) {
                        result[i]['platformfee'] = res['platformFee'];
                    }
                }
                console.log(count)
                if(result[i]['gasFee'] == null) {
                    result[i]['gasFee'] = await this.getGasFee(result[i]['tHash']);
                }
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

    getLatestBids: async function (tokenId, sellerAddr, buyerAddr, pageNum, pageSize) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            let result_mine = await collection.aggregate([ 
                { $match: { $and: [{sellerAddr: sellerAddr}, {buyerAddr: buyerAddr}, {tokenId : new RegExp(tokenId.toString())}, {event: 'OrderBid'} ] } },
                { $sort: {timestamp: -1} },
                { $skip: (pageNum - 1) * pageSize },
                { $limit: pageSize }
            ]).toArray();
            let result_others = await collection.aggregate([ 
                { $match: { $and: [{sellerAddr: sellerAddr}, {buyerAddr: {$ne: buyerAddr}}, {tokenId : new RegExp(tokenId.toString())}, {event: 'OrderBid'} ] } },
                { $sort: {timestamp: -1} },
                { $skip: (pageNum - 1) * pageSize },
                { $limit: pageSize }
            ]).toArray();
            return { code: 200, message: 'success', data: {yours: result_mine, others: result_others} };
        } catch (err) {
            logger.error(err)
        } finally {
            await mongoClient.close();
        }
    },

    getAuctionOrdersByTokenId: async function (tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.findOne({tokenId});
            let sellerAddr = result.holder;
            collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            result = await collection.aggregate([
                { $match: {$and: [{tokenId: tokenId}, {sellerAddr: sellerAddr}, {$or: [{event: 'OrderForAuction'}, {event: 'OrderBid'}]}]} },
                { $sort: {blockNumber: 1} }
            ]).toArray();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getFixSaleOrdersByTokenId: async function (tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.findOne({tokenId});
            let sellerAddr = result.holder;
            collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            result = await  collection.aggregate([
                { $match: {$and: [{tokenId: tokenId}, {sellerAddr: sellerAddr}, {$or: [{event: 'OrderForSale'}, {event: 'OrderPriceChanged'}]}]} },
                { $sort: {blockNumber: 1} }
            ]).toArray();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getEarnedByWalletAddress: async function (address) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_order');
            let result = await collection.aggregate([
                { $match: {$and: [{royaltyOwner: address}, {sellerAddr: {$ne: address}}, {orderState: '2'}]} },
                { $group: { "_id"  : { royaltyOwner: "$royaltyOwner"}, "profit": {$sum: "$royaltyFee"}} },
                { $project: {_id: 0, royaltyOwner : "$_id.royaltyOwner", profit: 1} },
            ]).toArray();
            let profit = result.length > 0 ? result[0].profit: 0
            return {code: 200, message: 'success', data: profit};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getTodayEarnedByWalletAddress: async function (address) {
        var now = Date.now() / 1000;
        var start_today = new Date();
        start_today.setHours(0);
        start_today.setMinutes(0);
        start_today.setSeconds(0);
        start_today /= 1000;
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_order');
            let result = await collection.aggregate([
                { $match: {$and: [{royaltyOwner: address}, {sellerAddr: {$ne: address}}, {orderState: '2'}, {$and: [{updateTime: {$gte: start_today}}, {updateTime: {$lte: now}}]}]} },
                { $group: { "_id"  : { royaltyOwner: "$royaltyOwner"}, "profit": {$sum: "$royaltyFee"}} },
                { $project: {_id: 0, royaltyOwner : "$_id.royaltyOwner", profit: 1} },
            ]).toArray();
            let profit = result.length > 0 ? result[0].profit: 0
            return {code: 200, message: 'success', data: profit};
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getSelfCreateNotSoldCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({royaltyOwner: selfAddr});
        condition.push({holder: selfAddr});
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.aggregate([
                {$match: {$and: condition} }
            ]).sort(sort).toArray();
            let total = result.length;
            result = this.paginateRows(result, pageNum, pageSize);
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getSoldPreviouslyBoughtCollectible: async function (selfAddr) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology:true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_order');
            const collection_token = mongoClient.db(config.dbName).collection('meteast_token');
            const collection_temp = mongoClient.db(config.dbName).collection('meteast_token_temp');
            let sold_collectibles = await collection.aggregate([
                { $match: {$and: [{sellerAddr: selfAddr}, {orderState: '2'}, {royaltyOwner: {$ne: selfAddr}}] } },
                { $project: {"_id": 0, tokenId: 1} }
            ]).toArray();
            let result = [];
            for(var i = 0; i < sold_collectibles.length; i++) {
                let ele = sold_collectibles[i];
                let temp_condition = condition;
                temp_condition.push({tokenId: ele.tokenId});
                let record = await collection_token.findOne({$and: temp_condition});
                result.push(record);
            }
            if(sold_collectibles.length > 0)
                await collection_temp.insertMany(result);
            let total = result.length;
            result = await collection_temp.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0) {
                await collection_temp.drop();
            }
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.err(error);
        } finally {
            await mongoClient.close();
        }
    },
    
    getForSaleFixedPriceCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({status: 'BUY NOW'});
        condition.push({holder: selfAddr});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.aggregate([
                { $match: {$and: condition} }
            ]).sort(sort).toArray();
            let total = result.length;
            result = this.paginateRows(result, pageNum, pageSize);
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.err(error);
        } finally {
            await mongoClient.close();
        }
    },
    
    getBoughtNotSoldCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({royaltyOwner: {$ne: selfAddr}});
        condition.push({holder: selfAddr});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.aggregate([
                { $match: {$and: condition} }
            ]).sort(sort).toArray();
            let total = result.length;
            result = this.paginateRows(result, pageNum, pageSize);
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.err(error);
        } finally {
            await mongoClient.close();
        }
    },
    
    getSoldCollectibles: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);    

        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology:true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_order');
            const collection_token = mongoClient.db(config.dbName).collection('meteast_token');
            const collection_temp = mongoClient.db(config.dbName).collection('meteast_token_temp');
            let sold_collectibles = await collection.aggregate([
                { $match: {$and: [{sellerAddr: selfAddr}, {orderState: '2'}] } },
                { $project: {"_id": 0, tokenId: 1} }
            ]).toArray();
            let result = [];
            console.log(sold_collectibles.length);
            for(var i = 0; i < sold_collectibles.length; i++) {
                let ele = sold_collectibles[i];
                let temp_condition = condition;
                temp_condition.push({tokenId: ele.tokenId});
                let record = await collection_token.findOne({$and: temp_condition});
                result.push(record);
            }
            if(result.length > 0)
                await collection_temp.insertMany(result);
            let total = result.length;
            result = await collection_temp.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0) {
                await collection_temp.drop();
            }
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.err(error);
        } finally {
            await mongoClient.close();
        }
    },
    
    getOwnCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({holder: selfAddr});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.aggregate([
                { $match: {$and: condition} }
            ]).sort(sort).toArray();
            let total = result.length;
            result = this.paginateRows(result, pageNum, pageSize);
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.err(error);
        } finally {
            await mongoClient.close();
        }
    },

    getCollectiblesByTokenIds: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, str_tokenIds) {
        let tokenIds = str_tokenIds.split(',');
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({tokenId: {$in: tokenIds}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.aggregate([
                { $match: {$and: condition} }
            ]).sort(sort).toArray();
            let total = result.length;
            result = this.paginateRows(result, pageNum, pageSize);
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.err(error);
        } finally {
            await mongoClient.close();
        }
    },

    listMarketTokens: async function(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price) {
        
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({status: {$ne: 'NEW'}});
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_token');
            let total = await collection.find({$and: condition}).count();
            let result = await collection.find({$and: condition}).project({"_id": 0}).sort(sort).skip((pageNum-1)*pageSize).limit(pageSize).toArray();
            return {code: 200, message: 'success', data: {total, result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },
}
