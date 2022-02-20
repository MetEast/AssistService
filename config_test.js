module.exports = {
    mongodb: 'mongodb://localhost:27017',
    dbName: 'meteast_sources_test',
    dbUser: '',
    dbPass: '',

    mailHost: 'smtp.qq.com',
    mailPort: 465,
    mailUser: '445222754',
    mailPass: '',
    mailFrom: '445222754@qq.com',

    escWsUrl: 'wss://api-testnet.elastos.io/eth-ws',
    escRpcUrl: 'https://api-testnet.elastos.io/eth',

    meteastContract: '0x15319c02e6f6b4FcB90b465c135c63dc84B9afFC',
    stickerContract: '0x2Ac890bE6864e06774B34fb075d60CC2E03d286e',
    galleriaContract: '',
    meteastContractDeploy: 10748727,
    stickerContractDeploy: 10748727,
    galleriaContractDeploy: 0,
    ipfsNodeUrl: 'https://ipfs-test.meteast.io/ipfs/',

    serviceName: 'default',
    upgradeBlock: 9607086,
    elastos_transation_api_url: 'https://esc-testnet.elastos.io/api?module=transaction&action=gettxinfo&txhash=',
    elastos_latest_price_api_url: 'https://esc-testnet.elastos.io/api?module=stats&action=coinprice',
    centralAppUrl: 'https://backend-test.meteast.io',
    burnAddress: '0x0000000000000000000000000000000000000000',
    // centralAppUrl: 'http://localhost:3002',
    cmcApiKeys: []
}
