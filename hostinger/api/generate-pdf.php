<?php
// =============================================================================
// ABV PDF Generation Endpoint
// POST https://adornedbyveena.com/api/generate-pdf.php
// Header: X-API-Key: <your key>
// Body: JSON (see fields below)
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
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit();
}

// --- DETERMINE TEMPLATE ---
$documentType = $input['documentType'] ?? 'Contract';
$templateFile = __DIR__ . '/' . strtolower($documentType) . '_template.html';
if (!file_exists($templateFile)) {
    http_response_code(404);
    echo json_encode(['error' => "Template not found: " . strtolower($documentType) . "_template.html"]);
    exit();
}

// --- LOAD mPDF ---
require_once __DIR__ . '/vendor/autoload.php';

// --- PREPARE DATA ---
$createdDate = date('m/d/Y');

$eventDate = '';
if (!empty($input['eventDate'])) {
    $ts = strtotime($input['eventDate']);
    $eventDate = $ts ? date('F j, Y', $ts) : $input['eventDate'];
}

// Venue
$venueParts = array_filter([
    trim($input['venueStreet'] ?? ''),
    trim($input['venueCity'] ?? ''),
    trim(($input['venueState'] ?? '') . ' ' . ($input['venueZip'] ?? ''))
]);
$venue = implode(', ', $venueParts);
if (empty(trim($venue))) $venue = 'TBD';

// Client billing address
$addrParts = array_filter([
    trim($input['billingStreet'] ?? ''),
    trim($input['billingCity'] ?? ''),
    trim(($input['billingState'] ?? '') . ' ' . ($input['billingZip'] ?? ''))
]);
$clientAddress = implode(', ', $addrParts);

// Deposit logic
$depositPaid = filter_var($input['depositPaid'] ?? false, FILTER_VALIDATE_BOOLEAN);
$depAmt = number_format(floatval($input['deposit'] ?? 0), 2);
$depositString = $depositPaid
    ? "A non-refundable deposit of \${$depAmt} was paid prior to this Agreement."
    : "A non-refundable deposit of \${$depAmt} is due upon signing this Agreement.";

// Line items (format: "Name::Description::Qty|Name::Description::Qty")
$lineItemsHtml = '';
if (!empty($input['lineItems'])) {
    $items = explode('|', $input['lineItems']);
    foreach ($items as $item) {
        $parts = explode('::', $item);
        $name = htmlspecialchars(trim($parts[0] ?? ''));
        $desc = htmlspecialchars(trim($parts[1] ?? ''));
        $qty  = htmlspecialchars(trim($parts[2] ?? ''));
        if ($name) {
            $lineItemsHtml .= "
                <tr>
                    <td class='line-name'>{$name}</td>
                    <td class='line-qty'>{$qty}</td>
                    <td class='line-desc'>{$desc}</td>
                </tr>";
        }
    }
}

// --- TOKEN REPLACEMENTS ---
$replacements = [
    '{{CREATED_DATE}}'   => $createdDate,
    '{{CLIENT_NAME}}'    => htmlspecialchars($input['clientName'] ?? 'Client'),
    '{{CLIENT_ADDRESS}}' => htmlspecialchars($clientAddress),
    '{{EVENT_NAME}}'     => htmlspecialchars($input['eventName'] ?? 'Event'),
    '{{EVENT_DATE}}'     => htmlspecialchars($eventDate),
    '{{VENUE}}'          => htmlspecialchars($venue),
    '{{TOTAL_AMOUNT}}'   => number_format(floatval($input['totalAmount'] ?? 0), 2),
    '{{DEPOSIT}}'        => $depAmt,
    '{{BALANCE}}'        => number_format(floatval($input['balance'] ?? 0), 2),
    '{{DEPOSIT_STRING}}' => $depositString,
    '{{LINE_ITEMS}}'     => $lineItemsHtml,
];

// --- RENDER TEMPLATE ---
$html = file_get_contents($templateFile);
$html = str_replace(array_keys($replacements), array_values($replacements), $html);

// --- GENERATE PDF ---
try {
    $mpdf = new \Mpdf\Mpdf([
        'mode'          => 'utf-8',
        'format'        => 'A4',
        'margin_top'    => 12,
        'margin_bottom' => 12,
        'margin_left'   => 14,
        'margin_right'  => 14,
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
    $pdfContent = $mpdf->Output('', 'S'); // S = return as string
    $base64 = base64_encode($pdfContent);

    echo json_encode(['base64' => $base64]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
