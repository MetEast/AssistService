const { recoverPersonalSignature } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-util');
const jwt = require('jsonwebtoken')
const  ObjectID = require('mongodb').ObjectId;
const jwt_config = {
	algorithms: ['HS256'],
	secret: 'shhhh', // TODO Put in process.env
};;

const config = require("../config");
const {MongoClient} = require("mongodb");
module.exports = {
    create: async function (signature, publicAddress) {
        if (!signature || !publicAddress)
            return { code: 400, message: 'Request should have signature and publicAddress' };
        
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('meteast_address_did');
            let user = await collection.findOne({address: publicAddress});
            if(!user) {
                return { code: 401, message: `User with publicAddress ${publicAddress} is not found in database` };
            }
            const msg = `I am signing my one-time nonce: ${user.nonce}`;
            const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
            const address = recoverPersonalSignature({
                data: msgBufferHex,
                sig: signature,
            });

            // The signature verification is successful if the address found with
            // sigUtil.recoverPersonalSignature matches the initial publicAddress
            if (!address.toLowerCase() === publicAddress.toLowerCase()) {
                return {code: 401, message: 'Signature verification failed'};
            }
            user.nonce = Math.floor(Math.random() * 10000);
            console.log(user, 'hrer is udpate');
            await collection.updateOne({_id: ObjectID(user._id)}, {_id: ObjectID(user._id)}, {$set : {nonce: user.nonce}},{ upsert: true });
            let token = jwt.sign(
                {
                    payload: {
                        id: user.id,
                        publicAddress,
                    },
                },
                jwt_config.secret,
                {
                    algorithm: jwt_config.algorithms[0],
                })
            
            if(!token)
                return {code: 401, message: 'Empty token'};
            return {accessToken: token};
        } catch (err) {
            logger.error(err);
            throw new Error();
        } finally {
            await mongoClient.close();
        }        
    }
}    