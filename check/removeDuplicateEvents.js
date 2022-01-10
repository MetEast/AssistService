const {MongoClient} = require("mongodb");
const config = require("../config");

async function removeDuplicateDBItem() {
    let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
    try {
        let promises = [];

        await mongoClient.connect();
        let collection1 = mongoClient.db(config.dbName).collection('meteast_token_event');
        let tokenEventDuplicate = await collection1.aggregate([
            {$group: {_id: {tokenId: "$tokenId", blockNumber:"$blockNumber"}, count: {$sum: 1}}},
            {$match: {"count": { "$gt": 1}}}
        ]).toArray();

        tokenEventDuplicate.forEach(item => {
            console.log(`remove ${JSON.stringify(item._id)} ==> ${item.count - 1} times`);
            for(let i = 0; i < item.count - 1; i++) {
                promises.push(collection1.deleteOne(item._id).then(result => result.deletedCount));
            }
        })


        let collection2 = mongoClient.db(config.dbName).collection('meteast_order_event');
        let orderEventDuplicate = await collection2.aggregate([
            {$group: {_id: {orderId: "$orderId", blockNumber:"$blockNumber"}, count: {$sum: 1}}},
            {$match: {"count": { "$gt": 1}}}
        ]).toArray();

        orderEventDuplicate.forEach(item => {
            console.log(`remove ${JSON.stringify(item._id)} ==> ${item.count - 1} times`);
            for(let i = 0; i < item.count - 1; i++) {
                promises.push(collection2.deleteOne(item._id).then(result => result.deletedCount));
            }
        })

        return await Promise.all(promises);
    } catch (err) {
        console.log(err);
    } finally {
        await mongoClient.close();
    }
}


removeDuplicateDBItem().then(console.log)
