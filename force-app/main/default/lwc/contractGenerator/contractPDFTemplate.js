// Contract PDF HTML template.
// Tokens are replaced in contractGenerator.js before sending to the PHP endpoint.
// {{LINE_ITEMS}} is replaced with pre-built <tr> HTML rows.

const CONTRACT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    @page {
        margin: .5in;
        background-color: #F7E7CE;
    }

    body {
        font-family: montserrat, sans-serif;
        font-size: 10pt;
        color: #020C1D;
        background-color: #F7E7CE;
        line-height: 1.5;
        margin: 0;
        padding: 0;
    }

    .header-container {
        text-align: center;
        margin-bottom: 25px;
    }

    .header-logo {
        width: 140px;
        margin-bottom: 10px;
    }

    .doc-title {
        font-size: 22pt;
        font-weight: bold;
        color: #020C1D;
        letter-spacing: 1px;
    }

    .gold-line {
        display: block;
        width: 100%;
        border-bottom: 2pt solid #D4AF37;
        margin: 15px 0;
        font-size: 0;
        line-height: 0;
    }

    h2 {
        font-size: 11pt;
        font-weight: bold;
        color: #020C1D;
        margin: 15px 0 5px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    h3 {
        font-size: 10pt;
        font-weight: bold;
        color: #020C1D;
        margin: 10px 0 2px 0;
    }

    p {
        margin: 5px 0;
    }

    ul.contract-list {
        margin: 5px 0 5px 25px;
        padding: 0;
    }

    ul.contract-list li {
        margin-bottom: 5px;
        padding-left: 5px;
    }

    .avoid-break {
        page-break-inside: avoid;
    }

    .page-break-before {
        page-break-before: always;
    }

    .line-items-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0 15px 0;
        page-break-inside: auto;
    }

    .line-items-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
    }

    .line-items-table th {
        background-color: #D4AF37;
        color: #020C1D;
        font-weight: bold;
        padding: 8px;
        text-align: left;
        font-size: 9pt;
    }

    .line-items-table td {
        padding: 8px;
        font-size: 9.5pt;
        border-bottom: 1px solid #D4AF37;
        vertical-align: top;
    }

    .line-name { width: 35%; font-weight: bold; }
    .line-qty  { width: 10%; text-align: center; }
    .line-desc { width: 55%; }

    .sig-table {
        width: 100%;
        margin-top: 20px;
    }

    .sig-block {
        padding-top: 5px;
        font-size: 10pt;
    }

    .payment-note {
        font-style: italic;
        color: #555;
        font-size: 9.5pt;
        margin-top: 15px;
        line-height: 1.6;
    }
</style>
</head>
<body>

<div class="header-container">
    <img src="logo.png" class="header-logo" />
    <div class="doc-title">EVENT PLANNING &amp; D&Eacute;COR CONTRACT</div>
</div>

<p class="gold-line"></p>

<h2>Introduction</h2>
<p>This <strong>Event Planning / Decor Contract Agreement (&quot;Agreement&quot;)</strong> is entered into on <strong>{{CREATED_DATE}}</strong> by and between:</p>
<ul class="contract-list">
    <li><strong>Adorned By Veena, LLC</strong>, a limited liability company organized and existing under the laws of the State of Texas, with its principal office located at <strong>19730 Shinnery Ridge Ct, Cypress, TX 77433, represented by Veena Boppana, Principal Designer (the &quot;Company&quot;)</strong>.</li>
    <li><strong>{{CLIENT_NAME}}</strong>, an individual residing at <strong>{{CLIENT_ADDRESS}} (&quot;the Client&quot;)</strong>.</li>
</ul>
<p><strong>The parties hereby agree as follows:</strong></p>

<p class="gold-line"></p>

<h2>Scope of Services</h2>
<h3>Event Planning Services</h3>
<p>The Company agrees to provide the following services for the event hosted by the Client:</p>

