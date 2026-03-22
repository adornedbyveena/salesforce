<?php
// =============================================================================
// ABV Save Contract HTML Endpoint
// POST https://adornedbyveena.com/api/save-contract.php
// Header: X-API-Key: <your key>
// Body: JSON { "opportunityId": "...", "html": "<full html string>" }
// Returns: { "success": true }
// =============================================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://adornedbyveena.lightning.force.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- CONFIG ---
define('API_KEY', 'REPLACE_WITH_YOUR_SECRET_KEY'); // Must match generate-pdf.php

// --- AUTH ---
$headers = getallheaders();
$providedKey = $headers['X-Api-Key'] ?? $headers['X-API-Key'] ?? $headers['x-api-key'] ?? '';
if ($providedKey !== API_KEY) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

// --- PARSE BODY ---
$input = json_decode(file_get_contents('php://input'), true);
$opportunityId = $input['opportunityId'] ?? '';
$html          = $input['html'] ?? '';

if (empty($opportunityId) || empty($html)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing opportunityId or html']);
    exit();
}

// Validate opportunityId is a safe Salesforce ID (15-18 alphanumeric chars)
if (!preg_match('/^[a-zA-Z0-9]{15,18}$/', $opportunityId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid opportunityId']);
    exit();
}

// --- FIX LOGO PATH for browser rendering ---
// mPDF resolves logo.png from basePath on the server.
// For the browser acceptance page we need the absolute URL.
$html = str_replace('src="logo.png"', 'src="https://adornedbyveena.com/api/logo.png"', $html);

// --- STORE HTML ---
$contractsDir = __DIR__ . '/../contracts/';
if (!is_dir($contractsDir)) {
    mkdir($contractsDir, 0755, true);
}

$filePath = $contractsDir . $opportunityId . '.html';
if (file_put_contents($filePath, $html) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save contract']);
    exit();
}

echo json_encode(['success' => true]);
