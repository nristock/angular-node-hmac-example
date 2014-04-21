var hmacApp = angular.module('hmac', [], function ($httpProvider) {
    // Add an HTTP interceptor which passes the request URL to the transformer
    // Allows to include the URL into the signature
    // Rejects request if no hmacSecret is available
    $httpProvider.interceptors.push(function($q) {
       return {
            'request': function(config) {
                if(!localStorage.hmacSecret) {
                    return $q.reject('No HMAC secret to sign request!');
                }

                config.headers['X-URL'] = config.url;
                return config || $q.when(config);
            }
       };
    });

    // Add a custom request transformer to generate required headers
    $httpProvider.defaults.transformRequest.push(function (data, headersGetter) {
        if (data) {
            // Add session token header if available
            if (localStorage.sessionToken) {
                headersGetter()['X-SESSION-TOKEN'] = localStorage.sessionToken;
            }

            // Add current time to prevent replay attacks
            var microTime = new Date().getTime();
            headersGetter()['X-MICRO-TIME'] = microTime;

            // Finally generate HMAC and set header
            headersGetter()['X-HMAC-HASH'] = CryptoJS.HmacSHA512(headersGetter()['X-URL'] + ':' + data + ':' + microTime, localStorage.hmacSecret).toString(CryptoJS.enc.Hex);

            // And remove our temporary header
            headersGetter()['X-URL'] = '';
        }
        return data;
    });
});

hmacApp.controller('LoginController', function ($scope, $http) {
    $scope.message = '';
    $scope.username = '';
    $scope.password = '';

    $scope.login = function () {
        // Generate HMAC secret (sha512('username:password'))
        localStorage.hmacSecret = CryptoJS.SHA512($scope.username + ":" + $scope.password).toString(CryptoJS.enc.Hex);
        $scope.password = '';

        // POST Data
        var randomString = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
        var postData = {payload: randomString, username: $scope.username};
        $scope.username = '';

        $http.post('/login', postData).
            success(function (data, status, headers, config) {
                // Store session token
                localStorage.sessionToken = data.sessionToken;

                // Generate new HMAC secret out of our previous (username + password) and the new session token
                // sha512("sha512('username:password'):sessionToken")
                localStorage.hmacSecret = CryptoJS.SHA512(localStorage.hmacSecret + ':' + data.sessionToken);

                $scope.message = 'Login Successful: ' + localStorage.sessionToken;
            }).
            error(function (data, status, headers, config) {
                $scope.message = data.message;
            });
    };

    $scope.logout = function () {
        if(!localStorage.sessionToken) {
            $scope.message = 'You are not logged in.';
            return;
        }

        $http.post('/logout', {}).
            success(function (data, status, headers, config) {
                // Delete session token and secret
                delete localStorage.sessionToken;
                delete localStorage.hmacSecret;

                $scope.message = 'Logout Successful';
            }).
            error(function (data, status, headers, config) {
                $scope.message = data.message;

                // Delete session token and secret
                delete localStorage.sessionToken;
                delete localStorage.hmacSecret;
            });
    };
});

hmacApp.controller('DemoController', function ($scope, $http) {
    $scope.message = '';
    $scope.dummyData = '';

    $scope.sendData = function () {
        // Simply send data - the request transformer will handle everything else
        $http.post('/data', {data: $scope.dummyData}).
            success(function (data, status, headers, config) {
                $scope.message = 'Data submission successful.';
            }).
            error(function (data, status, headers, config) {
                if(data) {
                    $scope.message = data.message;
                } else if(!data && !status) {
                    $scope.message = 'Unable to send request';
                } else {
                    $scope.message = 'An unknown error occurred.'
                }
            });
    }
});