<table class="line-items-table">
    <thead>
        <tr>
            <th class="line-name">Service / Product</th>
            <th class="line-qty">Qty</th>
            <th class="line-desc">Description</th>
        </tr>
    </thead>
    <tbody>
        {{LINE_ITEMS}}
    </tbody>
</table>

<p>These services will be provided in accordance with the terms outlined in this Agreement.</p>

<h3>Exclusions</h3>
<p>The following services are excluded from this Agreement:</p>
<ul class="contract-list">
    <li>Travel or accommodation costs for The Company or Client unless otherwise specified.</li>
    <li>Insurance for the event (Client will need to secure separate insurance coverage).</li>
    <li>Costs for any services or items not explicitly mentioned in this Agreement.</li>
</ul>

<div class="avoid-break">
    <h2>Event Details</h2>
    <ul class="contract-list">
        <li><strong>Event Name:</strong> {{EVENT_NAME}}</li>
        <li><strong>Event Date:</strong> {{EVENT_DATE}}</li>
        <li><strong>Event Location:</strong> {{VENUE}}</li>
    </ul>
</div>

<p class="gold-line"></p>

<div class="avoid-break">
    <h2>Compensation and Payment Terms</h2>
    <h3>Fees</h3>
    <ul class="contract-list">
        <li>Flat Event Planning Fee: <strong>\${{TOTAL_AMOUNT}}</strong> for all planning and coordination services.</li>
    </ul>
    <h3>Payment Schedule</h3>
    <ul class="contract-list">
        <li><strong>Deposit:</strong> {{DEPOSIT_STRING}}</li>
        <li><strong>Final Payment:</strong> The remaining balance of <strong>\${{BALANCE}}</strong> is due no later than the day of the event.</li>
    </ul>
    <div class="payment-note">
        Fees are subject to Texas State &amp; Local Sales Tax (currently 8.25% in Cypress/Harris County). Tax will be itemized on the final invoice unless otherwise specified.<br/>
        Payments are accepted via Zelle, Cash, or Credit Card. Credit Card payments incur a 3% convenience fee.<br/>
        Zelle payments should be directed to <strong>adornedbyveena@gmail.com</strong> with the <strong>Inv Ref: {{EVENT_NAME}} - {{EVENT_DATE}}</strong> in the memo.
    </div>
</div>

<p class="gold-line"></p>

<h2>Responsibilities of the Parties</h2>

<div class="avoid-break">
    <h3>The Company&apos;s Responsibilities</h3>
    <ul class="contract-list">
        <li>Provide event planning services as outlined in this Agreement.</li>
        <li>Coordinate and manage vendors, venue, and logistics for the event.</li>
        <li>Ensure all event-related activities are completed as scheduled.</li>
        <li>Maintain communication with Clients to ensure satisfaction and resolve any issues.</li>
        <li>Provide on-site event management to ensure smooth operations during the event.</li>
    </ul>
</div>

<div class="avoid-break">
    <h3>Client&apos;s Responsibilities</h3>
    <ul class="contract-list">
        <li><strong>Information Accuracy:</strong> Provide all event goals, themes, and budget constraints.</li>
        <li><strong>Decision-Making Authority:</strong> Client must designate one (1) primary point of contact with full authority to make binding decisions and approvals.</li>
        <li><strong>Financial Obligations:</strong> Ensure timely payments of planning fees and direct vendor invoices.</li>
        <li><strong>Approvals:</strong> Review and approve designs and contracts within 72 hours of receipt.</li>
        <li><strong>Venue Logistics:</strong> Provide all necessary access codes, loading-dock info, and permits.</li>
        <li><strong>Third-Party Agreements:</strong> Client shall sign and be solely responsible for all vendor contracts.</li>
        <li><strong>Conduct &amp; Liability:</strong> Client is responsible for guest behavior and any damages caused by attendees.</li>
        <li><strong>Proof of Insurance (COI):</strong> Client is responsible for obtaining &apos;Event Cancellation&apos; or &apos;Host Liability&apos; insurance if required by the venue.</li>
    </ul>
