let config = require('../config');
let MongoClient = require('mongodb').MongoClient;
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
let webSocketService = require('./webSocketService');

module.exports = {
    getAddressList: async function (address, pageNum, pageSize, keyword) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_address_did');
            let listAddress = await collection
              .find({$and: [{address: {$ne: address}}, {$or: [{address: {$regex: keyword}}, {"did.name": {$regex: keyword}}]}]})
              .skip((pageNum-1)*pageSize).limit(pageSize).toArray();

            for(var i = 0; i < listAddress.length; i++) {
              var index = config.deployerList.indexOf(listAddress[i]['address']);
              if(index != -1) {
                listAddress[i]['role'] = 0;
              }
            }
            return {code: 200, message: 'success', data: listAddress};
        } catch (err) {
          logger.error(err);
          return {code: 500, message: 'server error'};
        } finally {
          await mongoClient.close();
        }
    },
    updateRole: async function (address, role, remarks) {
      let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
      try {
          await mongoClient.connect();
          const collection = mongoClient.db(config.dbName).collection('meteast_address_did');
          await collection.updateOne({address: address}, {$set: {role, role, remarks: remarks}});
          
          let notifyTitle = 'Important Notice.';
          let notifyContext;
          if(role==3) {
            if(remarks == '' && remarks == null) {
              notifyContext = `Your account ${address} has been banned by admin.`;
            } else {
              notifyContext = `Your account ${address} has been banned by admin for the following reason: ${remarks}`;
            }
          } else if(role==1) {
            notifyContext = `Your account has been set to the moderator by admin.`;
          } else if(role==2) {
            notifyContext = `Your account has been set to the normal user by admin.`;
          }
          webSocketService.makeSocketData(notifyTitle, notifyContext, address);

          return {code: 200, message: 'success'};
      } catch (err) {
        logger.error(err);
        return {code: 500, message: 'server error'};
      } finally {
        await mongoClient.close();
      }
    },
    
}
