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

    public static void sendContractEmail(
        String toEmail,
        String clientName,
        String eventName,
        String contractUrl,
        String pdfBase64,
        String fileName
    ) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
        String subject  = 'Your Event Contract - ' + eventName;

        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + buildEmailBody(clientName, eventName, contractUrl) + '\r\n\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: application/pdf\r\n'
            + 'Content-Transfer-Encoding: base64\r\n'
            + 'Content-Disposition: attachment; filename="' + fileName + '"\r\n\r\n'
            + pdfBase64 + '\r\n\r\n'
            + '--' + boundary + '--';

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

    public static void sendInvoiceEmail(String toEmail, String clientName, String eventName, String pdfBase64, String fileName) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
        String subject  = 'Your Invoice - ' + eventName;
        String htmlBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;">ADORNED BY VEENA</h2>'
            + '</div>'
            + '<div style="padding:32px;background:#fff;">'
            + '<p>Dear ' + clientName + ',</p>'
            + '<p>Please find your invoice for <strong>' + eventName + '</strong> attached to this email.</p>'
            + '<p>Payment can be sent via Zelle to <strong>adornedbyveena@gmail.com</strong> with the invoice reference in the memo.</p>'
            + '<p>If you have any questions please contact us at <a href="mailto:veena@adornedbyveena.com">veena@adornedbyveena.com</a>.</p>'
            + '<p>Warm regards,<br/><strong>Veena Boppana</strong><br/>Principal Designer, Adorned By Veena</p>'
            + '</div></div>';

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

    public static void sendQuoteEmail(String toEmail, String clientName, String eventName, String quoteUrl, String pdfBase64, String fileName) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
        String subject  = 'Your Quote - ' + eventName;
        String htmlBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;">ADORNED BY VEENA</h2>'
            + '</div>'
            + '<div style="padding:32px;background:#fff;">'
            + '<p>Dear ' + clientName + ',</p>'
            + '<p>Please find your personalized quote for <strong>' + eventName + '</strong> attached to this email.</p>'
            + '<p>Click the button below to review and approve your quote online:</p>'
            + '<p style="text-align:center;margin:32px 0;">'
            + '<a href="' + quoteUrl + '" style="background:#D4AF37;color:#fff;padding:14px 32px;'
            + 'text-decoration:none;font-weight:bold;font-size:16px;">Review &amp; Approve Quote</a>'
            + '</p>'
            + '<p style="font-size:13px;color:#888;">If the button does not work, copy and paste this link into your browser:<br/>'
            + '<a href="' + quoteUrl + '">' + quoteUrl + '</a></p>'
            + '<p>This quote is valid for 30 days. If you have any questions please contact us at '
            + '<a href="mailto:veena@adornedbyveena.com">veena@adornedbyveena.com</a>.</p>'
            + '<p>Warm regards,<br/><strong>Veena Boppana</strong><br/>Principal Designer, Adorned By Veena</p>'
            + '</div></div>';

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

    public static void sendQuoteApprovedConfirmation(String toEmail, String clientName, String eventName, String approvedName, DateTime approvedAt) {
        String subject  = 'Quote Approved – ' + eventName;
        String htmlBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;">ADORNED BY VEENA</h2>'
            + '</div>'
            + '<div style="padding:32px;background:#fff;">'
            + '<p>Dear ' + clientName + ',</p>'
            + '<p>Thank you! Your quote for <strong>' + eventName + '</strong> has been approved.</p>'
            + '<table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9f6f0;">'
            + '<tr><td style="padding:12px 16px;font-weight:bold;width:40%;">Approved by:</td><td style="padding:12px 16px;">' + approvedName + '</td></tr>'
            + '<tr><td style="padding:12px 16px;font-weight:bold;border-top:1px solid #e8d9c0;">Date &amp; Time:</td><td style="padding:12px 16px;border-top:1px solid #e8d9c0;">' + approvedAt.format('MMMM d, yyyy \'at\' h:mm a z') + '</td></tr>'
            + '</table>'
            + '<p>We\'re excited to bring your vision to life! We will follow up shortly with next steps including your event contract.</p>'
            + '<p>If you have any questions please contact us at <a href="mailto:veena@adornedbyveena.com">veena@adornedbyveena.com</a>.</p>'
            + '<p>Warm regards,<br/><strong>Veena Boppana</strong><br/>Principal Designer, Adorned By Veena</p>'
            + '</div></div>';

        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody;

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

    public static void sendContractSignedConfirmation(String toEmail, String clientName, String eventName, String signedName, DateTime signedAt) {
        String subject  = 'Contract Signed – ' + eventName;
        String htmlBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;">ADORNED BY VEENA</h2>'
            + '</div>'
            + '<div style="padding:32px;background:#fff;">'
            + '<p>Dear ' + clientName + ',</p>'
            + '<p>Thank you! Your Event Planning &amp; D&eacute;cor Contract for <strong>' + eventName + '</strong> has been signed and is now legally binding.</p>'
            + '<table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9f6f0;">'
            + '<tr><td style="padding:12px 16px;font-weight:bold;width:40%;">Signed by:</td><td style="padding:12px 16px;">' + signedName + '</td></tr>'
            + '<tr><td style="padding:12px 16px;font-weight:bold;border-top:1px solid #e8d9c0;">Date &amp; Time:</td><td style="padding:12px 16px;border-top:1px solid #e8d9c0;">' + signedAt.format('MMMM d, yyyy \'at\' h:mm a z') + '</td></tr>'
            + '</table>'
            + '<p>We are excited to bring your vision to life! We will be in touch with next steps.</p>'
            + '<p>If you have any questions please contact us at <a href="mailto:veena@adornedbyveena.com">veena@adornedbyveena.com</a>.</p>'
            + '<p>Warm regards,<br/><strong>Veena Boppana</strong><br/>Principal Designer, Adorned By Veena</p>'
            + '</div></div>';

        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody;

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

    // ── Lead inquiry notifications ─────────────────────────────────────────────

    public static void sendLeadThankYou(String toEmail, String firstName, String eventName) {
        String subject = 'We received your inquiry \u2013 ' + eventName;
        String htmlBody = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;">ADORNED BY VEENA</h2>'
            + '</div>'
            + '<div style="padding:32px;background:#fff;">'
            + '<p>Hi ' + firstName + ',</p>'
            + '<p>Thank you for reaching out to <strong>Adorned by Veena</strong>! '
            + 'We\'re thrilled to hear about your upcoming event and look forward to making it truly special.</p>'
            + '<p>We\'ve received your inquiry for <strong>' + eventName + '</strong> and will review the details shortly. '
            + 'You can expect to hear from us within <strong>24\u201348 hours</strong>.</p>'
            + '<p>In the meantime, feel free to reach out with any questions at '
            + '<a href="mailto:veena@adornedbyveena.com">veena@adornedbyveena.com</a>.</p>'
            + '<p>We can\'t wait to bring your vision to life!</p>'
            + '<p>Warm regards,<br/><strong>Veena Boppana</strong><br/>Principal Designer, Adorned By Veena</p>'
            + '</div>'
            + '<div style="background:#f9f6f0;padding:16px;text-align:center;font-size:12px;color:#888;">'
            + 'Adorned By Veena &nbsp;|&nbsp; Houston, TX'
            + '</div>'
            + '</div>';
        sendSimpleEmail(toEmail, subject, htmlBody);
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

        String dateStr     = eventDate != null          ? eventDate.format()                       : '\u2014';
        String altDateStr  = String.isNotBlank(altEventDate)  ? altEventDate                       : '\u2014';
        String budgetStr   = String.isNotBlank(budget)        ? budget                             : '\u2014';
        String guestStr    = String.isNotBlank(guestCount)    ? guestCount                         : '\u2014';
        String servicesStr = String.isNotBlank(services)      ? services.replace(';', ', ')        : '\u2014';

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

    // ── Contract email body builder ────────────────────────────────────────────

    static String buildEmailBody(String clientName, String eventName, String contractUrl) {
        return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;letter-spacing:2px;">ADORNED BY VEENA</h2>'
            + '</div>'
            + '<div style="padding:32px;background:#fff;">'
            + '<p>Dear ' + clientName + ',</p>'
            + '<p>Your Event Planning &amp; D&eacute;cor Contract for <strong>' + eventName + '</strong> is ready for your review and signature.</p>'
            + '<p>Please click the button below to view and sign your contract:</p>'
            + '<p style="text-align:center;margin:32px 0;">'
            + '<a href="' + contractUrl + '" style="background:#D4AF37;color:#fff;padding:14px 32px;'
            + 'text-decoration:none;font-weight:bold;font-size:16px;">Review &amp; Sign Contract</a>'
            + '</p>'
            + '<p style="font-size:13px;color:#888;">If the button does not work, copy and paste this link into your browser:<br/>'
            + '<a href="' + contractUrl + '">' + contractUrl + '</a></p>'
            + '<p>If you have any questions please contact us at '
            + '<a href="mailto:veena@adornedbyveena.com">veena@adornedbyveena.com</a>.</p>'
            + '<p>Warm regards,<br/><strong>Veena Boppana</strong><br/>'
            + 'Principal Designer, Adorned By Veena</p>'
            + '</div>'
            + '</div>';
    }
}