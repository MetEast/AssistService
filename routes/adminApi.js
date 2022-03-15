let express = require('express');
let router = express.Router();
let meteastDBService = require('../service/meteastDBService');
let adminDBService = require('../service/adminDBService');
const { route } = require('express/lib/application');

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
    let pageSize = pageSizeStr ? parseInt(pageSizeStr) : 10;

    adminDBService.getAddressList(address, pageNum, pageSize, keyword).then(result => {
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

router.post('/createBanner', function(req, res) {
    let owner = req.body.owner;
    let image = req.body.image;
    let location = req.body.location;
    let status = req.body.status;
    let sort = req.body.sort;

    adminDBService.createBanner(owner, image, location, status, sort).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/listBanner', function(req, res) {
    let owner = req.query.owner;
    let strPageNum = req.query.pageNum;
    let strPageSize = req.query.pageSize; 

    let pageNum = strPageNum ? parseInt(strPageNum) : 1;
    let pageSize = strPageSize ? parseInt(strPageSize) : 10;

    adminDBService.listBanner(owner, pageNum, pageSize).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.post('/updateBanner', function(req, res) {
    let id = req.body.id;
    if(!id) {
        res.json({code: 500, message: 'server error'});
        return;
    }

    let image = req.body.image;
    let location = req.body.location;
    let status = req.body.status;
    let sort = req.body.sort;

    adminDBService.updateBanner(id, image, location, status, sort).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/deleteBanner', function(req, res) {
    let id = req.query.id;
    if(!id) {
        res.json({code: 500, message: 'server error'});
        return;
    }
    adminDBService.deleteBanner(id).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

module.exports = router;
