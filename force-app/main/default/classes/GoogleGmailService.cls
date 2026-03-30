public class GoogleGmailService {

    static final String NC = 'callout:Google_APIs';

    private static final String REAUTH_MSG =
        'Google authentication has expired. ' +
        'To fix: Setup → Security → Named Credentials → External Credentials → ' +
        'Google_OAuth → Named Principals → ABV_Google → Authenticate.';

    private static void checkResponse(HttpResponse res) {
        if (res.getStatusCode() == 401) throw new AuraHandledException(REAUTH_MSG);
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new CalloutException('Email could not be sent. Please try again or contact support.');
        }
    }

    // ── Shared template builders ───────────────────────────────────────────────

    private static String buildHeader() {
        return '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:3px;font-family:Arial,sans-serif;font-size:20px;">ADORNED BY VEENA</h2>'
            + '</div>';
    }

    private static String buildSignature() {
        return '<div style="border-top:1px solid #e8d9c0;margin-top:36px;padding-top:24px;text-align:center;font-family:Arial,sans-serif;">'
            + '<img src="https://adornedbyveena.com/wp-content/uploads/2026/02/LogoPNG-01-150x150.png" '
            + 'width="72" height="72" alt="Adorned by Veena" style="display:block;margin:0 auto 12px;border-radius:50%;"/>'
            + '<p style="margin:0 0 2px;font-weight:bold;font-size:15px;color:#2c2c2c;">Veena Boppana</p>'
            + '<p style="margin:0 0 10px;font-style:italic;color:#C9A035;font-size:13px;">Founder &amp; Principal Designer</p>'
            + '<p style="margin:0 0 14px;font-size:12px;color:#555;">'
            + 'w&nbsp;<a href="https://adornedbyveena.com" style="color:#C9A035;text-decoration:none;">adornedbyveena.com</a>'
            + '&nbsp;&nbsp;|&nbsp;&nbsp;'
            + 'e&nbsp;<a href="mailto:veena@adornedbyveena.com" style="color:#C9A035;text-decoration:none;">veena@adornedbyveena.com</a>'
            + '</p>'
            + '<div style="border-top:1px solid #e8d9c0;margin:0 auto 14px;width:80%;"></div>'
            + '<p style="margin:0 0 12px;font-size:11px;color:#aaa;letter-spacing:2px;">ARTISTRY IN PLANNING &bull; ELEGANCE IN DETAIL</p>'
            + '<p style="margin:0;font-size:12px;">'
            + '<a href="https://www.instagram.com/adorned_by_veena/" style="color:#C9A035;text-decoration:none;">Instagram</a>'
            + '&nbsp;&nbsp;/&nbsp;&nbsp;'
            + '<a href="https://www.facebook.com/p/Adorned-by-Veena-100062665519080/" style="color:#C9A035;text-decoration:none;">Facebook</a>'
            + '&nbsp;&nbsp;/&nbsp;&nbsp;'
            + '<a href="https://adornedbyveena.com/gallery/" style="color:#C9A035;text-decoration:none;">Portfolio</a>'
            + '</p>'
            + '</div>';
    }

    private static String wrapEmail(String bodyContent) {
        return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">'
            + buildHeader()
            + '<div style="padding:32px 36px;">'
            + bodyContent
            + buildSignature()
            + '</div>'
            + '</div>';
    }

    // ── Contract email (with PDF attachment) ──────────────────────────────────

    public static void sendContractEmail(
        String toEmail,
        String clientName,
        String eventName,
        String contractUrl,
        String pdfBase64,
        String fileName
    ) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
        String subject  = 'Your Event Contract \u2013 ' + eventName;
        String htmlBody = buildEmailBody(clientName, eventName, contractUrl);

        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody + '\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: application/pdf\r\n'
            + 'Content-Transfer-Encoding: base64\r\n'
            + 'Content-Disposition: attachment; filename="' + fileName + '"\r\n\r\n'
            + pdfBase64 + '\r\n\r\n'
            + '--' + boundary + '--';

        sendRaw(toEmail, rawEmail);
    }

    // ── Invoice email (with PDF attachment) ───────────────────────────────────

    public static void sendInvoiceEmail(String toEmail, String clientName, String eventName, String pdfBase64, String fileName) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
        String subject  = 'Your Invoice \u2013 ' + eventName;

        String body = '<p>Dear ' + clientName + ',</p>'
            + '<p>Please find your invoice for <strong>' + eventName + '</strong> attached to this email.</p>'
            + '<p>Payment can be sent via Zelle to <strong>adornedbyveena@gmail.com</strong> with the invoice reference in the memo.</p>'
            + '<p>If you have any questions please don\'t hesitate to reach out.</p>';

        String htmlBody = wrapEmail(body);

        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody + '\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: application/pdf\r\n'
            + 'Content-Transfer-Encoding: base64\r\n'
            + 'Content-Disposition: attachment; filename="' + fileName + '"\r\n\r\n'
            + pdfBase64 + '\r\n\r\n'
            + '--' + boundary + '--';

        sendRaw(toEmail, rawEmail);
    }

    // ── Quote email (with PDF attachment) ─────────────────────────────────────

    public static void sendQuoteEmail(String toEmail, String clientName, String eventName, String quoteUrl, String pdfBase64, String fileName) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
        String subject  = 'Your Quote \u2013 ' + eventName;

        String body = '<p>Dear ' + clientName + ',</p>'
            + '<p>Please find your personalized quote for <strong>' + eventName + '</strong> attached to this email.</p>'
            + '<p>Click the button below to review and approve your quote online:</p>'
            + '<p style="text-align:center;margin:32px 0;">'
            + '<a href="' + quoteUrl + '" style="background:#D4AF37;color:#fff;padding:14px 32px;'
            + 'text-decoration:none;font-weight:bold;font-size:15px;border-radius:4px;">Review &amp; Approve Quote</a>'
            + '</p>'
            + '<p style="font-size:12px;color:#999;text-align:center;">If the button does not work, copy and paste this link:<br/>'
            + '<a href="' + quoteUrl + '" style="color:#C9A035;">' + quoteUrl + '</a></p>'
            + '<p style="font-size:13px;color:#666;">This quote is valid for 30 days.</p>';

        String htmlBody = wrapEmail(body);

        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody + '\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: application/pdf\r\n'
            + 'Content-Transfer-Encoding: base64\r\n'
            + 'Content-Disposition: attachment; filename="' + fileName + '"\r\n\r\n'
            + pdfBase64 + '\r\n\r\n'
            + '--' + boundary + '--';

        sendRaw(toEmail, rawEmail);
    }

    // ── Quote approved confirmation ────────────────────────────────────────────

    public static void sendQuoteApprovedConfirmation(String toEmail, String clientName, String eventName, String approvedName, DateTime approvedAt) {
        String subject = 'Quote Approved \u2013 ' + eventName;

        String body = '<p>Dear ' + clientName + ',</p>'
            + '<p>Thank you! Your quote for <strong>' + eventName + '</strong> has been approved.</p>'
            + '<table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9f6f0;">'
            + '<tr><td style="padding:12px 16px;font-weight:bold;width:40%;border:1px solid #e8d9c0;">Approved by:</td>'
            + '<td style="padding:12px 16px;border:1px solid #e8d9c0;">' + approvedName + '</td></tr>'
            + '<tr><td style="padding:12px 16px;font-weight:bold;border:1px solid #e8d9c0;">Date &amp; Time:</td>'
            + '<td style="padding:12px 16px;border:1px solid #e8d9c0;">' + approvedAt.format('MMMM d, yyyy \'at\' h:mm a z') + '</td></tr>'
            + '</table>'
            + '<p>We\'re excited to bring your vision to life! We will follow up shortly with next steps including your event contract.</p>';

        sendSimpleEmail(toEmail, subject, wrapEmail(body));
    }

    // ── Contract signed confirmation ───────────────────────────────────────────

    public static void sendContractSignedConfirmation(String toEmail, String clientName, String eventName, String signedName, DateTime signedAt) {
        String subject = 'Contract Signed \u2013 ' + eventName;

        String body = '<p>Dear ' + clientName + ',</p>'
            + '<p>Thank you! Your Event Planning &amp; D&eacute;cor Contract for <strong>' + eventName + '</strong> has been signed and is now legally binding.</p>'
            + '<table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9f6f0;">'
            + '<tr><td style="padding:12px 16px;font-weight:bold;width:40%;border:1px solid #e8d9c0;">Signed by:</td>'
            + '<td style="padding:12px 16px;border:1px solid #e8d9c0;">' + signedName + '</td></tr>'
            + '<tr><td style="padding:12px 16px;font-weight:bold;border:1px solid #e8d9c0;">Date &amp; Time:</td>'
            + '<td style="padding:12px 16px;border:1px solid #e8d9c0;">' + signedAt.format('MMMM d, yyyy \'at\' h:mm a z') + '</td></tr>'
            + '</table>'
            + '<p>We are excited to bring your vision to life! We will be in touch with next steps.</p>';

        sendSimpleEmail(toEmail, subject, wrapEmail(body));
    }

    // ── Lead inquiry notifications ─────────────────────────────────────────────

    public static void sendLeadThankYou(String toEmail, String firstName, String eventName) {
        String subject = 'We received your inquiry \u2013 ' + eventName;

        String body = '<p>Hi ' + firstName + ',</p>'
            + '<p>Thank you for reaching out to <strong>Adorned by Veena</strong>! '
            + 'We\'re thrilled to hear about your upcoming event and look forward to making it truly special.</p>'
            + '<p>We\'ve received your inquiry for <strong>' + eventName + '</strong> and will review the details shortly. '
            + 'You can expect to hear from us within <strong>24\u201348 hours</strong>.</p>'
            + '<p>In the meantime, feel free to reach out with any questions at '
            + '<a href="mailto:veena@adornedbyveena.com" style="color:#C9A035;">veena@adornedbyveena.com</a>.</p>'
            + '<p>We can\'t wait to bring your vision to life!</p>';

        sendSimpleEmail(toEmail, subject, wrapEmail(body));
    }

    public static void sendInternalLeadNotification(
        String clientName, String clientEmail, String clientPhone,
        String eventName, String eventType,
        Date eventDate, String altEventDate, String dateFlexibility,
        String budget, String guestCount,
        String services, String description,
        String oppUrl
    ) {
        String subject = 'New Inquiry \u2013 ' + clientName + ' | ' + eventName;

        String dateStr     = eventDate != null               ? eventDate.format()              : '\u2014';
        String altDateStr  = String.isNotBlank(altEventDate) ? altEventDate                    : '\u2014';
        String budgetStr   = String.isNotBlank(budget)       ? budget                          : '\u2014';
        String guestStr    = String.isNotBlank(guestCount)   ? guestCount                      : '\u2014';
        String servicesStr = String.isNotBlank(services)     ? services.replace(';', ', ')     : '\u2014';

        String htmlBody = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:20px 24px;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;font-size:18px;">ADORNED BY VEENA</h2>'
            + '<p style="color:#fff5d6;margin:4px 0 0;font-size:14px;">New Web Inquiry Received</p>'
            + '</div>'
            + '<div style="padding:24px;background:#fff;">'
            + '<h3 style="margin-top:0;color:#333;">' + eventName + '</h3>'
            + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
            + internalRow('Client',           clientName)
            + internalRow('Email',            '<a href="mailto:' + clientEmail + '">' + clientEmail + '</a>')
            + internalRow('Phone',            String.isNotBlank(clientPhone) ? clientPhone : '\u2014')
            + internalRow('Event Type',       String.isNotBlank(eventType) ? eventType : '\u2014')
            + internalRow('Event Date',       dateStr)
            + internalRow('Alt. Date',        altDateStr)
            + internalRow('Date Flexibility', String.isNotBlank(dateFlexibility) ? dateFlexibility : '\u2014')
            + internalRow('Est. Budget',      budgetStr)
            + internalRow('Guest Count',      guestStr)
            + internalRow('Services',         servicesStr)
            + internalRow('Notes',            String.isNotBlank(description) ? description : '\u2014')
            + '</table>'
            + '<p style="margin-top:24px;">'
            + '<a href="' + oppUrl + '" style="background:#D4AF37;color:#fff;padding:10px 24px;'
            + 'text-decoration:none;font-weight:bold;border-radius:4px;">View Opportunity</a>'
            + '</p>'
            + '</div></div>';

        sendSimpleEmail('veena@adornedbyveena.com', subject, htmlBody);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private static String internalRow(String label, String value) {
        return '<tr>'
            + '<td style="padding:8px 12px;font-weight:bold;background:#f9f6f0;'
            + 'border:1px solid #e8d9c0;width:35%;vertical-align:top;">' + label + '</td>'
            + '<td style="padding:8px 12px;border:1px solid #e8d9c0;">' + value + '</td>'
            + '</tr>';
    }

    private static void sendSimpleEmail(String toEmail, String subject, String htmlBody) {
        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody;
        sendRaw(toEmail, rawEmail);
    }

    private static void sendRaw(String toEmail, String rawEmail) {
        String b64 = EncodingUtil.base64Encode(Blob.valueOf(rawEmail));
        b64 = b64.replace('+', '-').replace('/', '_').replace('=', '');

        HttpRequest req = new HttpRequest();
        req.setEndpoint(NC + '/gmail/v1/users/me/messages/send');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody('{"raw":"' + b64 + '"}');
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);
        checkResponse(res);
    }

    // ── Contract email body builder (used by sendContractEmail) ───────────────

    static String buildEmailBody(String clientName, String eventName, String contractUrl) {
        String body = '<p>Dear ' + clientName + ',</p>'
            + '<p>Your Event Planning &amp; D&eacute;cor Contract for <strong>' + eventName + '</strong> is ready for your review and signature.</p>'
            + '<p>Please click the button below to view and sign your contract:</p>'
            + '<p style="text-align:center;margin:32px 0;">'
            + '<a href="' + contractUrl + '" style="background:#D4AF37;color:#fff;padding:14px 32px;'
            + 'text-decoration:none;font-weight:bold;font-size:15px;border-radius:4px;">Review &amp; Sign Contract</a>'
            + '</p>'
            + '<p style="font-size:12px;color:#999;text-align:center;">If the button does not work, copy and paste this link:<br/>'
            + '<a href="' + contractUrl + '" style="color:#C9A035;">' + contractUrl + '</a></p>';
        return wrapEmail(body);
    }
}
