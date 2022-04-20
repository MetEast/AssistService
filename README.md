# MetEast Assist Serivce
The assist service keeps synchronizing all NFTs from ESC blockchain and store onto local DB and provie data-retrieve service to the frontend webApp. This service can be deployed in mutiple servers and works parallelly, therefore no single point of failures.

## Deployment

### Install prerequisites
Install nodejs, mongoDB, pm2 services before the deployment. Recommend to use **Ubuntu18.04".

```bash
$ sudo apt-get update

$ curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
$ sudo apt-get install -y nodejs

$ sudo apt-get install mongodb

$ sudo npm install -g pm2
$ sudo pm2 install pm2-intercom
```

### CreateDB

```bash
$ mongo
> use meteast_sources;
> db.meteast_order.createIndex({orderId: 1}, {unique: true});
> db.meteast_token.createIndex({tokenId: 1}, {unique: true});
```

### Run service

```bash
git clone https://github.com/elastos-trinity/meteast-assist-service.git
cd meteast-assist-service
npm install
pm2 start bin/www
```