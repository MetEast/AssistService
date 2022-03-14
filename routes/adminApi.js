let express = require('express');
let router = express.Router();
let meteastDBService = require('../service/meteastDBService');
let adminDBService = require('../service/adminDBService');

router.get('/listaddress', function(req, res) {
    let address = req.query.address;
    if(!address) {
        res.json({code: 500, message: 'server error'});
        return;
    }

    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;
    let keyword = req.query.keyword ? req.query.keyword : '';
    
    let pageNum = pageNumStr ? parseInt(pageNumStr) : 1;
    pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;

    adminDBService.getAddressList(address, pageNum, pageSize, keyword).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.post('/updateRole', function(req, res) {
    let address = req.body.address;
    let role = req.body.address;
    let remarks = req.body.remarks;

    adminDBService.updateRole(address, role, remarks).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

module.exports = router;
