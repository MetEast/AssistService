module.exports = {
    mongodb: 'mongodb://localhost:27017',
    dbName: 'meteast_sources',
    dbUser: '',
    dbPass: '',

    mailHost: 'smtp.qq.com',
    mailPort: 465,
    mailUser: '445222754',
    mailPass: '',
    mailFrom: '445222754@qq.com',

    escWsUrl: 'wss://api.elastos.io/eth-ws',
    escRpcUrl: 'https://api.elastos.io/eth',

    meteastContract: '0x7c0c3c566beCBB454Ce867a67C0faAfBe1D24590',
    stickerContract: '0x350D156C0D4b8E8437eaA81226d8c0638C5bCf94',
    galleriaContract: '',
    meteastContractDeploy: 10143708,
    stickerContractDeploy: 10143710,
    galleriaContractDeploy: 0,
    ipfsNodeUrl: 'https://ipfs.trinity-feeds.app/ipfs/',

    serviceName: 'default',
    upgradeBlock: 9607086,
    elastos_transation_api_url: 'https://esc.elastos.io/api?module=transaction&action=gettxinfo&txhash=',
    elastos_latest_price_api_url: 'https://esc.elastos.io/api?module=stats&action=coinprice',
    cmcApiKeys: [],
    curNetwork: 'testNet'
}
