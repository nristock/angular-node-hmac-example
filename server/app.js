var debug = require('debug')('app');

var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var hmac = require('./hmac');

var app = express();

app.set('port', process.env.PORT || 3000);

app.use(logger('dev'));

// Needed to capture raw body data
app.use(function (req, res, next) {
    req.rawBody = '';

    req.on('data', function (chunk) {
        req.rawBody += chunk;
    });

    next();
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

app.post('/login', hmac.login);
app.post('/data', hmac.verify, function (req, res) {
    res.json(200, {message: 'Transmission successful!'});
});
app.post('/logout', hmac.verify, hmac.logout);

// Catch 404s
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Development error handler, sends error message to user.
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        console.error(err.stack);
        res.json(err.status || 500, {message: err.message});
        res.end();
    });
} else {
    // Production error handler, sends generic error message to user.
    app.use(function (err, req, res, next) {
        res.json(err.status || 500, {message: 'An error occurred.'});
        res.end();
    });
}

var server = app.listen(app.get('port'), function () {
    debug('Server listening on port ' + server.address().port);
});
