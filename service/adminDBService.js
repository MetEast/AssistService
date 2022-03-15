let config = require('../config');
let MongoClient = require('mongodb').MongoClient;
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
var ObjectID = require('mongodb').ObjectID;

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
          
          return {code: 200, message: 'success'};
      } catch (err) {
        logger.error(err);
        return {code: 500, message: 'server error'};
      } finally {
        await mongoClient.close();
      }
    },
    createBanner: async function(owner, image, location, status, sort) {
      let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
      try {
        await mongoClient.connect();
        const collection = mongoClient.db(config.dbName).collection('meteast_banner');
        let data = {
          owner: owner,
          image: image,
          location: location,
          status: status,
          sort: sort,
          active: 1
        }
        await collection.insertOne(data);
        
        return {code: 200, message: 'success'};
      } catch (err) {
        logger.error(err);
        return {code: 500, message: 'server error'};
      } finally {
        await mongoClient.close();
      }
    },
    listBanner: async function (owner, pageNum, pageSize) {
      let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
      try {
          await mongoClient.connect();
          const collection = mongoClient.db(config.dbName).collection('meteast_banner');
          
          let listAddress = await collection
            .find({owner: owner})
            .skip((pageNum-1)*pageSize).limit(pageSize).toArray();

          return {code: 200, message: 'success', data: listAddress};
      } catch (err) {
        logger.error(err);
        return {code: 500, message: 'server error'};
      } finally {
        await mongoClient.close();
      }
    },
    updateBanner: async function (id, image, location, status, sort) {
      let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
      try {
          await mongoClient.connect();
          const collection = mongoClient.db(config.dbName).collection('meteast_banner');
          
          let update = {};
          if(image) {
            update.image = image;
          }
          if(location) {
            update.location = location;
          }
          if(status) {
            update.status = status;
          }
          if(sort) {
            update.sort = sort;
          }
          
          await collection.updateOne({_id: ObjectID(id)}, {$set: update});

          return {code: 200, message: 'success'};
      } catch (err) {
        logger.error(err);
        return {code: 500, message: 'server error'};
      } finally {
        await mongoClient.close();
      }
    },
    deleteBanner: async function (id,) {
      let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
      try {
          await mongoClient.connect();
          const collection = mongoClient.db(config.dbName).collection('meteast_banner');
          
          await collection.updateOne({_id: ObjectID(id)}, {$set: {active: 0}});

          return {code: 200, message: 'success'};
      } catch (err) {
        logger.error(err);
        return {code: 500, message: 'server error'};
      } finally {
        await mongoClient.close();
      }
    },
}
