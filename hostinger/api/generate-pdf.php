<?php
// =============================================================================
// ABV PDF Generation Endpoint
// POST https://adornedbyveena.com/api/generate-pdf.php
// Header: X-API-Key: <your key>
// Body: JSON { "html": "<full html string>" }
// Returns: { "base64": "<pdf base64 string>" }
// =============================================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- CONFIG ---
define('API_KEY', 'REPLACE_WITH_YOUR_SECRET_KEY'); // Change this before deploying!

// --- AUTH ---
$headers = getallheaders();
$providedKey = $headers['X-Api-Key'] ?? $headers['X-API-Key'] ?? $headers['x-api-key'] ?? '';
if ($providedKey !== API_KEY) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

// --- PARSE REQUEST BODY ---
$input = json_decode(file_get_contents('php://input'), true);
if (empty($input['html'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing html field in request body']);
    exit();
}

$html = $input['html'];

// --- LOAD mPDF ---
require_once __DIR__ . '/vendor/autoload.php';

// --- GENERATE PDF ---
try {
    $mpdf = new \Mpdf\Mpdf([
        'mode'          => 'utf-8',
        'format'        => 'A4',
        'margin_top'    => 0,
        'margin_bottom' => 0,
        'margin_left'   => 0,
        'margin_right'  => 0,
        'default_font'  => 'montserrat',
        'basePath'      => __DIR__ . '/',
        'fontDir'       => [__DIR__ . '/fonts/'],
        'fontdata'      => [
            'montserrat' => [
                'R'  => 'Montserrat-Regular.ttf',
                'B'  => 'Montserrat-Bold.ttf',
                'I'  => 'Montserrat-Italic.ttf',
                'BI' => 'Montserrat-BoldItalic.ttf',
            ]
        ],
    ]);

    $mpdf->WriteHTML($html);
    $pdfContent = $mpdf->Output('', 'S');

    echo json_encode(['base64' => base64_encode($pdfContent)]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
