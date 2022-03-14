let express = require('express');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let meteastApi = require('./routes/meteastApi');
let stickerApi = require('./routes/stickerApi');
let apiV2 = require('./routes/apiV2');
let adminApi = require('./routes/adminApi')
let jobs = require('./jobs');
let log4js = require('log4js');
let cors = require('cors');
log4js.configure({
    appenders: {
        file: { type: 'dateFile', filename: 'logs/meteast.log', pattern: ".yyyy-MM-dd.log", compress: true, },
        console: { type: 'stdout'}
    },
    categories: { default: { appenders: ['file', 'console'], level: 'info' } },
    pm2: true,
    pm2InstanceVar: 'INSTANCE_ID'
});
global.logger = log4js.getLogger('default');
global.fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let app = express();

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(log4js.connectLogger(logger, { level: log4js.levels.INFO }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());
app.use('/meteast/api/v1', meteastApi);
app.use('/sticker/api/v1', stickerApi);
app.use('/api/v2', apiV2);
app.use('/admin/api/v1', adminApi);

jobs.run()

module.exports = app;
