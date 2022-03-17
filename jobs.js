const schedule = require('node-schedule');
let Web3 = require('web3');
let meteastDBService = require('./service/meteastDBService');
let stickerDBService = require('./service/stickerDBService');
let config = require('./config');
let meteastContractABI = require('./contractABI/meteastABI');
let stickerContractABI = require('./contractABI/stickerABI');
let galleriaContractABI = require('./contractABI/galleriaABI');
let jobService = require('./service/jobService');
let webSocketService = require('./service/webSocketService');
let sendMail = require('./send_mail');
const config_test = require("./config_test");
config = config.curNetwork == 'testNet'? config_test : config;


module.exports = {
    run: function() {
        logger.info("========= meteast Assist Service start =============")

        const burnAddress = config.burnAddress;

        let web3WsProvider = new Web3.providers.WebsocketProvider(config.escWsUrl, {
            //timeout: 30000, // ms
            // Useful for credentialed urls, e.g: ws://username:password@localhost:8546
            //headers: {
            //    authorization: 'Basic username:password'
            //},
            clientConfig: {
                // Useful if requests are large
                maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
                maxReceivedMessageSize: 100000000, // bytes - default: 8MiB
                keepalive: true, // Useful to keep a connection alive
                keepaliveInterval: 60000 // ms
            },
            reconnect: {
                auto: true,
                delay: 5000,
                maxAttempts: 5,
                onTimeout: false,
            },
        })
        let web3Ws = new Web3(web3WsProvider);
        let meteastContractWs = new web3Ws.eth.Contract(meteastContractABI, config.meteastContract);
        let stickerContractWs = new web3Ws.eth.Contract(stickerContractABI, config.stickerContract);
        let galleriaContractWs = new web3Ws.eth.Contract(galleriaContractABI, config.galleriaContract);


        let web3Rpc = new Web3(config.escRpcUrl);
        let meteastContract = new web3Rpc.eth.Contract(meteastContractABI, config.meteastContract);
        let stickerContract = new web3Rpc.eth.Contract(stickerContractABI, config.stickerContract);

        let isGetOrderForAuctionJobRun = false;
        let isGetOrderBidJobRun = false;
        let isGetForSaleOrderJobRun = false;
        let isGetForOrderPriceChangedJobRun = false;
        let isGetForOrderCancelledJobRun = false;
        let isGetForOrderFilledJobRun = false;
        let isGetTokenInfoJobRun = false;
        let isGetApprovalRun = false;
        let isGetForOrderTakenDownedJobRun = false;
        let now = Date.now();

        let recipients = [];
        recipients.push('lifayi2008@163.com')

        async function dealWithNewToken(blockNumber,tokenId) {
            try {
                let result = await meteastContract.methods.tokenInfo(tokenId).call();
                let token = {blockNumber, tokenIndex: result.tokenIndex, tokenId, quantity: 1,
                    royalties:result.royaltyFee, royaltyOwner: result.royaltyOwner, holder: result.royaltyOwner,
                    createTime: result.createTime, updateTime: result.updateTime}

                token.tokenIdHex = '0x' + BigInt(tokenId).toString(16);
                let data = await jobService.getInfoByIpfsUri(result.tokenUri);
                token.tokenJsonVersion = data.version;
                token.type = data.type;
                token.name = data.name;
                token.description = data.description;
                token.tokenUri = result.tokenUri;
                if(data.creator) {
                    token.authorName = data.creator.name;
                    token.authorDid = data.creator.did;
                    token.authorDescription = data.creator.description;
                    await meteastDBService.replaceDid({address: result.royaltyOwner, did: token.authorDid});
                }
                if(blockNumber > config.upgradeBlock) {
                    // let extraInfo = await stickerContract.methods.tokenExtraInfo(tokenId).call();
                    // token.didUri = extraInfo.didUri;
                    // if(extraInfo.didUri !== '') {
                    //     token.did = await jobService.getInfoByIpfsUri(extraInfo.didUri);
                    //     await meteastDBService.replaceDid({address: result.royaltyOwner, did: token.did});
                    // }
                }

                if(token.type === 'feeds-channel') {
                    token.tippingAddress = data.tippingAddress;
                    token.entry = data.entry;
                    token.avatar = data.avatar;
                    logger.info(`[TokenInfo] New token info: ${JSON.stringify(token)}`)
                    await stickerDBService.replaceGalleriaToken(token);
                    return;
                }

                if(token.type === 'feeds-video') {
                    token.video = data.video;
                } else {
                    token.thumbnail = data.data.thumbnail;
                    token.asset = data.data.image;
                    token.kind = data.data.kind;
                    token.size = data.data.size;
                }
                token.category = data.category ? data.category : 'other';
                token.price = 0;
                token.marketTime = null;
                token.endTime = null;
                token.orderId = null;
                token.status = 'NEW';
                token.isBlindbox = false;
                logger.info(`[TokenInfo] New token info: ${JSON.stringify(token)}`)
                await stickerDBService.replaceToken(token);
            } catch (e) {
                logger.info(`[TokenInfo] Sync error at ${blockNumber} ${tokenId}`);
                logger.info(e);
            }
        }

        let orderForAuctionJobId = schedule.scheduleJob(new Date(now + 30 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderForAuction');
            isGetOrderForAuctionJobRun = true;

            logger.info(`[OrderForAuction] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderForAuction({
                fromBlock: lastHeight
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderForAuction] Sync Ending ...")
                isGetOrderForAuctionJobRun = false;
            }).on("data", async function (event) {
                let orderInfo = event.returnValues;
                console.log('OrderForAuction event data is ', event)
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                console.log('OrderBid orderinfo is ', result)
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                logger.info(`[OrderForAuction] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'ON AUCTION', result.sellerAddr, event.blockNumber, null);
            })
        });

        let orderBidJobId = schedule.scheduleJob(new Date(now + 40 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderBid');
            isGetOrderBidJobRun = true;

            logger.info(`[OrderBid] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderBid({
                fromBlock: lastHeight
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderBid] Sync Ending ...")
                isGetOrderBidJobRun = false;
            }).on("data", async function (event) {
                let orderInfo = event.returnValues;
                console.log('OrderBid event data is ', event);
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                console.log('OrderBid orderinfo is ', result)
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: orderInfo._buyer,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: orderInfo._price, timestamp: result.updateTime, gasFee: gasFee}

                logger.info(`[OrderForBid] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'HAS BIDS', result.sellerAddr, event.blockNumber, null);

                let did = await meteastDBService.getDidByAddress(orderEventDetail.buyerAddr);
                let nft = await stickerDBService.getTokenInfoByTokenId(orderEventDetail.tokenId);

                let notifyTitle = 'New sale!';
                let notifyContext = `Your ${nft.name ? nft.name : '' } project has just been bid by (${did.name ? did.name + '/' : ''}${orderEventDetail.buyerAddr} for ${orderEventDetail.price/1e18} ELA.`
                webSocketService.makeSocketData(notifyTitle, notifyContext, orderEventDetail.sellerAddr);
            })
        });

        let orderForSaleJobId = schedule.scheduleJob(new Date(now + 50 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderForSale');
            isGetForSaleOrderJobRun = true;

            logger.info(`[OrderForSale] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderForSale({
                fromBlock: lastHeight
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderForSale] Sync Ending ...")
                isGetForSaleOrderJobRun = false;
            }).on("data", async function (event) {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}
                
                logger.info(`[OrderForSale] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'BUY NOW', result.sellerAddr, event.blockNumber, result.isBlindBox);
            })
        });

        let orderPriceChangedJobId = schedule.scheduleJob(new Date(now + 60 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderPriceChanged');
            isGetForOrderPriceChangedJobRun = true;

            logger.info(`[OrderPriceChanged] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderPriceChanged({
                fromBlock: lastHeight
            }).on("error", function (error) {
                isGetForOrderPriceChangedJobRun = false;
                logger.info(error);
                logger.info("[OrderPriceChanged] Sync Ending ...");
            }).on("data", async function (event) {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id,
                    data: {oldPrice: orderInfo._oldPrice, newPrice: orderInfo._newPrice}, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                logger.info(`[OrderPriceChanged] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'PRICE CHANGED', result.sellerAddr, event.blockNumber, null);
            })
        });

        let orderFilledJobId = schedule.scheduleJob(new Date(now + 70 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderFilled');
            isGetForOrderFilledJobRun = true;

            logger.info(`[OrderFilled] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderFilled({
                fromBlock: lastHeight
            }).on("error", function (error) {
                isGetForOrderFilledJobRun = false;
                logger.info(error);
                logger.info("[OrderFilled] Sync Ending ...");
            }).on("data", async function (event) {

                let orderInfo = event.returnValues;

                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}
                
                    
                logger.info(`[OrderFilled] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'NEW', result.buyerAddr, event.blockNumber, false);

                let did = await meteastDBService.getDidByAddress(orderEventDetail.buyerAddr);
                let nft = await stickerDBService.getTokenInfoByTokenId(orderEventDetail.tokenId);
                
                let notifyTitle = 'New sale!';
                let notifyContext = `Your ${nft.name ? nft.name : '' } project has been sold to (${did.name ? did.name + '/' : ''}${orderEventDetail.buyerAddr} for ${orderEventDetail.price/1e18} ELA.`
                webSocketService.makeSocketData(notifyTitle, notifyContext, orderEventDetail.sellerAddr);

                let royalityPrice = orderEventDetail.price * (orderEventDetail.royaltyFee / 1e6);
                notifyTitle = 'Royalties Received!';
                notifyContext = `You have received ${royalityPrice/1e18} ELA in Roylties from the sale of the ${nft.name ? nft.name : '' } project.`;
                if(nft.royaltyOwner) {
                    webSocketService.makeSocketData(notifyTitle, notifyContext, nft.royaltyOwner);
                }

                // here is a part for platformfee collection
                orderEventDetail = {orderId: orderInfo._orderId, blockNumber: event.blockNumber, txHash: event.transactionHash,
                    txIndex: event.transactionIndex, platformAddr: result.platformAddr, platformFee: result.platformFee};

                logger.info(`[OrderPlatformFee] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderPlatformFeeEvent(orderEventDetail);
            })
        });

        let orderCanceledJobId = schedule.scheduleJob(new Date(now + 80 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderCanceled');
            isGetForOrderCancelledJobRun = true;

            logger.info(`[OrderCanceled] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderCanceled({
                fromBlock: lastHeight
            }).on("error", function (error) {
                isGetForOrderCancelledJobRun = false;
                logger.info(error);
                logger.info("[OrderCanceled] Sync Ending ...");
            }).on("data", async function (event) {

                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee};

                logger.info(`[OrderCanceled] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'NEW', result.sellerAddr, event.blockNumber, null);
            })
        });
        
        let orderTakenDownJobId = schedule.scheduleJob(new Date(now + 70 * 1000), async () => {
            let lastHeight = await meteastDBService.getLastmeteastOrderSyncHeight('OrderTakenDown');
            isGetForOrderTakenDownedJobRun = true;

            logger.info(`[OrderTakenDown] Sync start from height: ${lastHeight}`);

            stickerContractWs.events.OrderTakenDown({
                fromBlock: lastHeight
            }).on("error", function (error) {
                isGetForOrderTakenDownedJobRun = false;
                logger.info(error);
                logger.info("[OrderTakenDown] Sync Ending ...");
            }).on("data", async function (event) {

                let orderInfo = event.returnValues;

                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                logger.info(`[OrderTakenDown] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                await stickerDBService.updateTokenStatus(result.tokenId, orderEventDetail.price, orderEventDetail.orderId, result.createTime, result.endTime, 'DELETED', result.sellerAddr, event.blockNumber, null);
            })
        });

        let approval  = schedule.scheduleJob(new Date(now + 90 * 1000), async()=> {
            let lastHeight = await stickerDBService.getLastApprovalSyncHeight();
            isGetApprovalRun = true;
            logger.info(`[approval] Sync Starting ... from block ${lastHeight}`)
            meteastContractWs.events.ApprovalForAll({
                fromBlock: lastHeight
            }).on("error", function(error) {
                logger.info(error);
                logger.info("[approval] Sync Ending ...");
                isGetApprovalRun = false;
            }).on("data", async function (event) {
                await stickerDBService.addAprovalForAllEvent(event);
                return;
            });
        });

        let tokenInfoSyncJobId = schedule.scheduleJob(new Date(now + 10 * 1000), async () => {
            let lastHeight = await stickerDBService.getLastStickerSyncHeight();
            isGetTokenInfoJobRun = true;
            logger.info(`[TokenInfo] Sync Starting ... from block ${lastHeight}`)

            meteastContractWs.events.Transfer({
                fromBlock: lastHeight
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[TokenInfo] Sync Ending ...");
                isGetTokenInfoJobRun = false
            }).on("data", async function (event) {
                let blockNumber = event.blockNumber;
                let txHash = event.transactionHash;
                let txIndex = event.transactionIndex;
                let from = event.returnValues._from;
                let to = event.returnValues._to;

                let tokenId = event.returnValues._tokenId;
                let value = 1;
                let timestamp = (await web3Rpc.eth.getBlock(blockNumber)).timestamp;
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let transferEvent = {tokenId, blockNumber, timestamp,txHash, txIndex, from, to, value, gasFee: gasFee};
                logger.info(`[TokenInfo] tokenEvent: ${JSON.stringify(transferEvent)}`)
                await stickerDBService.replaceEvent(transferEvent);

                if(to === burnAddress) {
                    await stickerDBService.burnToken(tokenId);
                } else if(from === burnAddress) {
                    await dealWithNewToken(blockNumber, tokenId)
                } else {
                    // await stickerDBService.updateToken(tokenId, to, timestamp, blockNumber);
                }
            })
        });

        schedule.scheduleJob({start: new Date(now + 61 * 1000), rule: '0 */2 * * * *'}, () => {
            let now = Date.now();

            if(!isGetForSaleOrderJobRun) {
                orderForSaleJobId.reschedule(new Date(now + 60 * 1000));
            }
            if(!isGetOrderForAuctionJobRun) {
                orderForAuctionJobId.reschedule(new Date(now + 60 * 1000));
            }
            if(!isGetOrderBidJobRun) {
                orderBidJobId.reschedule(new Date(now + 60 * 1000));
            }
            if(!isGetForOrderPriceChangedJobRun)
                orderPriceChangedJobId.reschedule(new Date(now + 2 * 60 * 1000));
            if(!isGetForOrderFilledJobRun)
                orderFilledJobId.reschedule(new Date(now + 3 * 60 * 1000));
            if(!isGetForOrderCancelledJobRun)
                orderCanceledJobId.reschedule(new Date(now + 3 * 60 * 1000));
            if(!isGetTokenInfoJobRun) {
                tokenInfoSyncJobId.reschedule(new Date(now + 60 * 1000))
            }
            if(!isGetApprovalRun)
                approval.reschedule(new Date(now + 60 * 1000))
            if(!isGetForOrderTakenDownedJobRun) {
                orderTakenDownJobId.reschedule(new Date(now + 3 * 60 * 1000));
            }
        });

        /**
         *  meteast order volume sync check
         */
        schedule.scheduleJob({start: new Date(now + 60 * 1000), rule: '*/2 * * * *'}, async () => {
            let orderCount = await meteastDBService.meteastOrderCount();
            let orderCountContract = parseInt(await stickerContract.methods.getOrderCount().call());
            logger.info(`[Order Count Check] DbCount: ${orderCount}   ContractCount: ${orderCountContract}`)
            if(orderCountContract !== orderCount) {
                // await sendMail(`meteast Order Sync [${config.serviceName}]`,
                //     `meteast assist sync service sync failed!\nDbCount: ${orderCount}   ContractCount: ${orderCountContract}`,
                //     recipients.join());
            }
        });

        /**
         *  Sticker volume sync check
         */
        schedule.scheduleJob({start: new Date(now + 60 * 1000), rule: '*/2 * * * *'}, async () => {
            let stickerCount = await stickerDBService.stickerCount();
            let stickerCountContract = parseInt(await meteastContract.methods.totalSupply().call());
            logger.info(`[Token Count Check] DbCount: ${stickerCount}   ContractCount: ${stickerCountContract}`)
            if(stickerCountContract !== stickerCount) {
                // await sendMail(`Sticker Sync [${config.serviceName}]`,
                //     `meteast assist sync service sync failed!\nDbCount: ${stickerCount}   ContractCount: ${stickerCountContract}`,
                //     recipients.join());
            }
        });

        /**
         *  meteast order event volume check
         */
        let meteastOrderEventCheckBlockNumber = config.meteastContractDeploy;
        // schedule.scheduleJob({start: new Date(now + 3 * 60 * 1000), rule: '*/2 * * * *'}, async () => {
        //     let nowBlock = await web3Rpc.eth.getBlockNumber();
        //     let fromBlock = meteastOrderEventCheckBlockNumber;
        //     let tempBlock = meteastOrderEventCheckBlockNumber + 20000
        //     let toBlock =  tempBlock > nowBlock ? nowBlock : tempBlock;
        //     let orderCount = await meteastDBService.meteastOrderEventCount(fromBlock, toBlock);

        //     let orderForSaleEvent = await stickerContract.getPastEvents('OrderForSale', {fromBlock, toBlock});
        //     let orderFilledEvent = await stickerContract.getPastEvents('OrderFilled', {fromBlock, toBlock});
        //     let orderCanceled = await stickerContract.getPastEvents('OrderCanceled', {fromBlock, toBlock});
        //     let orderPriceChanged = await stickerContract.getPastEvents('OrderPriceChanged', {fromBlock, toBlock});
        //     let orderForAuctionEvent = await stickerContract.getPastEvents('OrderForAuction', {fromBlock, toBlock});
        //     let orderBidEvent = await stickerContract.getPastEvents('OrderBid', {fromBlock, toBlock});

        //     let contractOrderCount = orderForSaleEvent.length + orderFilledEvent.length + orderCanceled.length + orderPriceChanged.length + orderForAuctionEvent.length + orderBidEvent.length;

        //     if(orderCount !== contractOrderCount) {
        //         logger.info(`Order Event Count Check: StartBlock: ${fromBlock}    EndBlock: ${toBlock}`);
        //         logger.info(`Order Event Count Check: DBEventCount: ${orderCount}    ContractEventCount: ${contractOrderCount}`);
        //         // await sendMail(`meteast Order Sync [${config.serviceName}]`,
        //         //     `meteast assist sync service sync failed!\nDbEventCount: ${orderCount}   ContractEventCount: ${contractOrderCount}`,
        //         //     recipients.join());
        //     }

        //     meteastOrderEventCheckBlockNumber = toBlock + 1;
        // });

        /**
         *  Sticker transfer event volume check
         */
        // let stickerEventCheckBlockNumber = config.stickerContractDeploy;
        // schedule.scheduleJob({start: new Date(now + 10* 60 * 1000), rule: '*/2 * * * *'}, async () => {
        //     let nowBlock = await web3Rpc.eth.getBlockNumber();
        //     let fromBlock = stickerEventCheckBlockNumber;
        //     let tempBlock = stickerEventCheckBlockNumber + 20000
        //     let toBlock =  tempBlock > nowBlock ? nowBlock : tempBlock;
        //     let stickerEventCountDB = await stickerDBService.stickerOrderEventCount(fromBlock, toBlock);

        //     let stickerEvent = await stickerContract.getPastEvents('Transfer', {fromBlock, toBlock});
        //     let stickerEventCount = stickerEvent.length;

        //     if(stickerEventCountDB !== stickerEventCount) {
        //         logger.info(`Sticker Event Count Check: StartBlock: ${fromBlock}    EndBlock: ${toBlock}`);
        //         logger.info(`Sticker Event Count Check: DBEventCount: ${stickerEventCountDB}    ContractEventCount: ${stickerEventCount}`);
        //         // await sendMail(`meteast Order Sync [${config.serviceName}]`,
        //         //     `meteast assist sync service sync failed!\nDbEventCount: ${stickerEventCountDB}   ContractEventCount: ${stickerEventCount}`,
        //         //     recipients.join());
        //     }

        //     stickerEventCheckBlockNumber = toBlock + 1;
        // });

        /**
         *  Get ELA price from CoinMarketCap
         */
        let coins = {"BTC": 1, "BNB": 1839, "HT": 2502, "AVAX": 5805, "ETH": 1027, "FTM": 3513, "MATIC": 3890};
        let coins2 = {"FSN": 2530, "ELA": 2492, "TLOS": 4660}
        if(config.cmcApiKeys.length > 0) {
            schedule.scheduleJob('*/4 * * * *', async () => {
                let x = Math.floor(Math.random() * config.cmcApiKeys.length);
                let headers = {'Content-Type': 'application/json', 'X-CMC_PRO_API_KEY': config.cmcApiKeys[x]}
                let res = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=100', {method: 'get', headers})
                let result = await res.json();

                let record = {timestamp: Date.parse(result.status.timestamp)}
                result.data.forEach(item => {
                    if(coins[item.symbol] === item.id) {
                        record[item.symbol] = item.quote.USD.price;
                    }
                })

                for(let i in coins2) {
                    let resOther = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=1&convert_id=${coins2[i]}`, {method: 'get', headers})
                    let resultOther = await resOther.json();

                    if(resultOther.data[0].id === 1) {
                        let priceAtBTC = resultOther.data[0].quote[coins2[i]].price;
                        record[i] = record['BTC'] / priceAtBTC;
                    } else {
                        logger.error(`[Get CMC PRICE] the base coin changed`);
                    }
                }

                logger.info(`[Get CMC PRICE] Price: ${JSON.stringify(record)}`);
                await meteastDBService.insertCoinsPrice(record);
                await meteastDBService.removeOldPriceRecords(record.timestamp - 30 * 24 * 60 * 60 * 1000)
            })
        }
    }
}
