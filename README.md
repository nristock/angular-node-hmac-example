This software is licensed under the terms and conditions of the MIT license.


## Authentication Handshake
As the user hits the login button, Angular will generate a temporary HMAC secret which looks like this:
```
temporarySecret = sha512(username:password)
```

An HTTP POST request will then be sent to /login. The body data of this request looks like this:
```json
{
    'payload': randomData,
    'username': username
}
```

An Angular request transformer will then add `X-MICRO-TIME` and `X-HMAC-HASH` headers to the request. The `X-MICRO-TIME`
header is basically a UTC timestamp. The final HMAC hash is the generated using the requested URL, HTTP data and micro time.
```
hash = hmacSHA512(requestURL:data:microTime, temporarySecret)
```

The server will analyze and validate the request (see server/hmac.js#performLogin, it's well documented). This login request
validation uses the technique described above to generate a temporary secret. If the user entered his username and password
correctly the secret generated on the server will match the one generated on the client. Note: We do *NOT* send the actual
password nor a hash of it so there is no way for a hacker to get it using network sniffing.
If the validation was successful the server will generate a session token which will be sent back to the client.

A new secret to sign any further requests is then generated on the client and on the server.
```
secret = sha512(sha512(temporarySecret):sessionToken)
```

## Authenticated requests
The Angular request transformer will intercept any further requests and sign them. The transformer adds the following headers:
```
X-MICRO-TIME    -   current unix timestamp
X-SESSION-TOKEN -   the session token received by the server
X-HMAC-HASH     -   the actual signature
```

The message signature is generated like this (see above for information on secret generation):
```
hash = hmacSHA512(requestURL:data:microTime, secret)
```

The server validates all incoming requests as follows (see server/hmac.js#verify):
 * Check if request is too old (using the micro time header)
 * Check if the session token exists (using the session token header)
 * Hash the message the same way the client did

Since the secret used to generate the signatures is based on the user's name, password and a session token we can also bind
session tokens to a specific user.


## How to use this example
You will need to have NodeJS and NPM installed.

Get the code (you can also download a ZIP file):
```
git clone https://github.com/Monofraps/angular-node-hmac-example.git
```

Install dependencies
```
npm install
```

Build the files
```
grunt
```

Run the server
```
cd _build && node app.js
```

You can now connect to the server: http://localhost:3000

## Social
If you have any questions, recommendations or requests simply contact me or [create an issue](https://github.com/Monofraps/angular-node-hmac-example/issues/new)

Twitter - [@monofraps](http://twitter.com/monofraps)
