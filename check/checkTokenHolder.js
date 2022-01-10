const {MongoClient} = require("mongodb");
const config = require("../config");

async function checkTokenHolder() {
    let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
    try {
        await mongoClient.connect();
        const collection = mongoClient.db(config.dbName).collection('meteast_token');
        let result = await collection.find({}).sort({blockNumber: -1}).project({"_id": 0, tokenId: 1, holder: 1}).toArray();

        let tokenHolderMap = new Map();
        result.forEach(item => {
            tokenHolderMap.set(item.tokenId, item.holder);
        })

        const collection2 = mongoClient.db(config.dbName).collection('meteast_token_event');
        let result2 = await collection2.aggregate([
            { $sort: {blockNumber: -1}},
            { $group: {_id: "$tokenId", doc: {$first: "$$ROOT"}}},
            { $replaceRoot: { newRoot: "$doc"}},
            { $project: {"_id": 0, tokenId:1,  holder: "$to"}}
        ]).toArray();

        let tokenEventHolderMap = new Map();
        result2.forEach(item => {
            tokenEventHolderMap.set(item.tokenId, item.holder);
        })

        let i = 0;
        tokenEventHolderMap.forEach((holder, tokenId) => {
            if(holder !== tokenHolderMap.get(tokenId)) {
                console.log(`${tokenId}:\t${tokenHolderMap.get(tokenId)} <==> ${holder}`)
                i++;
            }
        })
        console.log(`Token Holder Count:\t${tokenHolderMap.size}`);
        console.log(`Token Event Holder Count:\t${tokenEventHolderMap.size}`);
        return i;
    } catch (err) {
        logger.error(err);
    } finally {
        await mongoClient.close();
    }
}

checkTokenHolder().then(console.log)