</div>

<p class="gold-line"></p>

<div class="avoid-break">
    <h2>Changes and Cancellations</h2>
    <h3>Changes to the Event Scope</h3>
    <p>If Client wishes to make significant changes to the event scope, such as increasing the number of attendees, adding services, or changing the event date, such changes will be documented and may result in additional charges. Changes must be communicated to The Company in writing and approved by both parties.</p>
    <h3>Event Cancellation</h3>
    <p>If the event is canceled by the Client:</p>
    <ul class="contract-list">
        <li><strong>More than 15 days prior to event date:</strong> Client will be responsible for paying 50% of the total fees (deposit and planning services).</li>
        <li><strong>Less than 15 days prior to event date:</strong> Client will be responsible for paying 100% of the total fees (deposit and planning services).</li>
    </ul>
    <h3>Force Majeure &amp; Limited Liability</h3>
    <ul class="contract-list">
        <li>If The Company is unable to perform due to circumstances beyond their reasonable control, including but not limited to hurricanes, tropical storms, regional power grid failures, or other Acts of God &mdash; the Company&apos;s liability shall be limited to refund of the unearned portion of the deposit.</li>
        <li>The Company shall be entitled to retain a prorated amount of the deposit to compensate for services already rendered (e.g., planning hours, site visits, and administrative costs) up to the date of the event. Neither party shall be liable for any further indirect, consequential, or damages.</li>
    </ul>
    <p>This Agreement is governed by the laws of the State of Texas. Any disputes shall be resolved via mandatory mediation in Harris County, Texas, prior to the filing of any lawsuit.</p>
</div>

<p class="gold-line"></p>

<div class="avoid-break">
    <h2>Confidentiality</h2>
    <ul class="contract-list">
        <li>Both parties agree to keep all sensitive information confidential, including but not limited to event details, pricing, and any proprietary business information disclosed during the term of this Agreement.</li>
        <li>This confidentiality obligation will survive the termination of this Agreement.</li>
    </ul>
    <h2>Governing Law</h2>
    <ul class="contract-list">
        <li>This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.</li>
        <li>Any disputes arising from this Agreement will be resolved in the courts located in Harris County, Texas.</li>
    </ul>
</div>

<div class="avoid-break">
    <h2>Miscellaneous Provisions</h2>
    <h3>Entire Agreement</h3>
    <ul class="contract-list">
        <li>This Agreement constitutes the full and complete understanding between the parties regarding the event planning services and supersedes all prior agreements or understandings, whether written or oral.</li>
    </ul>
    <h3>Amendments</h3>
    <ul class="contract-list">
        <li>Any amendments or modifications to this Agreement must be made in writing and signed by both parties.</li>
    </ul>
    <h3>Severability</h3>
    <ul class="contract-list">
        <li>If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.</li>
    </ul>
    <p style="margin: 15px 0 10px 0;">For any inquiries regarding this agreement, please contact <strong>Veena Boppana</strong> at <strong>veena@adornedbyveena.com</strong></p>
</div>

<p class="gold-line"></p>

<div class="avoid-break">
    <h2>Acknowledgement &amp; Acceptance</h2>
    <p>By signing below, the parties acknowledge that they have read, understood, and agree to the terms and conditions outlined in this Agreement.</p>
    <table class="sig-table">
        <tr>
            <td style="width: 45%; vertical-align: top;">
                <div class="sig-block">
                    <strong>Adorned by Veena</strong><br/>
                    Date:
                </div>
            </td>
            <td style="width: 10%;"></td>
            <td style="width: 45%; vertical-align: top;">
                <div class="sig-block">
                    <strong>{{CLIENT_NAME}}</strong><br/>
                    Date:
                </div>
            </td>
        </tr>
    </table>
</div>

</body>
</html>`;

export { CONTRACT_TEMPLATE };
