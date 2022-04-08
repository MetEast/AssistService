let express = require('express');
let router = express.Router();
let meteastDBService = require('../service/meteastDBService');
let adminDBService = require('../service/adminDBService');
let stickerDBService = require('../service/stickerDBService');
const { route } = require('express/lib/application');

router.get('/listaddress', function(req, res) {

    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword ? req.query.keyword : '';
    let type = req.query.type;
    let pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
    let pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;

    adminDBService.getAddressList(pageNum, pageSize, keyword, type).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.post('/updateRole', function(req, res) {
    let address = req.body.address;
    let role = req.body.userRole;
    let remarks = req.body.remarks;

    adminDBService.updateRole(address, role, remarks).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
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
    let status = req.query.status;
    let pageNum, pageSize, max_price, min_price;
    try {
        pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
        pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;
        keyword = keyword ? keyword : '';
        filter_status = filter_status ? filter_status : '';
        status = status ? status : '';
        min_price = filter_min_price ? parseInt(filter_min_price) : 0;
        max_price = filter_max_price ? parseInt(filter_max_price) : 10000000000000000000000000000000000000000000000000000000000;

        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    stickerDBService.listAdminMarketTokens(pageNum, pageSize, keyword, orderType, filter_status, min_price, max_price, status).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

module.exports = router;
