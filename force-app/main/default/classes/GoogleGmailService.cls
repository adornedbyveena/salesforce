public class GoogleGmailService {

    static final String NC = 'callout:Google_APIs';

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
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new CalloutException('Gmail send failed (' + res.getStatusCode() + '): ' + res.getBody());
        }
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
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new CalloutException('Gmail invoice send failed (' + res.getStatusCode() + '): ' + res.getBody());
        }
    }

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
