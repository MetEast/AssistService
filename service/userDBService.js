
const jwt_config = {
	algorithms: ['HS256'],
	secret: 'shhhh', // TODO Put in process.env
};
const config = require("../config");
const {MongoClient} = require("mongodb");
module.exports = {
    find: async function(publicAddress) {
        console.log('find function');
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            console.log('try catch clause', publicAddress);
            const collection = client.db(config.dbName).collection('meteast_address_did');
            console.log('first step')
            let result = await collection.find({"address": new RegExp('^' + publicAddress)}).toArray();
            console.log('second step', result);
            return {code: 200, message: 'sucess', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await client.close();
        }
    },

    get: async function(_id, userId) {
        if(_id !== userId) {
            return {code: 401, message: 'You can only access yourself'};
        }
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_address_did');
            let result = await collection.findOne({_id: userId})
            return {code: 200, message: 'sucess', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await client.close();
        }
    },

    create: async function(params) {
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_address_did');
            params.nonce =  Math.floor(Math.random() * 10000);
            // params.id = 1;
            // params.username = "";
            await collection.insertOne(params)
            return {code: 200, message: 'sucess', data: params};
        } catch (err) {
            logger.error(err);
        } finally {
            await client.close();
        }
    }, 

    patch: async function(_id, userId, params) {
        if(_id !== userId) {
            return {code: 401, message: 'You can only access yourself'};
        }
        let client = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await client.connect();
            const collection = client.db(config.dbName).collection('meteast_address_did');
            let result = collection.findOne({_id: userId});
            if(!result) {
                params.nonce =  Math.floor(Math.random() * 10000);
                collection.insertOne(params);
            }
            return {code: 200, message: 'sucess', data: result};
        } catch (err) {
            logger.error(err);
        } finally {
            await client.close();
        }
    }
}
