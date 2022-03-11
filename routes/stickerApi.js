let express = require('express');
let router = express.Router();
let stickerDBService = require('../service/stickerDBService');
const { filter } = require('mongodb/lib/core/connection/logger');

router.get('/listTokens', function(req, res) {
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.listTokens(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/search', function(req, res) {
    let keyword = req.query.key;

    if(!keyword) {
        res.json({code: 400, message: 'bad request'})
        return;
    }

    if(keyword.startsWith('0x') && keyword.length > 42) {
        keyword = BigInt(keyword).toFormat({prefix:""});
    }

    stickerDBService.search(keyword).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/query', function(req, res) {
    let owner = req.query.owner;
    let creator = req.query.creator;
    let typesStr = req.query.types;

    let types = undefined;
    if(typesStr !== undefined) {
        if(typeof typesStr !== "object") {
            types = [typesStr];
        } else {
            types = typesStr;
        }
        if(types[0] === 'image' || types[0] === 'avatar') {
            if(types[1] === 'feeds-channel' || types.length > 2) {
                res.json({code: 400, message: 'bad request'})
            }
        } else {
            if(types[0] === 'feeds-channel' && types.length > 1) {
                res.json({code: 400, message: 'bad request'})
            }
        }
    }

    if(!owner && !creator) {
        res.json({code: 400, message: 'bad request'})
        return;
    }

    stickerDBService.query(owner, creator, types).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/tokenTrans', function(req, res) {
    let tokenId = req.query.tokenId;

    if(!tokenId) {
        res.json({code: 400, message: 'bad request'})
        return;
    }

    if(tokenId.startsWith('0x') && tokenId.length > 42) {
        tokenId = BigInt(tokenId).toFormat({prefix:""});
    }

    stickerDBService.tokenTrans(tokenId).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/listTrans', function(req, res) {
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let methodStr = req.query.method;
    let timeOrderStr = req.query.timeOrder;
    let pageNum, pageSize, method, timeOrder;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        method = methodStr ? methodStr : 'All';
        timeOrder = timeOrderStr ? parseInt(timeOrderStr) : -1; 
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }
    stickerDBService.listTrans(pageNum, pageSize, method, timeOrder).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/nftnumber', function(req, res) {

    stickerDBService.nftnumber().then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/updateOrderEventCollection', function(req, res) {

    stickerDBService.updateOrderEventCollection().then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/updateAllEventCollectionForGasFee', function(req, res) {

    stickerDBService.updateAllEventCollectionForGasFee().then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/relatednftnum', function(req, res) {

    stickerDBService.relatednftnum().then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/owneraddressnum', function(req, res) {

    stickerDBService.owneraddressnum().then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/gettv', function(req, res) {
    stickerDBService.gettv().then(result => {
        console.log(result);
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code : 500, message: 'server error'});
    })
});

