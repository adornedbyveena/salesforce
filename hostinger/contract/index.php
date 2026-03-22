<?php
// =============================================================================
// ABV Contract Acceptance Page
// URL: https://adornedbyveena.com/contract/?id={opportunityId}
//      or with .htaccess: https://adornedbyveena.com/contract/{opportunityId}
// =============================================================================

$contractsDir = __DIR__ . '/../contracts/';
$tokensDir    = __DIR__ . '/../tokens/';

// --- VALIDATE ID ---
$opportunityId = preg_replace('/[^a-zA-Z0-9]/', '', $_GET['id'] ?? '');
if (strlen($opportunityId) < 15 || strlen($opportunityId) > 18) {
    http_response_code(404);
    die('Contract not found.');
}

$contractFile = $contractsDir . $opportunityId . '.html';
if (!file_exists($contractFile)) {
    http_response_code(404);
    die('Contract not found. It may not have been generated yet, or the link may be invalid.');
}

// --- STATUS ---
$acceptedFile    = $contractsDir . $opportunityId . '.accepted';
$alreadyAccepted = file_exists($acceptedFile);
$justAccepted    = ($_GET['status'] ?? '') === 'accepted';
$alreadyMsg      = ($_GET['status'] ?? '') === 'already_accepted';

// --- GENERATE CSRF TOKEN (not needed if already accepted) ---
$token = '';
if (!$alreadyAccepted) {
    if (!is_dir($tokensDir)) mkdir($tokensDir, 0755, true);
    $token = bin2hex(random_bytes(32));
    file_put_contents($tokensDir . $token . '.tok', $opportunityId);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contract Review — Adorned by Veena</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Segoe UI', sans-serif;
            background: #f0f0f0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }

        .page-header {
            background: #020C1D;
            padding: 16px 32px;
            display: flex;
            align-items: center;
            gap: 18px;
            flex-shrink: 0;
        }

        .page-header img {
            height: 48px;
        }

        .page-header h1 {
            color: #D4AF37;
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }

        .contract-wrapper {
            flex: 1;
            width: 100%;
            overflow: hidden;
        }

        .contract-frame {
            width: 100%;
            height: calc(100vh - 180px);
            border: none;
            display: block;
            background: #F7E7CE;
        }

        .page-footer {
            background: #fff;
            border-top: 3px solid #D4AF37;
            padding: 20px 32px;
            text-align: center;
            flex-shrink: 0;
        }

        .footer-instruction {
            color: #444;
            font-size: 14px;
            margin-bottom: 14px;
        }

        .accept-btn {
            background: #D4AF37;
            color: #020C1D;
            padding: 14px 44px;
            font-size: 16px;
            font-weight: 700;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            letter-spacing: 0.3px;
            transition: opacity 0.2s;
        }

        .accept-btn:hover { opacity: 0.88; }
        .accept-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .status-msg {
            font-size: 17px;
            font-weight: 600;
            padding: 10px 0;
        }

        .status-msg.success { color: #2e7d32; }
        .status-msg.info    { color: #666; }
    </style>
</head>
<body>

<div class="page-header">
    <img src="https://adornedbyveena.com/api/logo.png" alt="Adorned by Veena" />
    <h1>Contract Review &amp; Acceptance</h1>
</div>

<div class="contract-wrapper">
    <iframe
        src="/contract/render.php?id=<?= htmlspecialchars($opportunityId) ?>"
        class="contract-frame"
        title="Contract Document">
    </iframe>
</div>

<div class="page-footer">
    <?php if ($justAccepted): ?>
        <p class="status-msg success">&#10003; Contract accepted successfully. Thank you!</p>
        <p class="footer-instruction" style="margin-top:6px;">A copy of this contract has been sent to your email.</p>

    <?php elseif ($alreadyAccepted || $alreadyMsg): ?>
        <p class="status-msg info">&#10003; This contract has already been accepted.</p>

    <?php else: ?>
        <p class="footer-instruction">By clicking below, you confirm that you have read and agree to all the terms outlined in this contract.</p>
        <form method="POST" action="/api/accept-contract.php" onsubmit="handleAccept(event)">
            <input type="hidden" name="id" value="<?= htmlspecialchars($opportunityId) ?>">
            <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">
            <button type="submit" class="accept-btn" id="acceptBtn">&#10003;&nbsp; I Accept This Contract</button>
        </form>
    <?php endif; ?>
</div>

<script>
function handleAccept(e) {
    var btn = document.getElementById('acceptBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';
}
</script>

</body>
</html>
