var express = require('express');
var tough = require('tough-cookie');
var router = express.Router();
var request = require('request');
// var j = request.jar();
// var cookieRequest = request.defaults({jar: j});
var find = require('lodash.find');
var pick = require('lodash.pick');
var fs = require('fs');
var path = require('path');
var cloudinary = require('cloudinary');
var multer  = require('multer')
var upload = multer({ dest: 'uploads/' })

/* GET users listing. */
router
  .get('/', function(req, res, next) {
    res.render('api', {});
  })
  .post('/me', function(req, res, next) {
    var profile = {}, jar;
    signIn(req.body.name, req.body.pass)
      .then(function (j) {
        jar = j;
        return new Promise(function (resolve) {
          request({
            jar: jar,
            url: 'https://www.lds.org/mobiledirectory/services/v2/ldstools/current-user-detail'
          },
          function (err, resp, body) {
            console.log('current');
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
          request({
            jar: jar,
            url: 'https://www.lds.org/directory/services/ludrs/1.1/unit/roster/'+me.homeUnitNbr+'/ADULTS'
          }, function (err, resp, body) {
            console.log('roster');
            var result = JSON.parse(body);
            profile = find(result, function (record) { return record.individualId === me.individualId; }) || {};
            profile.homeUnitNbr = me.homeUnitNbr;
            resolve(profile);
          });
        });
      })
      .then(function (me) {
        return new Promise(function (resolve) {
          request({
            jar: jar,
            url: 'https://www.lds.org/mobiledirectory/services/ludrs/1.1/mem/mobile/member-detaillist-with-callings/'+me.homeUnitNbr
          }, function (err, resp, body) {
            console.log('calling');
            var result = JSON.parse(body);
            var calling = find(result.callings, function (record) { return record.individualId == me.individualId; }) || {callingName: 'none', groupName: 'none'};
            profile.groupName = calling.groupName;
            profile.callingName = calling.callingName;
            resolve(profile);
          });
        });
      })
      .then(function (profile) {
        return new Promise(function (resolve, reject) {
          request({
            jar: jar,
            url: 'https://lds.org/directory/services/ludrs/photo/url/'+profile.individualId+'/individual'
          }, function (err, resp, body) {
            resolve(body);
          });
        });
      })
      .then(function (body) {
        return JSON.parse(body).largeUri;
      })
      .then(function (url) {
        var stream = cloudinary.uploader.upload_stream(function(result) {
          console.log(result);
          profile.profileImage = 'https://res.cloudinary.com/hgzoysu4o/image/upload/c_fill,g_face,h_250,w_250/v1439767739/' + result.public_id + '.png';
          res.json(profile);
        }, { 
          public_id: 'councils_' + profile.individualId
        });
        request({
          jar: jar,
          url:'https://lds.org'+url, 
          encoding: null
        }).pipe(stream);
      });
  })
  .post('/unit', function(req, res, next) {
    var jar;
    signIn(req.body.name, req.body.pass)
      .then(function (j) {
        jar = j;
        return new Promise(function (resolve, reject) {
          request({
            jar: jar,
            url: 'https://www.lds.org/mobiledirectory/services/ludrs/1.1/mem/mobile/current-user-unitNo'
          }, function (err, resp, body) {
            resolve(body);
          });
        });
      })
      .then(function (body) {
        return JSON.parse(body).message;
      })
      .then(function (unitNumber) {
        request({
          jar: jar,
          url: 'https://www.lds.org/directory/services/ludrs/1.1/unit/roster/'+unitNumber+'/ADULTS'
        }).pipe(res);
      });
  })
  .post('/upload/:id', upload.single('image'), function(req, res, next) {
    var stream = cloudinary.uploader.upload_stream(function(result) {
      res.json({
        url: 'https://res.cloudinary.com/hgzoysu4o/image/upload/c_fill,g_face,h_250,w_250/v1439767739/' + result.public_id + '.png',
        worked: true,
      });
    }, { 
      public_id: 'councils_' + req.params.id
    });
    
    var dest = path.resolve(__dirname, '../', req.file.path);

    fs.createReadStream(dest).pipe(stream).on('end', function() {
      fs.unlink(dest);
    });
  })
  .post('/photo', function(req, res, next) {
    var jar;
    signIn(req.body.name, req.body.pass)
      .then(function (j) {
        jar = j;
        return new Promise(function (resolve, reject) {
          request({
            jar: jar,
            url: 'https://www.lds.org/mobiledirectory/services/ludrs/1.1/mem/mobile/current-user-id'
          }, function (err, resp, body) {
            resolve(body);
          });
        });
      })
      // .then(function (body) {
      //   return JSON.parse(body).individualId;
      // })
      .then(function (individualId) {
        return new Promise(function (resolve, reject) {
          request({
            jar: jar,
            url: 'https://lds.org/directory/services/ludrs/photo/url/'+individualId+'/individual'
          }, function (err, resp, body) {
            resolve(body);
          });
        });
      })
      .then(function (body) {
        return JSON.parse(body).largeUri;
      })
      .then(function (url) {
        request({
          jar: jar,
          url: 'https://lds.org'+url
        }).pipe(res);
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
  })
  .get('/hymns', function (req, res, next) {
    res.json(require('./hymns'));
  });

function signIn (name, pass) {
  var j = request.jar();
  var options = {
    url: 'https://signin.lds.org/login.html',
    form: {
      username: name,
      password: pass
    },
    jar: j
  };
  return new Promise(function (resolve) {
    return request.post(options, function () {
      resolve(j);
    });
  });
}

module.exports = router;