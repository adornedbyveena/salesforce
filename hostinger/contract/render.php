<?php
// =============================================================================
// Serves the stored contract HTML for the iframe in index.php.
// URL: /contract/render.php?id={opportunityId}
// =============================================================================

$contractsDir = __DIR__ . '/../contracts/';

$opportunityId = preg_replace('/[^a-zA-Z0-9]/', '', $_GET['id'] ?? '');
if (strlen($opportunityId) < 15 || strlen($opportunityId) > 18) {
    http_response_code(404);
    exit();
}

$filePath = $contractsDir . $opportunityId . '.html';
if (!file_exists($filePath)) {
    http_response_code(404);
    exit();
}

header('Content-Type: text/html; charset=UTF-8');
header('X-Frame-Options: SAMEORIGIN');
readfile($filePath);
