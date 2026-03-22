<?php
// =============================================================================
// ABV Accept Contract Endpoint
// POST https://adornedbyveena.com/api/accept-contract.php
// Body (form): id=<opportunityId>&token=<csrfToken>
// Verifies CSRF token, calls Salesforce REST API to mark contract as Signed.
// =============================================================================

require_once __DIR__ . '/sf-config.php';

$contractsDir = __DIR__ . '/../contracts/';
$tokensDir    = __DIR__ . '/../tokens/';

// --- READ INPUT ---
$opportunityId = trim($_POST['id'] ?? '');
$token         = trim($_POST['token'] ?? '');

// --- VALIDATE ---
if (!preg_match('/^[a-zA-Z0-9]{15,18}$/', $opportunityId)) {
    http_response_code(400);
    die('Invalid request.');
}

// --- VERIFY CSRF TOKEN ---
$tokenFile = $tokensDir . $token . '.tok';
if (empty($token) || !file_exists($tokenFile)) {
    http_response_code(403);
    die('Invalid or expired token. Please reload the contract page and try again.');
}
unlink($tokenFile); // One-time use

// --- CHECK IF ALREADY ACCEPTED ---
$acceptedFile = $contractsDir . $opportunityId . '.accepted';
if (file_exists($acceptedFile)) {
    header('Location: /contract/?id=' . urlencode($opportunityId) . '&status=already_accepted');
    exit();
}

// --- GET SALESFORCE ACCESS TOKEN ---
$authResponse = file_get_contents(SF_LOGIN_URL . '/services/oauth2/token', false, stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'grant_type'    => 'password',
            'client_id'     => SF_CLIENT_ID,
            'client_secret' => SF_CLIENT_SECRET,
            'username'      => SF_USERNAME,
            'password'      => SF_PASSWORD,
        ])
    ]
]));

if ($authResponse === false) {
    http_response_code(500);
    die('Could not connect to Salesforce. Please try again or contact Adorned by Veena.');
}

$auth = json_decode($authResponse, true);
if (empty($auth['access_token'])) {
    http_response_code(500);
    die('Salesforce authentication failed. Please contact Adorned by Veena.');
}

$accessToken  = $auth['access_token'];
$instanceUrl  = $auth['instance_url'];

// --- UPDATE OPPORTUNITY IN SALESFORCE ---
$today   = date('Y-m-d');
$payload = json_encode([
    'Contract_Status__c'      => 'Signed',
    'Contract_Signed_Date__c' => $today,
]);

$updateUrl = $instanceUrl . '/services/data/v60.0/sobjects/Opportunity/' . $opportunityId;

$updateContext = stream_context_create([
    'http' => [
        'method'  => 'PATCH',
        'header'  => "Authorization: Bearer $accessToken\r\nContent-Type: application/json\r\nContent-Length: " . strlen($payload),
        'content' => $payload,
    ]
]);

// PATCH returns 204 No Content on success — suppress "failed to open stream" warning
$updateResult = @file_get_contents($updateUrl, false, $updateContext);
$responseCode = $http_response_header[0] ?? '';

if (strpos($responseCode, '204') === false && strpos($responseCode, '200') === false) {
    http_response_code(500);
    die('Could not update the contract status. Please contact Adorned by Veena.');
}

// --- MARK AS ACCEPTED SERVER-SIDE ---
file_put_contents($acceptedFile, $today);

// --- REDIRECT TO SUCCESS ---
header('Location: /contract/?id=' . urlencode($opportunityId) . '&status=accepted');
exit();
