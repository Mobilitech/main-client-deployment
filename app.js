'use strict';

global.app_require = function(name){
  return require(__dirname + '/' + name);
}

const telepodDetails = require('./telepod_details'); //Secret keys file...
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const dbUtil = app_require('util/DBUtil.js');

//FOR API VERSIONING! Use/develop on different versions without affecting your current production version.
const apiControllerV1_0 = app_require('versions/1.0/AppController.js');
// const EXAMPLECONTROLLERV1_1 = app_require('versions/1.1/AppController.js);

const logger = app_require('util/loggerUtil.js');

/*
RATE-LIMITER for APIs. This is to control the amount of APIs/second to prevent spamming and overloading the servers
from requests. Help with DDOS attacks.
*/

const RateLimit = require('express-slow-down');
const createAccountLimiter = new RateLimit({
  windowMs: 4000,
  delayAfter: 60,
  delayMs: 3,
  max: 360,
  message:"HTTP REQUESTS EXCEEDED 60/s",
  statusCode:429,
  onLimitReached: function (req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    logger.logAPICall(ip,"RateLimit@26",["HTTP_REQUESTS_EXCEEDED"],"NIL");
  }
});

const http = require('http');
const app = express();
const server = http.createServer(app);

function checkSessionToken(req, res, next)
{
  const token = req.query.token !== undefined ? req.query.token :
    req.headers['x-access-token'] !== undefined ? req.headers['x-access-token'] : "NIL";
    try
    {
      logger.log("info",logger.logErrorReport("INFO","/1.0/CST@47",[token]));
      var _accountGroupsArr = dbUtil.getAccountGroups();
      if(token === "NIL")
      {
        logger.log("info",logger.logErrorReport("INFO","/1.0/CST@53",[token]));
        req.session.accountGroup = "NIL";
        next();
      }
      else if(_accountGroupsArr.find(p => p.clientToken == token) === undefined )
      {
        logger.log("info",logger.logErrorReport("INFO","/1.0/CST@60",[token]));
        req.session.accountGroup = "NIL";
        next();
      }
      else
      {
        logger.log("info",logger.logErrorReport("INFO","/1.0/CST@66",[token]));
        var _accountGroupTemp = _accountGroupsArr.find(p => p.clientToken == token).accountGroup
        _accountGroupTemp = _accountGroupTemp === "Telepod" ? "NIL" : _accountGroupTemp;
        req.session.accountGroup = _accountGroupTemp;
        next();
      }
    }
    catch(err)
    {
      if(err == null || err == undefined)
      {
        logger.catchFunc2("NIL","ERROR","/1.0/CST@67","Session Error\n[CST67]",
        "There seems to be a problem in processing your request, Please try again!",
        res,400,"https://ibb.co/k2zQzG");
      }
      else if(err.status !== undefined && err.status == "ERROR_MISSING_TOKEN")
      {
        logger.catchFunc2("NIL","ERROR_MISSING_TOKEN","/1.0/CST@88","Session Error\n[CST73]",
        "There seems to be a problem in processing your request, Please try again!",
        res,400,"https://ibb.co/k2zQzG");
      }
      else
      {
        logger.catchFunc2("NIL","ERROR_UNKNOWN_TOKEN","/1.0/CST@94","Session Error\n[CST94]",
        "There seems to be a problem in processing your request, Please try again!",
        res,400,"https://ibb.co/k2zQzG");
      }
    }
}
app.use(createAccountLimiter);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: telepodDetails.operatorSecretKey,
    resave: true,
    saveUninitialized: true,
}));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept , X-Access-Token");
  next();
});
//versiono 1.1 API
// <LIST YOUR NEW APIs HERE>

