const fetch = require('node-fetch');
const cookieParser = require("cookie-parser");
const res = require("express/lib/response");
const {MongoClient} = require("mongodb");
let config = require("../config");
const meteastDBService = require("./meteastDBService");
const { ReplSet } = require('mongodb/lib/core');
var ObjectID = require('mongodb').ObjectID;
const config_test = require("../config_test");
const { curNetwork } = require('../config');
config = config.curNetwork == 'testNet'? config_test : config;
let jobService = require('./jobService');

module.exports = {
    getLastStickerSyncHeight: async function () {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            let doc = await collection.findOne({}, {sort:{blockNumber: -1}});
            if(doc) {
                return doc.blockNumber + 1
            } else {
                return config.stickerContractDeploy;
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
            return transactionFee;
        }
    },
    getLatestElaPrice: async function () {
        let latest_price = 0;
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_cmc_price');
            let result = await collection.find({}).sort({timestamp : -1}).limit(1).toArray();
            if(result.length > 0) {
                latest_price = result[0]['ELA'];
            }
            return {code: 200, message: 'success', data: latest_price};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
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
            return timeStamp == 0 ? await this.getTimestamp(txHash): timeStamp;
        }
    },
    verifyEvents: function(result) {
        for(var i = 0; i < result.length; i++) {
            if(result[i]['event'] == undefined || result[i]['event'] == "notSetYet") {
                if(result[i]['from'] == config.burnAddress) {
                    result[i]['event'] = 'Mint';
                }
                if(result[i]['to'] == config.burnAddress) {
                    result[i]['event'] = 'Burn';
                }
                if(result[i]['from'] != config.burnAddress && result[i]['to'] != config.burnAddress) {
                    result[i]['event'] = 'Transfer';
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
            if(result[i]['event'] == 'OrderBid')
                result[i]['event'] = "BidOrder";
            if(result[i]['event'] == 'OrderForAuction')
                result[i]['event'] = "CreateOrderForAuction";
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
                    methodCondition_token.push({'from': config.burnAddress});
                    if(requestType == "walletAddr") {
                        methodCondition_token.push({'to': data});
                    }
                    methodCondition_order.push({'event': 'notSetYet'});
                    break;
                case 'Transfer':
                    if(requestType == "walletAddr") {
                        methodCondition_token.push({$or: [{'from': data}, {'to': data}]});
                    }
                    else {
                        methodCondition_token.push({'from': {$ne: config.burnAddress}});
                        methodCondition_token.push({'to': {$ne: config.burnAddress}});
                    }
                    methodCondition_order.push({'event': 'notSetYet'});
                    break;
                case 'Burn':
                    methodCondition_token.push({'to': config.burnAddress});
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
                case 'CreateOrderForSale':
                    methodCondition_order.push({'event': 'OrderForAuction'});
                    methodCondition_token.push({'from': 'OrderForAuction'});
                    if(requestType == 'walletAddr') {
                        methodCondition_order.push({$or: [{'sellerAddr': data}, {'buyerAddr': data}]});
                    }
                    break;
                case 'BidOrder':
                    methodCondition_order.push({'event': 'OrderBid'});
                    methodCondition_token.push({'from': 'OrderBid'});
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
                sort = {price: 1};
                break;
            case 'price_h_to_l':
                sort = {price: -1};
                break;
            case 'mostviewed':
                sort = {views: -1};
                break;
            case 'mostliked':
                sort = {likes: -1};
                break;
            case 'mostrecent':
                sort = {createTime: -1, timestamp: -1};
                break;
            case 'oldest':
                sort = {createTime: 1, timestamp: 1};
                break;
            case 'endingsoon': 
                sort = {endTime: -1};
                break;
            default:
                sort = {createTime: -1, timestamp: -1};
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
        condition.push({$and: [{priceCalculated: {$gte: filter_min_price}}, {priceCalculated: {$lte: filter_max_price}}]});
        condition.push({$or: [{name: new RegExp(keyword.toString(), 'i')}, {tokenIdHex: new RegExp(keyword.toString(), 'i')}, {royaltyOwner: new RegExp(keyword.toString(), 'i')}, {holder: new RegExp(keyword.toString(), 'i')}, {tokenId: new RegExp(keyword.toString(), 'i')}, {description: new RegExp(keyword.toString(), 'i')}]});
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
        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({status: {$ne: 'DELETED'}})
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_token');
            const temp_collection = client.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} },
                { $project: {'_id': 0} }
            ]).toArray();
            console.log(result);
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;
            console.log(tokenPopularity);
            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
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
                    holder: config.burnAddress,
                    isBlindbox: false,
                    blindboxIndex: null
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
        if(holder == config.stickerContract)
            return;
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            await collection.updateOne({tokenId}, {$set: {holder, blockNumber, updateTime: timestamp}});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateOrder: async function(result, blockNumber, orderId) {
        try {
            // let result = await meteastContract.methods.getOrderById(orderId).call();
            let meteastOrder = {orderId: result.orderId, orderType: result.orderType, orderState: result.orderState,
                tokenId: result.tokenId, amount: result.amount, price:result.price, priceNumber: parseInt(result.price), endTime: result.endTime,
                sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr, bids: result.bids, lastBidder: result.lastBidder,
                lastBid: result.lastBid, filled: result.filled, royaltyOwner: result.royaltyOwner, royaltyFee: result.royaltyFee,
                createTime: result.createTime, updateTime: result.updateTime, blockNumber}

            if(result.orderState === "1" && blockNumber > config.upgradeBlock) {
                if(result.sellerUri !== '') {
                    meteastOrder.platformAddr = result.platformAddr;
                    meteastOrder.platformFee = result.platformFee;
                    meteastOrder.sellerUri = result.sellerUri;
                    meteastOrder.sellerDid = await jobService.getInfoByIpfsUri(result.sellerUri);

                    await meteastDBService.replaceDid({address: result.sellerAddr, did: meteastOrder.sellerDid});
                }
                if(result.buyerUri !== '') {
                    meteastOrder.platformAddr = result.platformAddr;
                    meteastOrder.platformFee = result.platformFee;
                    meteastOrder.buyerUri = result.buyerUri;
                    meteastOrder.buyerDid = await jobService.getInfoByIpfsUri(result.buyerUri);

                    await meteastDBService.replaceDid({address: result.buyerAddr, did: meteastOrder.buyerDid});
                }
            }
            await meteastDBService.updateOrInsert(meteastOrder);
        } catch(error) {
            console.log(error);
            console.log(`[OrderForSale] Sync - getOrderById(${orderId}) at ${blockNumber} call error`);
        }
    },

    updateTokenStatus: async function (tokenId, price, orderId, marketTime, endTime, status, holder, blockNumber, isBlindbox) {
        price = parseInt(price);
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            await collection.updateOne({tokenId, blockNumber: {$lte: blockNumber}, holder: {$ne: config.burnAddress}}, {$set: {status, price, orderId, marketTime, endTime, blockNumber}});
            if(isBlindbox != null)
                await collection.updateOne({tokenId, blockNumber: {$lte: blockNumber}, holder: {$ne: config.burnAddress}}, {$set: {isBlindbox}});
            if(holder != config.stickerContract && holder != null) {
                await collection.updateOne({tokenId, blockNumber: {$lte: blockNumber}, holder: {$ne: config.burnAddress}}, {$set: {holder}});
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
            await collection.updateOne({tokenId, blockNumber: {"$lte": blockNumber}}, {$set: {price: BigInt(price)}});
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    updateTokens: async function(){
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const token_event_collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            const token_collection = mongoClient.db(config.dbName).collection('meteast_token');
            const order_event_collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            const order_collection = mongoClient.db(config.dbName).collection('meteast_order');
            let tokens = await token_collection.find({}).toArray();
            console.log(tokens.length);
            for(var i = 0; i < tokens.length; i++) {
                let token = tokens[i];
                let token_event = await token_event_collection.find({$and: [{to: {$ne: config.stickerContract}}, {tokenId: token['tokenId']}]}).sort({blockNumber: -1}).limit(1).toArray();
                let holder, price = 0, orderId = null, marketTime = null, endTime = null, status = "NEW";
                if(token_event.length > 0)
                    holder = token_event[0]['to'];
                else holder = token.royaltyOwner;
                let order_event = await order_event_collection.find({tokenId: token['tokenId']}).sort({blockNumber: -1}).limit(1).toArray();
                if(order_event.length > 0) {
                    order_event = order_event[0];
                    price = parseInt(order_event['price']);
                    orderId = order_event['orderId'];
                    let order = await order_collection.findOne({orderId});
                    if(order) {
                        marketTime = order['createTime'];
                        endTime = order['endTime'];
                    }
                    switch(order_event['event'])
                    {
                        case 'OrderForSale':
                            status = 'BUY NOW';
                            break;
                        case 'OrderPriceChanged':
                            status = 'PRICE CHANGED';
                            break;
                        case 'OrderFilled':
                            status = 'NEW';
                            break;
                        case 'OrderCanceled':
                            status = 'NEW';
                            break;
                        case 'OrderForAuction':
                            status = 'ON AUCTION';
                            break;
                        case 'OrderBid':
                            status = 'HAS BIDS';
                            break;
                    }   
                }
                await token_collection.updateOne({ tokenId: token['tokenId']}, {$set: {holder, price, orderId, status, marketTime, endTime}});
            }
            console.log('successull done');
            return {code: 200, message: 'sucess'}; 
        } catch(err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
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
                return doc.blockNumber + 1
            } else {
                return config.meteastContractDeploy;
            }
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }
    },

    getLastOrderDidSyncHeight: async function () {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_address_did');
            let doc = await collection.findOne({}, {sort:{blockNumber: -1}});
            if(doc) {
                return doc.blockNumber + 1
            } else {
                return config.stickerContractDeploy;
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
            let result = await collection.find({$or: [{tokenId: keyword}, {tokenIdHex: keyword}, {royaltyOwner: keyword}, {name: {$regex: keyword}}, {description: {$regex: keyword}}]}).project({"_id": 0}).toArray();
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
                            category: "$token.category", video: "$token.video"}}
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
            return await collection.find({status: {$ne: 'DELETED'}}).count();
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
            let temp_collection = mongoClient.db(config.dbName).collection('token_temp_' + Date.now().toString());
            let rows = await collection.aggregate([
                { $match: { $and: [methodCondition_order] }},
                { $project:{'_id': 0, event: 1, tHash: 1, from: "$sellerAddr", to: "$buyerAddr", orderId: 1,
                timestamp: 1, price: 1, tokenId: 1, blockNumber: 1, royaltyFee: 1, data: 1, gasFee: 1} },
            ]).toArray();
            if(rows.length > 0)
                await temp_collection.insertMany(rows);

            collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            rows = await collection.aggregate([
                { $match: { $and: [methodCondition_token] } },
                { $project: {'_id': 0, event: "notSetYet", tHash: "$txHash", from: 1, to: 1, gasFee: 1,
                timestamp: 1, memo: 1, tokenId: 1, blockNumber: 1, royaltyFee: "0"} }
            ]).toArray();
            if(rows.length > 0)
                await temp_collection.insertMany(rows);
            let result = await temp_collection.find().sort({blockNumber: parseInt(timeOrder)}).toArray();
            if(result.length > 0)
                await temp_collection.drop();
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
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    nftnumber: async function() {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.find({ holder: {$ne: config.burnAddress}, status: {$ne: 'DELETED'} }).count();
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
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
            return {code: 500, message: 'server error'};
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
            return {code: 500, message: 'server error'};
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
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getNftPriceByTokenId: async function(tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection = mongoClient.db(config.dbName).collection('meteast_order');
            
            let result = await collection.aggregate([
                { $lookup : {from: 'meteast_address_did', localField: 'buyerAddr', foreignField: 'address', as: 'address_did'} },
                { $unwind: "$address_did"},
                { $match: {$and : [{"tokenId": new RegExp('^' + tokenId, 'i')}, { 'orderState': '2'}]} },
                { $project: {_id: 0, tokenId : 1, price: 1, updateTime:1, name: "$address_did.did.name"} },
                { $sort: {updateTime: 1} }
            ]).toArray();

            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getTranDetailsByTokenId: async function(tokenId, method, orderType, pageNum, pageSize) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        let methodCondition = this.composeMethodCondition(method, "tokenId", tokenId);
        let methodCondition_order = methodCondition['order'];
        let methodCondition_token = methodCondition['token'];
        let sort = this.composeSort(orderType);
        
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
                        { $match : {$and: [{tokenId : tokenId.toString()}, {$or: [{from: config.burnAddress}, {to: config.burnAddress}]}, methodCondition_token]} }],
                      "as": "collection2"
                    }}
                  ],
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
                { $sort: sort },
                { $limit: pageSize },
                { $skip: (pageNum - 1) * pageSize },
            ]).toArray();
            
            const collection_address_did = mongoClient.db(config.dbName).collection('meteast_address_did');
            let result_address = await collection_address_did.aggregate([
                { 
                    $project: {
                        '_id': 0,
                        'address': 1,
                        'name': "$did.name",
                        'did': "$did.did",
                    }
                },
            ]).toArray();

            for(var i = 0; i < result.length; i++) {
                let listFromAddress = result_address.filter(cell=>cell.address == result[i]['from']);
                result[i]['fromName'] = listFromAddress[0] && listFromAddress[0]['name'] ? listFromAddress[0]['name'] : '';
                let listToAddress = result_address.filter(cell=>cell.address == result[i]['to']);
                result[i]['toName'] = listToAddress[0] && listToAddress[0]['name'] ? listToAddress[0]['name'] : '';
            }

            result = this.verifyEvents(result);

            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getCollectibleByTokenId: async function(tokenId) {
        let projectionToken = { "_id": 0, tokenId:1, blockNumber:1, timestamp:1, value: 1,memo: 1, to: 1, holder: "$to",
        tokenIndex: "$token.tokenIndex", quantity: "$token.quantity", royalties: "$token.royalties",
        royaltyOwner: "$token.royaltyOwner", createTime: '$token.createTime', tokenIdHex: '$token.tokenIdHex',
        name: "$token.name", description: "$token.description", kind: "$token.kind", type: "$token.type",
        thumbnail: "$token.thumbnail", asset: "$token.asset", size: "$token.size", tokenDid: "$token.did",
        category: "$token.category", authorName: "$token.authorName", authorDid: "$token.authorDid", authorDescription: "$token.authorDescription", 
        status: "$token.status", price: "$token.price", orderId: "$token.orderId", endTime: "$token.endTime", isBlindbox: "$token.isBlindbox"}
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            let collection = client.db(config.dbName).collection('meteast_token_event');
            let address_did_collection = client.db(config.dbName).collection('meteast_address_did');
            let result = await collection.aggregate([
                { $match: {$and: [{tokenId: tokenId}, {to: {$ne: config.stickerContract}}] }},
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
            result['holderName'] = ''
            let addressRecord = await address_did_collection.findOne({address: result['holder']});
            console.log(addressRecord);
            if(addressRecord) {
                if(typeof addressRecord.did == 'object') {
                    result['holderName'] = addressRecord.did.name;
                }
            }
            let tokenIds = [];
            tokenIds.push(result.tokenId);
            let response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            let data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            response = await fetch(config.centralAppUrl + '/api/v1/' + 'getUserProfile' + '?did=' + result['authorDid']);
            data = await response.json();
            
            if(data.code == 200 && data.data && data.data.avatar) {
                result['authorAvatar'] = data.data.avatar;
            } else {
                result['authorAvatar'] = null;
            }
            result['views'] = tokenPopularity[tokenId]? tokenPopularity[tokenId].views: 0;
            result['likes'] = tokenPopularity[tokenId]? tokenPopularity[tokenId].likes: 0;
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
                { $match: {$and: [{royaltyOwner: creator.toString()}, {status: {$ne: 'DELETED'}}] }},
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
                { $match: {$and: [{$or: [{name: new RegExp(keyword.toString(), 'i')}, {description: new RegExp(keyword.toString(), 'i')}] }, {status: {$ne: 'DELETED'}}]}},
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
                addressCondition.push({"sellerAddr": new RegExp('^' + walletAddr, 'i')});
            else
                addressCondition.push({"royaltyOwner": new RegExp('^' + walletAddr, 'i')});
            let collection = client.db(config.dbName).collection('meteast_order');
            let temp_collection = client.db(config.dbName).collection('token_temp_' + Date.now().toString());
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
                await temp_collection.insertMany(rows);
            }
            result = await temp_collection.aggregate([
                { $addFields: {onlyDate: {$dateToString: {format: '%Y-%m-%d %H', date: '$time'}}} },
                { $group: { "_id"  : { onlyDate: "$onlyDate"}, "value": {$sum: "$value"}} },
                { $project: {_id: 0, onlyDate: "$_id.onlyDate", value:1} },
                { $sort: {onlyDate: 1} },
            ]).toArray();
            if(result.length > 0)
                await temp_collection.drop();
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
            let tokens_created = await mongoClient.db(config.dbName).collection('meteast_token').find({royaltyOwner: walletAddr, status: {$ne: 'DELETED'}}).project({"_id": 0, tokenId: 1}).toArray();
            let tokens = [];
            tokens_created.forEach(ele => {
                tokens.push(ele['tokenId']);
            });
            let collection = mongoClient.db(config.dbName).collection('meteast_token_event');
            let mint_collectibles = await collection.find({$and: [{from: config.burnAddress}, {to: walletAddr}]}).toArray();

            let burn_collectibles = await collection.find({$and: [{to: config.burnAddress}, {from: walletAddr}, {tokenId: {$in: tokens}}]}).toArray();

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
                let res  = await collection_token.findOne({$and:[{tokenId: result[i]['tokenId']}, {$or: [{name: new RegExp(keyword.toString(), 'i')}, {royaltyOwner: keyword}, {holder: keyword}, {tokenId: keyword}]}]});
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
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getLatestBids: async function (tokenId, address, pageNum, pageSize, orderType) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const token_collection = mongoClient.db(config.dbName).collection('meteast_token');
            const collection = mongoClient.db(config.dbName).collection('meteast_order_event');
            const collection_address_did = mongoClient.db(config.dbName).collection('meteast_address_did');
            let sort = this.composeSort(orderType);

            let result_address = await collection_address_did.aggregate([
                { 
                    $project: {
                        '_id': 0,
                        'address': 1,
                        'name': "$did.name",
                        'did': "$did.did",
                    }
                },
            ]).toArray();
            console.log(tokenId)
            let tokenRecord = await token_collection.findOne({tokenId});
            if(!tokenRecord) {
                return {code: 500, message: 'collectible not found'};
            }
            if(tokenRecord.status != 'ON AUCTION' && tokenRecord.status != 'HAS BIDS') {
                return {code: 500, message: 'collectible is not on auction'};
            }
            let result_mine = await collection.aggregate([ 
                { $match: { $and: [{sellerAddr: tokenRecord.holder}, {buyerAddr: address}, {orderId: tokenRecord.orderId}, {tokenId}, {event: 'OrderBid'} ] } },
                { $sort: sort },
                { $skip: (pageNum - 1) * pageSize },
                { $limit: pageSize }
            ]).toArray();
            for(var i = 0; i < result_mine.length; i++) {
                let buyerName = result_address.filter(cell => cell.address == result_mine[i]['buyerAddr']);
                result_mine[i]['buyerName'] = buyerName[0] && buyerName[0]['name'] ? buyerName[0]['name'] : ''; 
                let sellerName = result_address.filter(cell => cell.address == result_mine[i]['sellerAddr']);
                result_mine[i]['sellerName'] = sellerName[0] && sellerName[0]['name'] ? sellerName[0]['name'] : ''; 
            }
            let result_others = await collection.aggregate([ 
                { $match: { $and: [{sellerAddr: tokenRecord.holder}, {buyerAddr: {$ne: address}}, {orderId: tokenRecord.orderId}, {tokenId}, {event: 'OrderBid'} ] } },
                { $sort: sort },
                { $skip: (pageNum - 1) * pageSize },
                { $limit: pageSize }
            ]).toArray();
            for(var i = 0; i < result_others.length; i++) {
                let buyerName = result_address.filter(cell => cell.address == result_others[i]['buyerAddr']);
                result_others[i]['buyerName'] = buyerName[0] && buyerName[0]['name'] ? buyerName[0]['name'] : ''; 
                let sellerName = result_address.filter(cell => cell.address == result_others[i]['sellerAddr']);
                result_others[i]['sellerName'] = sellerName[0] && sellerName[0]['name'] ? sellerName[0]['name'] : ''; 
            }
            return { code: 200, message: 'success', data: {yours: result_mine, others: result_others} };
        } catch (err) {
            logger.error(err)
            return {code: 500, message: 'server error'};
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
            return {code: 500, message: 'server error'};
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
            return {code: 500, message: 'server error'};
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
                { $match: {$and: [{sellerAddr: address}, {orderState: '2'}]} },
                { $project: {_id: 0, price : 1} },
            ]).toArray();
            let profit = 0;
            for(var i = 0; i < result.length; i++) {
                profit += (parseInt(result[i]['price']) / (10 ** 18));
            }
            result = await collection.aggregate([
                { $match: {$and: [{royaltyOwner: address}, {sellerAddr: {$ne: address}}, {orderState: '2'}]} },
                { $project: {_id: 0, royaltyFee: 1} },
            ]).toArray();
            for(var i = 0; i < result.length; i++) {
                profit += (parseInt(result[i]['royaltyFee']) / (10 ** 18));
            }
            return {code: 200, message: 'success', data: profit};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getTodayEarnedByWalletAddress: async function (address) {
        var now = (Date.now() / 1000).toFixed(0);
        var start_today = new Date();
        start_today.setHours(0);
        start_today.setMinutes(0);
        start_today.setSeconds(0);
        start_today = (start_today/1000).toFixed(0);

        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_order');
            let result = await collection.aggregate([
                { $match: {$and: [{sellerAddr: address}, {orderState: '2'}, {$and: [{updateTime: {$gte: start_today}}, {updateTime: {$lte: now}}]}]} },
                { $project: {_id: 0, price: 1} },
            ]).toArray();
            let profit = 0;

            for(var i = 0; i < result.length; i++) {
                profit += (parseInt(result[i]['price']) / (10 ** 18));
            }
            result = await collection.aggregate([
                { $match: {$and: [{royaltyOwner: address}, {sellerAddr: {$ne: address}}, {orderState: '2'}, {$and: [{updateTime: {$gte: start_today}}, {updateTime: {$lte: now}}]}]} },
                { $project: {_id: 0, royaltyFee: 1} },
            ]).toArray();
            for(var i = 0; i < result.length; i++) {
                profit += (parseInt(result[i]['royaltyFee']) / (10 ** 18));
            }
            return {code: 200, message: 'success', data: profit};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getEarnedListByAddress: async function(address) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try  {
            await mongoClient.connect();
            let collection = mongoClient.db(config.dbName).collection('meteast_order');
            let result = await collection.aggregate([
                { $facet: {
                  "collection1": [
                    { $lookup: {
                      from: "meteast_order",
                      pipeline: [
                        { $match: {$and: [{sellerAddr: address}, {orderState: '2'}]} },
                        { $project: {'_id': 0, Badge: 'Badge', Earned: "$price", updateTime: 1, tokenId: 1} },
                      ],
                      "as": "collection1"
                    }}
                  ],
                  "collection2": [
                    { $lookup: {
                        from: "meteast_order",
                        pipeline: [
                          { $match: {$and: [{royaltyOwner: address}, {sellerAddr: {$ne: address}}, {orderState: '2'}]} },
                          { $project: {'_id': 0, Badge: 'Royalties', Earned: "$royaltyFee", updateTime: 1, tokenId: 1} },
                        ],
                        "as": "collection2"
                      }}
                    ],
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
                { $project: {Badge: 1, Earned: 1, updateTime: 1, tokenId: 1, name: "$token.name", thumbnail: "$token.thumbnail"} },
            ]).toArray();
            let data = [];
            if(result.length > 0) {
                const temp_collection = mongoClient.db(config.dbName).collection('token_temp_' + Date.now().toString());
                for(var i = 0; i < result.length; i++) {
                    result[i].iEarned = parseInt(result[i].Earned);
                }
                await temp_collection.insertMany(result);
                data = await temp_collection.aggregate([
                    { $group: { "_id"  : { Badge: "$Badge", updateTime: "$updateTime", tokenId: "$tokenId", name: "$name", thumbnail: "$thumbnail"}, "iEarned": {$sum: "$iEarned"}} },
                    { $project: {_id: 0, Badge : "$_id.Badge", tokenId: "$_id.tokenId", updateTime: "$_id.updateTime", name: "$_id.name", iEarned: 1, thumbnail: "$_id.thumbnail"} },
                    { $sort: {updateTime: -1}}
                ]).toArray();
                await temp_collection.drop();
            }
            return {code: 200, message: 'success', data: data};
        } catch(err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getSelfCreateNotSoldCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({royaltyOwner: selfAddr});
        condition.push({holder: selfAddr});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;
            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getSelfCreateCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, '', filter_min_price, filter_max_price);
        
        if(filter_status == 'BUY NOW') {
            condition.push({$and: [{endTime: "0"}, {status: {$ne: 'NEW'}}]});
        } else if(filter_status == 'ON AUCTION'){
            condition.push({$and: [{endTime: { $ne: "0"}}, {status: {$ne: 'NEW'}}]});
        }

        condition.push({royaltyOwner: selfAddr});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;
            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getSoldPreviouslyBoughtCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology:true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_order');
            const collection_token = mongoClient.db(config.dbName).collection('meteast_token');
            const collection_temp = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let sold_collectibles = await collection.aggregate([
                { $match: {$and: [{sellerAddr: selfAddr}, {orderState: '2'}, {royaltyOwner: {$ne: selfAddr}}] } },
                { $project: {"_id": 0, tokenId: 1} }
            ]).toArray();

            let tokenIds = [];
            sold_collectibles.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            let result = [];
            for(var i = 0; i < sold_collectibles.length; i++) {
                let ele = sold_collectibles[i];
                let temp_condition = condition;
                temp_condition.push({tokenId: ele.tokenId});
                temp_condition.push({status: {$ne: 'DELETED'}});
                let record = await collection_token.aggregate([
                    {
                        $addFields: {
                           "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                        }
                    },
                    { $match: {$and: temp_condition} }
                ]);
                if(record.length > 0) {
                    const tokenID = record[0]['tokenId'];
                    record[0]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                    record[0]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
                    result.push(record[0]);
                }
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
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    
    getForSaleCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {
        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({$or: [{status: 'PRICE CHANGED'}, {status: 'BUY NOW'}, {status: 'ON AUCTION', status: 'HAS BIDS'}]});
        condition.push({holder: selfAddr});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    
    getBoughtNotSoldCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({royaltyOwner: {$ne: selfAddr}});
        condition.push({holder: selfAddr});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    
    getSoldCollectibles: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);

        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology:true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_order');
            const collection_token = mongoClient.db(config.dbName).collection('meteast_token');
            const collection_temp = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let sold_collectibles = await collection.aggregate([
                { $match: {$and: [{sellerAddr: selfAddr}, {orderState: '2'}] } },
                { $project: {"_id": 0, tokenId: 1} }
            ]).toArray();
            let tokenIds = [];
            sold_collectibles.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;
            let result = [];
            for(var i = 0; i < sold_collectibles.length; i++) {
                let ele = sold_collectibles[i];
                var temp_condition = [...condition];
                temp_condition.push({tokenId: ele.tokenId});
                temp_condition.push({status: {$ne: 'DELETED'}});
                let record = await collection_token.aggregate([
                    {
                        $addFields: {
                           "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                        }
                    },
                    { $match: {$and: temp_condition} }
                ]).toArray();
                if(record.length > 0) {
                    const tokenID = record[0]['tokenId'];
                    record[0]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                    record[0]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
                    result.push(record[0]);
                }
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
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    
    getOwnCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, '', filter_min_price, filter_max_price);
        if(filter_status == 'BUY NOW') {
            condition.push({$and: [{endTime: "0"}, {status: {$ne: 'NEW'}}]});
        } else if(filter_status == 'ON AUCTION'){
            condition.push({$and: [{endTime: { $ne: "0"}}, {status: {$ne: 'NEW'}}]});
        }
        condition.push({holder: selfAddr});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getCollectiblesByTokenIds: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, str_tokenIds) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let tokenIds = str_tokenIds.split(',');

        const response = await fetch(
            config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
        );
        const data = await response.json();
        if(data.code != 200) {
            return {code: 500, message: 'centralized app invalid response'}
        }
        let tokenPopularity = data.data;
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({tokenId: {$in: tokenIds}});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('meteast_token_temp');
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    listMarketTokens: async function(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price) {
        
        let sort = this.composeSort(orderType);
        // filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        // let filter_max_price1 = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let condition = this.composeCondition(keyword, '', filter_min_price, filter_max_price);
        if(filter_status == 'BUY NOW') {
            condition.push({endTime: "0"});
        } else if(filter_status == 'ON AUCTION'){
            condition.push({endTime: { $ne: "0"}});
        }
        condition.push({$and: [{status: {$ne: 'NEW'}}, {status: {$ne: 'DELETED'}}]});
        condition.push({isBlindbox: false});
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_token');
            const temp_collection = client.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} },
                { $project: {'_id': 0} }
            ]).toArray();

            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            console.log(response);
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return {code: 200, message: 'success', data: {total, result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    listAdminMarketTokens: async function(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, status) {
        
        let sort = this.composeSort(orderType);
        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let condition = this.composeCondition(keyword, '', filter_min_price, filter_max_price);
        if(filter_status == 'BUY NOW') {
            condition.push({$and: [{endTime: "0"}, {status: {$ne: 'NEW'}}]});
        } else if(filter_status == 'ON AUCTION'){
            condition.push({$and: [{endTime: { $ne: "0"}}, {status: {$ne: 'NEW'}}]});
        }

        if(status == 'online') {
            condition.push({status: {$ne: 'DELETED'}});
        } else if(status == 'removed') {
            condition.push({status: 'DELETED'});
        }
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_token');
            const temp_collection = client.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result1 = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} },
                { $project: {'_id': 0} }
            ]).sort(sort).toArray();
            let skip = (pageNum - 1) * pageSize;

            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} },
                { $project: {'_id': 0} }
            ]).sort(sort).skip(skip).limit(pageSize).toArray();
            
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });

            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            console.log(data);
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result1.length;

            return {code: 200, message: 'success', data: {total, result}};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await client.close();
        }
    },

    getFavoritesCollectible: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, did) {
        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let response = await fetch(
            config.centralAppUrl + '/api/v1/' + 'getFavoritesCollectible' + '?did=' + did
        );
        let data = await response.json();
        if(data.code != 200) {
            return {code: 500, message: 'centralized app invalid response'}
        }
        let tokenIds = data.data;

        response = await fetch(
            config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
        );
        data = await response.json();
        if(data.code != 200) {
            return {code: 500, message: 'centralized app invalid response'}
        }
        let tokenPopularity = data.data;
        
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, filter_status, filter_min_price, filter_max_price);
        condition.push({tokenId: {$in: tokenIds}});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} },
                { $project: {'_id': 0} }
            ]).toArray();
            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getAllCollectibleByAddress: async function (pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr) {

        filter_min_price = parseInt(BigInt(filter_min_price, 10) / BigInt(10 ** 18, 10));
        filter_max_price = parseInt(BigInt(filter_max_price, 10) / BigInt(10 ** 18, 10));
        let sort = this.composeSort(orderType);
        let condition = this.composeCondition(keyword, '', filter_min_price, filter_max_price);
        if(filter_status == 'BUY NOW') {
            condition.push({$and: [{endTime: "0"}, {status: {$ne: 'NEW'}}]});
        } else if(filter_status == 'ON AUCTION'){
            condition.push({$and: [{endTime: { $ne: "0"}}, {status: {$ne: 'NEW'}}]});
        }
        condition.push({$or: [{holder: selfAddr}, {royaltyOwner: selfAddr}]});
        condition.push({status: {$ne: 'DELETED'}});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const temp_collection = mongoClient.db(config.dbName).collection('meteast_token_temp_' + Date.now().toString());
            let result = await collection.aggregate([
                {
                    $addFields: {
                       "priceCalculated": { $divide: [ "$price", 10 ** 18 ] }
                    }
                },
                { $match: {$and: condition} }
            ]).toArray();
            let tokenIds = [];
            result.forEach(ele => {
                tokenIds.push(ele.tokenId);
            });
            const response = await fetch(
                config.centralAppUrl + '/api/v1/' + 'getPopularityOfTokens' + '?tokenIds=' + tokenIds.join(',')
            );
            const data = await response.json();
            if(data.code != 200) {
                return {code: 500, message: 'centralized app invalid response'}
            }
            let tokenPopularity = data.data;

            for(var i = 0; i < result.length; i++) {
                const tokenID = result[i]['tokenId'];
                result[i]['views'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].views: 0;
                result[i]['likes'] = tokenPopularity[tokenID]? tokenPopularity[tokenID].likes: 0;
            }
            let total = result.length;
            if(total > 0)
                await temp_collection.insertMany(result);
            result = await temp_collection.find({}).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).toArray();
            if(total > 0)
                await temp_collection.drop();
            return { code: 200, message: 'success', data: {total, result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getBlindboxCandidate: async function (address, keyword) {
        let condition  = [];
        condition.push({holder: address});
        condition.push({status: 'NEW'});
        condition.push({name: new RegExp(keyword.toString(), 'i')});
        condition.push({isBlindbox: false});
        let mongoClient  = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.aggregate([
                { $match: {$and: condition} }
            ]).toArray();
            return { code: 200, message: 'success', data: {result} };
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getTokenByTokenId: async function (tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            result = await collection.findOne({tokenId: tokenId});

            const response = await fetch(config.centralAppUrl + '/api/v1/' + 'getUserProfile' + '?did=' + result['authorDid']);
            const data = await response.json();
            
            if(data.code == 200 && data.data && data.data.avatar) {
                result['authorAvatar'] = data.data.avatar;
            } else {
                result['authorAvatar'] = null;
            }
            return {code: 200, message: 'success', data: result};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    getTokenInfoByTokenId: async function (tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            let result = await collection.findOne({tokenId: tokenId});
            return result;
        } catch (err) {
            logger.error(err);
            return null;
        } finally {
            await mongoClient.close();
        }
    },

    updateAuthorOfToken: async function (did, name, description) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            let isUpdate = false;
            let updateInfo = {};
            if(name != '') {
                isUpdate = true;
                updateInfo.authorName = name;
            }
            if(description != '') {
                isUpdate = true;
                updateInfo.authorDescription = description;
            }
            
            if(isUpdate) {
                await collection.updateMany({authorDid: did}, {$set: updateInfo});
            }
            return {code: 200, message: 'success'};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },

    createNewNotification: async function(title, context, to) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_notification');
            let data = {
                title: title,
                context: context,
                to: to,
                date: new Date()/1000,
                isRead: 0,
            };
            await collection.insertOne(data);
            let dbNotification = await collection.findOne(data);
            let id = dbNotification._id? dbNotification._id : null;
            return id;
        } catch (err) {
            return null;
        } finally {
            await mongoClient.close();
        }
    },
    getTokensByIds: async function(ids) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_token');
            
            let listId = ids.split(',');
            console.log(listId);
            let result = await collection.find({tokenId: {$in: listId}}).toArray();

            return {code: 200, message: 'success', data: result};
        } catch (err) {
            return null;
        } finally {
            await mongoClient.close();
        }
    },
    updateAddressDid: async function (did, name, description) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_address_did');
            if(name != '') {
                await collection.updateMany({'did.did': did}, {$set: {"did.name": name}});
            }
            if(description != '') {
                await collection.updateMany({'did.did': did}, {$set: {"did.description": description}});
            }
            return {code: 200, message: 'success'};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    insertAddressDid: async function (address, did, name, description) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_address_did');
            let newDid = {did, name, description}
            await collection.insertOne({address: address, did: newDid});
            return {code: 200, message: 'success'};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    readNotifications: async function (ids) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_notification');
            let listId = ids.split(',');
            let objectListId = [];
            listId.map(cell => {
                if(cell) {
                    objectListId.push(ObjectID(cell));
                }
            })

            await collection.updateMany({_id: {$in: objectListId}}, {$set: {isRead: 1}});

            return {code: 200, message: 'success'};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    getNotifications: async function (address) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_notification');
            let data = await collection.find({to: address}).sort({date: -1}).toArray();

            return {code: 200, message: 'success', data: data};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    removeNotifications: async function (ids) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            let collection  = mongoClient.db(config.dbName).collection('meteast_notification');
            let listId = ids.split(',');
            let objectListId = [];
            listId.map(cell => {
                if(cell) {
                    objectListId.push(ObjectID(cell));
                }
            })

            await collection.deleteMany({_id: {$in: objectListId}});

            return {code: 200, message: 'success'};
        } catch (err) {
            logger.error(err);
            return {code: 500, message: 'server error'};
        } finally {
            await mongoClient.close();
        }
    },
    deleteTokenFromBlindBox: async function (tokenId) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_token');
            const token = await collection.findOne({tokenId: tokenId});
            if(token.isBlindbox == true && token.blindboxIndex != null) {
                const response = await fetch(
                    config.centralAppUrl + `/api/v1/deleteTokenFromBlindbox?blindBoxIndex=${token.blindboxIndex}&tokenId=${tokenId}`
                );
            }
            await collection.updateOne({tokenId: tokenId}, {$set: {blindboxIndex: null, isBlindbox: false}});
            await mongoClient.close();
        } catch (err) {
            logger.error(err);
            await mongoClient.close();
            throw new Error();
        } finally {
        }
    },
}