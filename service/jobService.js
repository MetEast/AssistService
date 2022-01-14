let config = require("../config");
const config_test = require("../config_test");
config = config.curNetwork == 'testNet'? config_test : config;
module.exports = {

    getInfoByIpfsUri: async function(uri) {
        let tokenCID = uri.split(":")[2];
        let response = await fetch(config.ipfsNodeUrl + tokenCID);
        return await response.json();
    }
}
