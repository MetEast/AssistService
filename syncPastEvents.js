const schedule = require('node-schedule');
let Web3 = require('web3');
let meteastDBService = require('./service/meteastDBService');
let stickerDBService = require('./service/stickerDBService');
let config = require('./config');
let meteastContractABI = require('./contractABI/meteastABI');
let stickerContractABI = require('./contractABI/stickerABI');
let jobService = require('./service/jobService');
const config_test = require("./config_test");
config = config.curNetwork == 'testNet'? config_test : config;
global.fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let web3WsProvider = new Web3.providers.WebsocketProvider(config.escWsUrl, {
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


let web3Rpc = new Web3(config.escRpcUrl);
let meteastContract = new web3Rpc.eth.Contract(meteastContractABI, config.meteastContract);
let stickerContract = new web3Rpc.eth.Contract(stickerContractABI, config.stickerContract);

let now = Date.now();
const burnAddress = config.burnAddress;

let orderForSaleJobCurrent = config.meteastContractDeploy,
    orderForAuctionJobCurrent = config.meteastContractDeploy,
    orderBidJobCurrent = config.meteastContractDeploy,
    orderFilledJobCurrent = config.meteastContractDeploy,
    orderCanceledJobCurrent = config.meteastContractDeploy,
    orderPriceChangedJobCurrent = config.meteastContractDeploy,
    tokenInfoSyncJobCurrent = config.stickerContractDeploy,
    // tokenInfoMemoSyncJobCurrent = config.stickerContractDeploy;
    approvalJobCurrent = config.meteastContractDeploy;
const step = 20000;
web3Rpc.eth.getBlockNumber().then(currentHeight => {
    schedule.scheduleJob({start: new Date(now + 60 * 1000), rule: '0 * * * * *'}, async () => {
        if(orderForSaleJobCurrent > currentHeight) {
            console.log(`[OrderForSale] Sync ${orderForSaleJobCurrent} finished`)
            return;
        }
        const tempBlockNumber = orderForSaleJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[OrderForSale] Sync ${orderForSaleJobCurrent} ~ ${toBlock} ...`)

        stickerContractWs.getPastEvents('OrderForSale', {
            fromBlock: orderForSaleJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                console.log(`[OrderForSale] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                
            })
            orderForSaleJobCurrent = toBlock + 1;
        }).catch(error => {
            console.log(error);
            console.log("[OrderForSale] Sync Ending ...")
        })
    });

    schedule.scheduleJob({start: new Date(now + 7 * 60 * 1000), rule: '0 * * * * *'}, async () => {
        if(orderForAuctionJobCurrent > currentHeight) {
            console.log(`[OrderForAuction] Sync ${orderForAuctionJobCurrent} finished`)
            return;
        }
        const tempBlockNumber = orderForAuctionJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[OrderForAuction] Sync ${orderForAuctionJobCurrent} ~ ${toBlock} ...`)

        stickerContractWs.getPastEvents('OrderForAuction', {
            fromBlock: orderForAuctionJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                console.log(`[OrderForAuction] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
            })
            orderForAuctionJobCurrent = toBlock + 1;
        }).catch(error => {
            console.log(error);
            console.log("[OrderForAuction] Sync Ending ...")
        })
    });
    
    schedule.scheduleJob({start: new Date(now + 8 * 60 * 1000), rule: '0 * * * * *'}, async () => {
        if(orderBidJobCurrent > currentHeight) {
            console.log(`[OrderBid] Sync ${orderBidJobCurrent} finished`)
            return;
        }
        const tempBlockNumber = orderBidJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[OrderBid] Sync ${orderBidJobCurrent} ~ ${toBlock} ...`)

        stickerContractWs.getPastEvents('OrderBid', {
            fromBlock: orderBidJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: orderInfo._buyer,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: orderInfo._price, timestamp: result.updateTime, gasFee: gasFee}

                console.log(`[OrderBid] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
            })
            orderBidJobCurrent = toBlock + 1;
        }).catch(error => {
            console.log(error);
            console.log("[OrderBid] Sync Ending ...")
        })
    });

    schedule.scheduleJob({start: new Date(now + 2 * 60 * 1000), rule: '10 * * * * *'}, async () => {
        if(orderPriceChangedJobCurrent > currentHeight) {
            console.log(`[OrderPriceChanged] Sync ${orderPriceChangedJobCurrent} finished`)
            return;
        }

        const tempBlockNumber = orderPriceChangedJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[OrderPriceChanged] Sync ${orderPriceChangedJobCurrent} ~ ${toBlock} ...`)

        stickerContractWs.getPastEvents('OrderPriceChanged', {
            fromBlock: orderPriceChangedJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id,
                    data: {oldPrice: orderInfo._oldPrice, newPrice: orderInfo._newPrice}, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                console.log(`[OrderPriceChanged] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
            })

            orderPriceChangedJobCurrent = toBlock + 1;
        }).catch( error => {
            console.log(error);
            console.log("[OrderPriceChanged] Sync Ending ...");
        })
    });

    schedule.scheduleJob({start: new Date(now + 3 * 60 * 1000), rule: '20 * * * * *'}, async () => {
        if(orderFilledJobCurrent > currentHeight) {
            console.log(`[OrderFilled] Sync ${orderFilledJobCurrent} finished`)
            return;
        }

        const tempBlockNumber = orderFilledJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[OrderFilled] Sync ${orderFilledJobCurrent} ~ ${toBlock} ...`)

        stickerContractWs.getPastEvents('OrderFilled', {
            fromBlock: orderFilledJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee}

                console.log(`[OrderFilled] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
                
                // here is a part for platformfee collection
                orderEventDetail = {orderId: orderInfo._orderId, blockNumber: event.blockNumber, txHash: event.transactionHash,
                    txIndex: event.transactionIndex, platformAddr: result.platformAddr, platformFee: result.platformFee};

                logger.info(`[OrderPlatformFee] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderPlatformFeeEvent(orderEventDetail);
            })
            orderFilledJobCurrent = toBlock + 1;
        }).catch( error => {
            console.log(error);
            console.log("[OrderFilled] Sync Ending ...");
        })
    });

    schedule.scheduleJob({start: new Date(now + 4 * 60 * 1000), rule: '30 * * * * *'}, async () => {
        if(orderCanceledJobCurrent > currentHeight) {
            console.log(`[OrderCanceled] Sync ${orderCanceledJobCurrent} finished`)
            return;
        }

        const tempBlockNumber = orderCanceledJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[OrderCanceled] Sync ${orderCanceledJobCurrent} ~ ${toBlock} ...`)

        stickerContractWs.getPastEvents('OrderCanceled', {
            fromBlock: orderCanceledJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let orderInfo = event.returnValues;
                let result = await stickerContract.methods.getOrderById(orderInfo._orderId).call();
                let gasFee = await stickerDBService.getGasFee(event.transactionHash);
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id, sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr,
                    royaltyFee: result.royaltyFee, tokenId: result.tokenId, price: result.price, timestamp: result.updateTime, gasFee: gasFee};

                console.log(`[OrderCanceled] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                await meteastDBService.insertOrderEvent(orderEventDetail);
                await stickerDBService.updateOrder(result, event.blockNumber, orderInfo._orderId);
            })
            orderCanceledJobCurrent = toBlock + 1;
        }).catch( error => {
            console.log(error);
            console.log("[OrderCanceled] Sync Ending ...");
        })
    });

    /**
     * transferSingle event
     */
    schedule.scheduleJob({start: new Date(now + 2 * 60 * 1000), rule: '40 * * * * *'}, async () => {
        if(tokenInfoSyncJobCurrent > currentHeight) {
            console.log(`[TokenInfo] Sync ${tokenInfoSyncJobCurrent} finished`)
            return;
        }

        const tempBlockNumber = tokenInfoSyncJobCurrent + step
        const toBlock = Math.min(tempBlockNumber, currentHeight);

        console.log(`[TokenInfo] Sync ${tokenInfoSyncJobCurrent} ~ ${toBlock} ...`)

        meteastContractWs.getPastEvents('Transfer', {
            fromBlock: tokenInfoSyncJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                let blockNumber = event.blockNumber;
                let txHash = event.transactionHash;
                let txIndex = event.transactionIndex;
                let from = event.returnValues._from;
                let to = event.returnValues._to;

                // if(from !== burnAddress && to !== burnAddress && blockNumber > config.upgradeBlock) {
                //     return;
                // }

                let tokenId = event.returnValues._tokenId;
                let value = 1;
                let timestamp = (await web3Rpc.eth.getBlock(blockNumber)).timestamp;
                let gasFee = await stickerDBService.getGasFee(txHash);
                let transferEvent = {tokenId, blockNumber, timestamp,txHash, txIndex, from, to, value, gasFee: gasFee}
                await stickerDBService.addEvent(transferEvent);

                if(to === burnAddress) {
                    // await stickerDBService.burnToken(tokenId);
                } else if(from === burnAddress) {
                    try {
                        console.log(tokenId);
                        let result = await meteastContract.methods.tokenInfo(tokenId).call();
                        console.log(result);
                        let token = {blockNumber, tokenIndex: result.tokenIndex, tokenId, quantity: result.tokenSupply,
                            royalties:result.royaltyFee, royaltyOwner: result.royaltyOwner, holder: result.royaltyOwner,
                            createTime: result.createTime, updateTime: result.updateTime}

                        token.tokenIdHex = '0x' + BigInt(tokenId).toString(16);

                        let data = await jobService.getInfoByIpfsUri(result.tokenUri);
                        token.tokenJsonVersion = data.version;
                        token.type = data.type;
                        token.name = data.name;
                        token.description = data.description;
                        if(data.creator) {
                            token.authorName = data.creator.name;
                            token.authorDid = data.creator.did;
                            token.authorDescription = data.creator.description;
                            await meteastDBService.replaceDid({address: result.royaltyOwner, did: token.authorDid});
                        }
                        if(blockNumber > config.upgradeBlock) {
                            // let extraInfo = await meteastContract.methods.tokenExtraInfo(tokenId).call();
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
                            console.log(`[TokenInfo] New token info: ${JSON.stringify(token)}`)
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
                            // if(parseInt(token.tokenJsonVersion) == 1) {
                            //     token.thumbnail = data.thumbnail;
                            //     token.asset = data.image;
                            //     token.kind = data.kind;
                            //     token.size = data.size;
                            // }else {
                            //     token.thumbnail = data.data.thumbnail;
                            //     token.asset = data.data.image;
                            //     token.kind = data.data.kind;
                            //     token.size = data.data.size;
                            //     if(data.properties !== undefined)
                            //         token.properties = data.properties;
                            // }
                        }
                        token.price = 0;
                        token.marketTime = null;
                        token.endTime = null;
                        token.orderId = null;
                        token.status = 'NEW';
                        token.category = data.category ? data.category : 'other';
                        console.log(`[TokenInfo] New token info: ${JSON.stringify(token)}`)
                        await stickerDBService.replaceToken(token);
                    } catch (e) {
                        console.log(`[TokenInfo] Sync error at ${event.blockNumber} ${tokenId}`);
                        console.log(e);
                    }
                } else {
                    await stickerDBService.updateToken(tokenId, to, timestamp, blockNumber);
                }
            })
            tokenInfoSyncJobCurrent = toBlock + 1;
        }).catch(error => {
            console.log(error);
            console.log("[TokenInfo] Sync Ending ...");
        })
    });

    // /**
    //  * transferSingleWithMemo event
    //  */
    // schedule.scheduleJob({start: new Date(now + 3 * 60 * 1000), rule: '50 * * * * *'}, async () => {
    //     if(tokenInfoMemoSyncJobCurrent <= config.upgradeBlock && tokenInfoMemoSyncJobCurrent <= currentHeight) {
    //         const tempBlockNumber = tokenInfoMemoSyncJobCurrent + step
    //         const toBlock = Math.min(tempBlockNumber, currentHeight, config.upgradeBlock);
    //         console.log(`[TokenInfoMemo] ${tokenInfoMemoSyncJobCurrent} ~ ${toBlock} Sync have not start yet!`)
    //         tokenInfoMemoSyncJobCurrent = toBlock + 1;
    //         return;
    //     }

    //     if(tokenInfoMemoSyncJobCurrent > currentHeight) {
    //         console.log(`[TokenInfoMemo] Sync ${tokenInfoMemoSyncJobCurrent} finished`)
    //         return;
    //     }

    //     const tempBlockNumber = tokenInfoMemoSyncJobCurrent + step
    //     const toBlock = Math.min(tempBlockNumber, currentHeight);

    //     console.log(`[TokenInfoMemo] Sync ${tokenInfoMemoSyncJobCurrent} ~ ${toBlock} ...`)

    //     meteastContractWs.getPastEvents('TransferSingleWithMemo', {
    //         fromBlock: tokenInfoMemoSyncJobCurrent, toBlock
    //     }).then(events => {
    //         events.forEach(async event => {
    //             let from = event.returnValues._from;
    //             let to = event.returnValues._to;
    //             let tokenId = event.returnValues._id;
    //             let value = event.returnValues._value;
    //             let memo = event.returnValues._memo ? event.returnValues._memo : "";
    //             let blockNumber = event.blockNumber;
    //             let txHash = event.transactionHash;
    //             let txIndex = event.transactionIndex;
    //             let timestamp = (await web3Rpc.eth.getBlock(blockNumber)).timestamp;
    //             let gasFee = await stickerDBService.getGasFee(txHash);
    //             let transferEvent = {tokenId, blockNumber, timestamp,txHash, txIndex, from, to, value, memo, gasFee: gasFee}
    //             await stickerDBService.addEvent(transferEvent);
    //             await stickerDBService.updateToken(tokenId, to, timestamp, blockNumber);
    //         })
    //         tokenInfoMemoSyncJobCurrent = toBlock + 1;
    //     }).catch(error => {
    //         console.log(error);
    //         console.log("[TokenInfo] Sync Ending ...");
    //     })
    // })


    schedule.scheduleJob({start: new Date(now + 6 * 60 * 1000), rule: '30 * * * * *'}, async () => {
        if(approvalJobCurrent > currentHeight) {
            console.log(`[ApprovalForAll] Sync ${approvalJobCurrent} finished`)
            return;
        }

        const tempBlockNumber = approvalJobCurrent + step
        const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

        console.log(`[ApprovalForAll] Sync ${approvalJobCurrent} ~ ${toBlock} ...`)

        meteastContractWs.getPastEvents('ApprovalForAll', {
            fromBlock: approvalJobCurrent, toBlock
        }).then(events => {
            events.forEach(async event => {
                await stickerDBService.addAprovalForAllEvent(event);
            })
            approvalJobCurrent = toBlock + 1;
        }).catch( error => {
            console.log(error);
            console.log("[ApprovalForAll] Sync Ending ...");
        })
    });

    // schedule.scheduleJob({start: new Date(now + 9 * 60 * 1000), rule: '30 * * * * *'}, async () => {
    //     if(orderPlatformFeeJobCurrent > currentHeight) {
    //         console.log(`[OrderPlatformFee] Sync ${orderPlatformFeeJobCurrent} finished`)
    //         return;
    //     }

    //     const tempBlockNumber = orderPlatformFeeJobCurrent + step
    //     const toBlock = tempBlockNumber > currentHeight ? currentHeight : tempBlockNumber;

    //     console.log(`[OrderPlatformFee] Sync ${orderPlatformFeeJobCurrent} ~ ${toBlock} ...`)

    //     stickerContractWs.getPastEvents('OrderPlatformFee', {
    //         fromBlock: orderPlatformFeeJobCurrent, toBlock
    //     }).then(events => {
    //         events.forEach(async event => {
    //             let orderInfo = event.returnValues;
    //             let orderEventDetail = {orderId: orderInfo._orderId, blockNumber: event.blockNumber, txHash: event.transactionHash,
    //                 txIndex: event.transactionIndex, platformAddr: orderInfo._platformAddress, platformFee: orderInfo._platformFee};
    //             await meteastDBService.insertOrderPlatformFeeEvent(orderEventDetail);
    //         })
    //         orderPlatformFeeJobCurrent = toBlock + 1;
    //     }).catch( error => {
    //         console.log(error);
    //         console.log("[OrderPlatformFee] Sync Ending ...");
    //     })
    // });
})
