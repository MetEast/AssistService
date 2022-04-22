module.exports = {
    mongodb: 'mongodb://localhost:27017',
    dbName: 'meteast_sources_test123',
    dbUser: '',
    dbPass: '',

    mailHost: 'smtp.qq.com',
    mailPort: 465,
    mailUser: '445222754',
    mailPass: '',
    mailFrom: '445222754@qq.com',

    escWsUrl: 'wss://api-testnet.elastos.io/eth-ws',
    escRpcUrl: 'https://api-testnet.elastos.io/eth',

    meteastContract: '0xf3C7F093daBe7AD75964Aa6ad2D4260e0A7aC317',
    stickerContract: '0x4fBa29FF5290B8De210091B5Ab145CFc7904109b',
    galleriaContract: '',
    meteastContractDeploy: 11749778,
    stickerContractDeploy: 11749784,
    galleriaContractDeploy: 0,
    ipfsNodeUrl: 'https://ipfs-test.meteast.io/ipfs/',

    serviceName: 'default',
    upgradeBlock: 9607086,
    elastos_transation_api_url: 'https://esc-testnet.elastos.io/api?module=transaction&action=gettxinfo&txhash=',
    elastos_latest_price_api_url: 'https://esc-testnet.elastos.io/api?module=stats&action=coinprice',
    centralAppUrl: 'https://backend-test.meteast.io',
    burnAddress: '0x0000000000000000000000000000000000000000',
    // centralAppUrl: 'http://localhost:3002',
    cmcApiKeys: [
        "521e2027-4f7e-4fa3-8a13-37ba061023f4",
        "4fa7c6d7-5725-4342-a189-7d0cef2b906b",
        "1b6a40f4-8c0f-4605-8502-6d3385da0db1",
        "355418f4-6912-45f1-8ea6-b16a235b3859",
        "2192fabc-19cc-4f97-8bc8-67cdbe6f1cc2",
        "2ea8215e-022d-4d65-b8d8-48dee70daa9e",
        "c6d2dedb-c75c-4bbe-8e59-80dcd49145e6"
    ],
    deployerList: [
        "0x93b76C16e8A2c61a3149dF3AdCbE604be1F4137b",
    ]
}
