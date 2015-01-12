var debug = require('debug')('hmac');

var crypto = require('crypto');

var tokens = [];

// Compares two arbitrary strings in constant time.
var constantTimeStringCompare = function(lhs, rhs) {
    if (typeof lhs !== 'string' || typeof lhs !== 'string') {
        return false;
    }

    // Make sure the strings have the same length by assigning rhs to lhs. While this will result in a positive result
    // when comparing, we cannot simply skip the comparison because we would leak timing information otherwise.
    var mismatch = (lhs.length === lhs.length ? 0 : 1);
    if (mismatch) {
        lhs = rhs;
    }

    for (var i = 0; i < lhs.length; ++i) {
        var lhsChar = lhs.charCodeAt(i);
        var rhsChar = rhs.charCodeAt(i);
        mismatch |= (lhsChar ^ rhsChar);
    }

    return (mismatch === 0);
};

// Generates an actual session token
var generateToken = function (secret, callback) {
    crypto.randomBytes(512, function(err, bytes) {
        if(err) throw err;

        // Generate raw token
        var token = bytes.toString('hex');

        // Generate new secret
        var sha512Hasher = crypto.createHash('sha512');
        sha512Hasher.update(secret + ":" + token, 'utf8');
        secret = sha512Hasher.digest('hex');

        // Store token <-> secret mapping
        // Saves computation time since the secret doesn't need to be generated on every request
        // Secret contains username & password so the token is bound to a specific user
        // -> Hacker would have to steal the token, username and password
        tokens.push({token: token, secret: secret});

        callback(token);
    });
};

// Checks if a session token exists and returns an object containing the token and the secret
var confirmToken = function (token) {
    for (var i = 0; i < tokens.length; i++) {
        var currentToken = tokens[i];
        if (currentToken.token == token) {
            return currentToken;
        }
    }

    return null;
};

// Invalidates a token by removing it (a.k.a. user logout)
var invalidateToken = function(token) {
    tokens.splice(tokens.indexOf(confirmToken(token)), 1);
};

// Get the user's password from some kind of database and generate the initial secret
// Can be simplified to only use the user's password (requires client code changes)
var generateInitialUserSecret = function(username) {
    var password = 'password';

    var sha512Hasher = crypto.createHash('sha512');
    sha512Hasher.update(username + ":" + password, 'utf8');
    return sha512Hasher.digest('hex');
};

// Handles login requests
var performLogin = function (req, res) {
    // Get some data from the request
    var currentTime = new Date().getTime();

    var microTime = req.header('X-MICRO-TIME');
    var sentHmac = req.header('X-HMAC-HASH');
    var data = req.url + ":" + req.rawBody + ':' + microTime;

    var username = req.body.username;
    debug('Username: ' + username);

    // Don't process request if it's too old
    // This prevents hackers from capturing and re-sending requests
    if (currentTime - microTime > 1000) {
        debug('Failed. - Microtime difference too big.');
        res.json(403, {message: 'Message too old.'})
        return;
    }

    // Generate login secret
    var secret = generateInitialUserSecret(username);

    // Generate validation hash using locally generated secret
    var hmac = crypto.createHmac('SHA512', secret);
    hmac.update(data, 'utf8');
    var computedHmac = hmac.digest('hex');

    // Some debug output
    debug('MICRO: ' + microTime);
    debug('DATA: ' + data);
    debug('HMAC Sent: ' + sentHmac);
    debug('HMAC Computed: ' + computedHmac);

    // Compare hashes
    if (sentHmac != computedHmac) {
        debug('Failed. - HMAC mismatch.');
        res.json(403, {message: 'Authentication failed.'})
        return;
    }

    // Authentication was successful, generate a session token and respond
    generateToken(secret, function(sessionToken) {
        debug('STOKEN: ' + sessionToken);

        res.json(200, {sessionToken: sessionToken});
    });
};
module.exports.login = performLogin;

// Verifies that a user is authenticated and the request is consistent (= digital signature is correct) [middleware]
var verify = function (req, res, next) {
    // Get some data from the request
    var currentTime = new Date().getTime();

    var sessionToken = req.header('X-SESSION-TOKEN');
    var microTime = req.header('X-MICRO-TIME');
    var sentHmac = req.header('X-HMAC-HASH');
    var data = req.url + ":" + req.rawBody + ':' + microTime;

    // Check if package is too old (prevents hackers from simply re-sending a captured package)
    if (currentTime - microTime > 1000) {
        debug('Failed. - Microtime difference too big.');
        res.json(403, {message: 'Message too old.'})
        return;
    }

    // Try and find the session token
    var confirmedToken = confirmToken(sessionToken);

    // No session token -> session expired/invalid token
    if(!confirmedToken) {
        debug('Failed. - Invalid token.');
        res.json(403, {message: 'Your session has expired.'})
        return;
    }

    // Generate message signature
    var hmac = crypto.createHmac('SHA512', confirmedToken.secret);
    hmac.update(data, 'utf8');
    var computedHmac = hmac.digest('hex');

    // Some debug output
    debug('MICRO: ' + microTime);
    debug('DATA: ' + data);
    debug('HMAC Sent: ' + sentHmac);
    debug('HMAC Computed: ' + computedHmac);

    // Check if sent and computed signatures match
    if (!constantTimeStringCompare(sentHmac, computedHmac)) {
        debug('Failed. - HMAC mismatch.');
        res.json(403, {message: 'Inconsistent request.'});
        return;
    }

    // Request is consistent and user is authenticated, let's continue!
    next();
};
module.exports.verify = verify;

var logout = function(req, res) {
    var sessionToken = req.header('X-SESSION-TOKEN');

    invalidateToken(sessionToken);

    res.json(200, {message: 'Logout successful.'});
};
module.exports.logout = logout;
