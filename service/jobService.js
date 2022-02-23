const { Logger } = require("mongodb/lib/core");
let config = require("../config");
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
module.exports = {

    getInfoByIpfsUri: async function(uri) {
        let tokenCID = uri.split(":")[2];
        
        try {
            let response = await fetch(config.ipfsNodeUrl + tokenCID);
            let result = await response.json();
            return result;
        } catch(err) {
            logger.error(err);
            console.log(err, 'fdsfdsfds')
        } finally {

        }
        
    }
}
