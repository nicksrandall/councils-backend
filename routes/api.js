var express = require('express');
var router = express.Router();
var request = require('request');
var j = request.jar();
var cookieRequest = request.defaults({jar: j});
var find = require('lodash.find');
var merge = require('lodash.merge');

/* GET users listing. */
router
  .get('/', function(req, res, next) {
    res.render('api', {});
  })
  .post('/me', function(req, res, next) {
    var me = {};
    signIn(req.body.name, req.body.pass)
      .then(function () {
        return new Promise(function (resolve) {
          cookieRequest('https://www.lds.org/mobiledirectory/services/v2/ldstools/current-user-detail', function (err, resp, body) {
            result = JSON.parse(body);
            me.individualId = result.individualId;
            me.homeUnitNbr = result.homeUnitNbr;
            resolve(me);
          });
        })
        .then(function (me) {
          cookieRequest('https://www.lds.org/directory/services/ludrs/1.1/unit/roster/'+me.homeUnitNbr+'/ADULTS', function (err, resp, body) {
            var result = JSON.parse(body);
            var profile = find(result, function (record) { return record.individualId === me.individualId; }) || {};
            profile.homeUnitNbr = me.homeUnitNbr;
            res.json(profile);
          });
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