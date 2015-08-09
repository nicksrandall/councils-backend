var express = require('express');
var router = express.Router();
var request = require('request');
var j = request.jar();
var cookieRequest = request.defaults({jar: j});
var find = require('lodash.find');
var fs = require('fs');

/* GET users listing. */
router
  .get('/', function(req, res, next) {
    res.render('api', {});
  })
  .post('/me', function(req, res, next) {
    var profile = {};
    signIn(req.body.name, req.body.pass)
      .then(function () {
        return new Promise(function (resolve) {
          cookieRequest('https://www.lds.org/mobiledirectory/services/v2/ldstools/current-user-detail', function (err, resp, body) {
            result = JSON.parse(body);
            var me = {};
            me.individualId = result.individualId;
            me.homeUnitNbr = result.homeUnitNbr;
            resolve(me);
          });
        });
      })
      .then(function (me) {
        return new Promise(function (resolve) {
          cookieRequest('https://www.lds.org/directory/services/ludrs/1.1/unit/roster/'+me.homeUnitNbr+'/ADULTS', function (err, resp, body) {
            var result = JSON.parse(body);
            profile = find(result, function (record) { return record.individualId === me.individualId; }) || {};
            profile.homeUnitNbr = me.homeUnitNbr;
            resolve(profile);
          });
        });
      })
      .then(function (profile) {
        return new Promise(function (resolve, reject) {
          cookieRequest('https://lds.org/directory/services/ludrs/photo/url/'+profile.individualId+'/individual', function (err, resp, body) {
            resolve(body);
          });
        });
      })
      .then(function (body) {
        return JSON.parse(body).largeUri;
      })
      .then(function (url) {
        cookieRequest({url:'https://lds.org'+url, encoding: null}, function (err, resp, body) {
          profile.profileImage = "data:" + resp.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
          res.json(profile);
        })
      });
  })
  .post('/unit', function(req, res, next) {
    signIn(req.body.name, req.body.pass)
      .then(function () {
        return new Promise(function (resolve, reject) {
          cookieRequest('https://www.lds.org/mobiledirectory/services/ludrs/1.1/mem/mobile/current-user-unitNo', function (err, resp, body) {
            resolve(body);
          });
        });
      })
      .then(function (body) {
        return JSON.parse(body).message;
      })
      .then(function (unitNumber) {
        cookieRequest('https://www.lds.org/directory/services/ludrs/1.1/unit/roster/'+unitNumber+'/ADULTS')
          .pipe(res);
      });
  })
  .post('/photo', function(req, res, next) {
    signIn(req.body.name, req.body.pass)
      .then(function () {
        return new Promise(function (resolve, reject) {
          cookieRequest('https://www.lds.org/mobiledirectory/services/ludrs/1.1/mem/mobile/current-user-id', function (err, resp, body) {
            resolve(body);
          });
        });
      })
      // .then(function (body) {
      //   return JSON.parse(body).individualId;
      // })
      .then(function (individualId) {
        return new Promise(function (resolve, reject) {
          cookieRequest('https://lds.org/directory/services/ludrs/photo/url/'+individualId+'/individual', function (err, resp, body) {
            resolve(body);
          });
        });
      })
      .then(function (body) {
        return JSON.parse(body).largeUri;
      })
      .then(function (url) {
        cookieRequest('https://lds.org'+url)
          .pipe(res);
      });
  })
  .post('/push', function(req, res, next) {
    // send push notification using ionic!
    // 
    var b64 = new Buffer('ad5e210885b7a36e7c133970566de8dd699a5b67f4fd06fe').toString('base64');
    request({
      url: 'https://push.ionic.io/api/v1/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ionic-Application-Id': '817eddde',
        'Authorization': 'Basic ' + b64
      },
      body: {
        tokens: req.body.tokens,
        notification: {
          alert: req.body.message
        }
      },
      json: true
    }).pipe(res);
  });

function signIn (name, pass) {
  var options = {
    url: 'https://signin.lds.org/login.html',
    form: {
      username: name,
      password: pass
    }
  };
  return new Promise(function (resolve) {
    return cookieRequest.post(options, resolve);
  });
}

module.exports = router;