router.get('/getNftPriceByTokenId', function(req, res) {
    let tokenId = req.query.tokenId;
    tokenId = tokenId ? tokenId: "^";
    stickerDBService.getNftPriceByTokenId(tokenId).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getTranDetailsByTokenId', function(req, res) {
    let tokenId = req.query.tokenId;
    let method = req.query.method;
    let orderType = req.query.orderType
    method = method ? method : 'All';    
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let pageNum, pageSize;
    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }
    stickerDBService.getTranDetailsByTokenId(tokenId, method, orderType, pageNum, pageSize).then(result => {
      res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getCollectibleByTokenId', function(req, res) {
    let tokenId = req.query.tokenId;
    stickerDBService.getCollectibleByTokenId(tokenId).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getCollectiblesByCreator', function(req, res) {
    let creator = req.query.creator;
    stickerDBService.getCollectiblesByCreator(creator).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getCollectiblesByNameDescription', function(req, res) {
    let keyword = req.query.keyword;
    stickerDBService.getCollectiblesByNameDescription(keyword).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getTotalRoyaltyandTotalSaleByWalletAddr', function(req, res) {
    let walletAddr = req.query.walletAddr;
    let type = req.query.type;
    walletAddr = walletAddr ? walletAddr.toString(): "^";
    type = type ? type: 0;
    stickerDBService.getTotalRoyaltyandTotalSaleByWalletAddr(walletAddr, type).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getStastisDataByWalletAddr', function(req, res) {
    let walletAddr = req.query.walletAddr;
    walletAddr = walletAddr ? walletAddr.toString(): "^";
    stickerDBService.getStastisDataByWalletAddr(walletAddr).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getTranDetailsByWalletAddr', function(req, res) {
    let walletAddr = req.query.walletAddr.toString();
    let method = req.query.method;
    let timeOrder = req.query.timeOrder;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword ? req.query.keyword : "";
    let performer = req.query.performer;

    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        method = method ? method : 'All';
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getTranDetailsByWalletAddr(walletAddr, method, timeOrder, keyword, pageNum, pageSize, performer).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getLatestBids', function(req, res) {
    let tokenId = req.query.tokenId;
    let address = req.query.address;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    tokenId = tokenId ? tokenId : '';
    address = address ? address: '';
    let pageNum, pageSize;
    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }
    stickerDBService.getLatestBids(tokenId.toString(), address.toString(), pageNum, pageSize).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getLatestElaPrice', function(req, res) {
    stickerDBService.getLatestElaPrice().then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getAuctionOrdersByTokenId', function(req, res) {
    let tokenId = req.query.tokenId;
    stickerDBService.getAuctionOrdersByTokenId(tokenId.toString()).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getFixSaleOrdersByTokenId', function(req, res) {
    let tokenId = req.query.tokenId;
    stickerDBService.getFixSaleOrdersByTokenId(tokenId.toString()).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getEarnedByWalletAddress', function(req, res) {
    let address = req.query.address;
    stickerDBService.getEarnedByWalletAddress(address.toString()).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getTodayEarnedByWalletAddress', function(req, res) {
    let address = req.query.address;
    stickerDBService.getTodayEarnedByWalletAddress(address.toString()).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getEarnedListByAddress', function(req, res) {
    let address = req.query.address;
    address = address ? address: '';
    stickerDBService.getEarnedListByAddress(address.toString()).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
})

router.get('/getSelfCreateNotSoldCollectible', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getSelfCreateNotSoldCollectible(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getSoldPreviouslyBoughtCollectible', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getSoldPreviouslyBoughtCollectible(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
});


router.get('/getForSaleCollectible', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getForSaleCollectible(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
})

router.get('/getSoldCollectibles', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getSoldCollectibles(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
})

router.get('/getBoughtNotSoldCollectible', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getBoughtNotSoldCollectible(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
})


router.get('/getOwnCollectible', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getOwnCollectible(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
});


router.get('/getCollectiblesByTokenIds', function(req, res) {
    let tokenIds = req.query.tokenIds;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getCollectiblesByTokenIds(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, tokenIds).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/listMarketTokens', function(req, res) {
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_min_price;
    let filter_max_price = req.query.filter_max_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.listMarketTokens(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getFavoritesCollectible', function(req, res) {
    let did = req.query.did;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }
    stickerDBService.getFavoritesCollectible(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, did).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getAllCollectibleByAddress', function(req, res) {
    let selfAddr = req.query.selfAddr;
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword;
    let orderType = req.query.orderType;
    let filter_status = req.query.filter_status;
    let filter_min_price = req.query.filter_status;
    let filter_max_price = req.query.filter_min_price;
    let pageNum, pageSize;

    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        filter_min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        filter_max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;
        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.getAllCollectibleByAddress(pageNum, pageSize, keyword, orderType, filter_status, filter_min_price, filter_max_price, selfAddr).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getBlindboxCandidate', function(req, res) {
    let address = req.query.address;
    let keyword = req.query.keyword;
    stickerDBService.getBlindboxCandidate(address, keyword).then(result => {
        res.json(result);
    }).catch(error => {
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/getTokenByTokenId', function(req, res) {
    let tokenId = req.query.tokenId;
    stickerDBService.getTokenByTokenId(tokenId.toString()).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.post('/updateAuthorOfToken', function(req, res) {
    let did = req.body.did;
    let name = req.body.name;
    let description = req.body.description;
    
    stickerDBService.updateAuthorOfToken(did, name, description).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

module.exports = router;