//version 1.0 API
app.get('/v1.0/getAllStations',checkSessionToken,apiControllerV1_0.getAllStations);
app.get('/v1.0/getOperatingZones',checkSessionToken,apiControllerV1_0.getOperatingZones);
app.get('/v1.0/quickBook',checkSessionToken,apiControllerV1_0.quickBook);
app.get('/v1.0/insertPromo',checkSessionToken,apiControllerV1_0.insertPromo);
app.get('/v1.0/getAllPass',checkSessionToken,apiControllerV1_0.getAllPass);
app.get('/v1.0/getPassObj',checkSessionToken,apiControllerV1_0.getPassObj);
app.get('/v1.0/checkActiveTrip',checkSessionToken,apiControllerV1_0.checkActiveTrip);
app.get('/v1.0/getUserActivePass',checkSessionToken,apiControllerV1_0.getUserActivePass);
app.post('/v1.0/qrDocklessDropCheck',checkSessionToken,apiControllerV1_0.qrDocklessDropCheck);
app.get('/v1.0/tripCompleted',checkSessionToken,apiControllerV1_0.tripCompleted);
app.get('/v1.0/getCommon',checkSessionToken,apiControllerV1_0.getCommon);
app.post('/v1.0/setUserFCMToken',checkSessionToken,apiControllerV1_0.setUserFCMToken);
app.get('/v1.0/getBestScooters',checkSessionToken,apiControllerV1_0.getBestScooters);
app.get('/v1.0/scooterReturned',checkSessionToken,apiControllerV1_0.scooterReturned);
app.get('/v1.0/getUserTrips',checkSessionToken,apiControllerV1_0.getUserTrips);
app.get('/v1.0/sendRefund',checkSessionToken,apiControllerV1_0.sendRefund);
app.post('/v1.0/updateTripImageUrl',checkSessionToken,apiControllerV1_0.updateTripImageUrl);
app.get('/v1.0/getUserObj',checkSessionToken,apiControllerV1_0.getUserOBJForFrontEnd);
app.post('/v1.0/2FAReg',checkSessionToken,apiControllerV1_0.twoFaReg);
app.post('/v1.0/2FAVer',checkSessionToken,apiControllerV1_0.twoFaVer);
app.get('/v1.0/getUsersByNumber',apiControllerV1_0.findNumberUserObj);
app.get('/v1.0/buzzScooter',checkSessionToken,apiControllerV1_0.buzzScooter);
app.post('/v1.0/swapScooter',checkSessionToken,apiControllerV1_0.swapScooter);
app.post('/v1.0/setUserProfile',checkSessionToken,apiControllerV1_0.setUserProfile);
app.get('/v1.0/lightOff',checkSessionToken,apiControllerV1_0.lightOff);
app.get('/v1.0/lightOn',checkSessionToken,apiControllerV1_0.lightOn);
app.get('/v1.0/getScootersInStation',checkSessionToken,apiControllerV1_0.getScootersInStation);
app.get('/v1.0/checkUserReferral',checkSessionToken,apiControllerV1_0.checkUserReferral);
app.get('/v1.0/unlockScooter',checkSessionToken,apiControllerV1_0.unlockScooter);
app.get('/v1.0/lockScooter',checkSessionToken,apiControllerV1_0.lockScooter);
app.get('/v1.0/convertUserDepositToCredit',checkSessionToken,apiControllerV1_0.convertUserDepositToCredit);
app.post('/v1.0/createScooterReport',checkSessionToken,apiControllerV1_0.createScooterReport);
app.post('/v1.0/setRefundReasons',checkSessionToken,apiControllerV1_0.setRefundReasons);
app.post('/v1.0/setRestoreId',checkSessionToken,apiControllerV1_0.setRestoreId);
app.get('/v1.0/getUserTransactions',checkSessionToken,apiControllerV1_0.getUserTransactions);

//version 1.0 STRIPE PAYMENTGATEWAY API
app.get("/v1.0/stripe",checkSessionToken,apiControllerV1_0.getProjectPKey);
app.delete("/v1.0/stripe",checkSessionToken,apiControllerV1_0.removeCC);
app.post("/v1.0/stripe/authenticate",checkSessionToken,apiControllerV1_0.authenticatePaymentIntent);
app.post("/v1.0/stripe/pay",checkSessionToken,apiControllerV1_0.createPaymentIntent);

app.get('/version',checkSessionToken,function(req, res){
  res.json({"version":"v1.0.4"});
});

/*Error catcher*/
app.get('*', function(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.catchFunc(ip,"ERROR_REQ_FAILED","REQUEST_FAILED@46",res,400,[req.originalUrl]);
});

app.post('*', function(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.catchFunc(ip,"ERROR_REQ_FAILED","REQUEST_FAILED@46",res,400,[req.originalUrl]);
});
/*End of Error Catcher*/

app.set('port', telepodDetails.port);

/* Start server */
server.listen(app.get('port'), function ()
{
  dbUtil.init(); //attach listeners....Initialize data
  console.log('Tehpod server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

process.on('unhandledRejection', (reason,p) => {
  const dt = new Date();
  const time = dt.toLocaleTimeString('en-US',{"timeZone":"Asia/Singapore"});
  const day = dt.toLocaleDateString('en-US',{"timeZone":"Asia/Singapore"});

  logger.log("error",{"timeStamp":day+" "+time,"function":"unhandledRejection@201","promise":p,"reason":reason});
});

process.on('SIGINT', function(msg) {
    process.exit(0);
});

module.exports = app;
