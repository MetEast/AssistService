const cron = require("node-cron");
let MongoClient = require('mongodb').MongoClient;
let Web3 = require('web3');
let config = require('../config');
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
let webSocketService = require('./webSocketService');
let vestingContractABI = require('../contractABI/tokenVesting');

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
      let notifyContext = `Your <b>${cell.name}</b> Project Auction has just ended! Please Settle the auction.`
      webSocketService.makeSocketData(notifyTitle, notifyContext, cell.holder);
    });
  } catch (err) {
      logger.error(err);
      throw new Error();
  } finally {
      await mongoClient.close();
  }
})

cron.schedule("0 */5 * * * *", async () => {
  try {
    let web3Rpc = new Web3(config.escRpcUrl);
    const account = await web3Rpc.eth.accounts.privateKeyToAccount(process.env.wallet_key);
    web3Rpc.eth.accounts.wallet.add(account);
    web3Rpc.eth.defaultAccount = account.address;

    let vestingContract = new web3Rpc.eth.Contract(vestingContractABI, config.vestingContract);
    vestingContract.methods.releaseMiningPool().send({from: web3Rpc.eth.defaultAccount, gas: 100000}, function(err, res) {
      if (err) {
        console.log("An error occured", err)
        return
      }
      console.log("Hash of the transaction: " + res)
    });
  } catch(err) {
    console.log(err);
  }
})