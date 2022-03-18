const cron = require("node-cron");
let MongoClient = require('mongodb').MongoClient;
let config = require('../config');
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
let webSocketService = require('./webSocketService');

cron.schedule("0 */1 * * *", async () => {
  // get all tokens
  let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
  try {
    let now = (new Date()/1000).toFixed();
    await mongoClient.connect();
    const collection = mongoClient.db(config.dbName).collection('meteast_token');
    let listToken = await collection.find({status: 'ON AUCTION', endTime: {$gt: now}}).toArray();
    listToken.map(cell => {
      let notifyTitle = 'Auction expired!';
      let notifyContext = `Your ${cell.name} Project Auction has just ended! Please Settle the auction.`
      webSocketService.makeSocketData(notifyTitle, notifyContext, cell.holder);
    });
  } catch (err) {
      logger.error(err);
      throw new Error();
  } finally {
      await mongoClient.close();
  }
})