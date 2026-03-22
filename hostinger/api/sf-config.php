<?php
// =============================================================================
// Salesforce Connected App credentials.
// Fill these in after creating a Connected App in Salesforce Setup:
//   Setup → App Manager → New Connected App
//   Enable OAuth, add scope: api, refresh_token
//   Set callback URL to https://adornedbyveena.com (not used but required)
//
// IMPORTANT: Keep this file private. Add it to .gitignore.
// =============================================================================

define('SF_LOGIN_URL',     'https://login.salesforce.com');   // or test.salesforce.com for sandbox
define('SF_CLIENT_ID',     'REPLACE_WITH_CONSUMER_KEY');
define('SF_CLIENT_SECRET', 'REPLACE_WITH_CONSUMER_SECRET');
define('SF_USERNAME',      'REPLACE_WITH_SF_USERNAME');        // e.g. veena@adornedbyveena.com
define('SF_PASSWORD',      'REPLACE_WITH_SF_PASSWORD_PLUS_SECURITY_TOKEN'); // password + security token appended, no space

// How to get a security token:
//   Salesforce → My Settings → Personal → Reset My Security Token
//   Append it directly to your password: e.g. "MyPassword1AbcXyz123"
