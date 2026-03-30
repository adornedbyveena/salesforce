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

    // ── Template rendering ─────────────────────────────────────────────────────

    // Fetches an EmailTemplate by DeveloperName and substitutes {!VarName} placeholders.
    private static String[] renderTemplate(String developerName, Map<String, String> vars) {
        EmailTemplate tmpl = [
            SELECT Subject, HtmlValue, Body
            FROM EmailTemplate
            WHERE DeveloperName = :developerName
            LIMIT 1
        ];

        String subject = tmpl.Subject;
        String html    = String.isNotBlank(tmpl.HtmlValue) ? tmpl.HtmlValue : tmpl.Body;

        for (String key : vars.keySet()) {
            String val = vars.get(key) != null ? vars.get(key) : '';
            subject    = subject.replace('{!' + key + '}', val);
            html       = html.replace('{!' + key + '}', val);
        }

        return new String[]{ subject, html };
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
        String[] rendered = renderTemplate('ABV_Contract_Ready', new Map<String, String>{
            'ClientName' => clientName,
            'EventName'  => eventName,
            'ActionUrl'  => contractUrl
        });
        sendWithAttachment(toEmail, rendered[0], rendered[1], pdfBase64, fileName);
    }

    // ── Invoice email (with PDF attachment) ───────────────────────────────────

    public static void sendInvoiceEmail(String toEmail, String clientName, String eventName, String pdfBase64, String fileName) {
        String[] rendered = renderTemplate('ABV_Invoice_Ready', new Map<String, String>{
            'ClientName' => clientName,
            'EventName'  => eventName
        });
        sendWithAttachment(toEmail, rendered[0], rendered[1], pdfBase64, fileName);
    }

    // ── Quote email (with PDF attachment) ─────────────────────────────────────

    public static void sendQuoteEmail(String toEmail, String clientName, String eventName, String quoteUrl, String pdfBase64, String fileName) {
        String[] rendered = renderTemplate('ABV_Quote_Ready', new Map<String, String>{
            'ClientName' => clientName,
            'EventName'  => eventName,
            'ActionUrl'  => quoteUrl
        });
        sendWithAttachment(toEmail, rendered[0], rendered[1], pdfBase64, fileName);
    }

    // ── Quote approved confirmation ────────────────────────────────────────────

    public static void sendQuoteApprovedConfirmation(String toEmail, String clientName, String eventName, String approvedName, DateTime approvedAt) {
        String[] rendered = renderTemplate('ABV_Quote_Approved', new Map<String, String>{
            'ClientName'     => clientName,
            'EventName'      => eventName,
            'ApprovedBy'     => approvedName,
            'ActionDateTime' => approvedAt.format('MMMM d, yyyy \'at\' h:mm a z')
        });
        sendSimpleEmail(toEmail, rendered[0], rendered[1]);
    }

    // ── Contract signed confirmation ───────────────────────────────────────────

    public static void sendContractSignedConfirmation(String toEmail, String clientName, String eventName, String signedName, DateTime signedAt) {
        String[] rendered = renderTemplate('ABV_Contract_Signed', new Map<String, String>{
            'ClientName'     => clientName,
            'EventName'      => eventName,
            'SignedBy'       => signedName,
            'ActionDateTime' => signedAt.format('MMMM d, yyyy \'at\' h:mm a z')
        });
        sendSimpleEmail(toEmail, rendered[0], rendered[1]);
    }

    // ── Lead inquiry notifications ─────────────────────────────────────────────

    public static void sendLeadThankYou(String toEmail, String firstName, String eventName) {
        String[] rendered = renderTemplate('ABV_Lead_Thank_You', new Map<String, String>{
            'FirstName' => firstName,
            'EventName' => eventName
        });
        sendSimpleEmail(toEmail, rendered[0], rendered[1]);
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

    private static void sendWithAttachment(String toEmail, String subject, String htmlBody, String pdfBase64, String fileName) {
        String boundary = 'ABV_BOUNDARY_' + String.valueOf(DateTime.now().getTime());
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
        sendRaw(rawEmail);
    }

    private static void sendSimpleEmail(String toEmail, String subject, String htmlBody) {
        String rawEmail = 'To: ' + toEmail + '\r\n'
            + 'Subject: ' + subject + '\r\n'
            + 'MIME-Version: 1.0\r\n'
            + 'Content-Type: text/html; charset=UTF-8\r\n\r\n'
            + htmlBody;
        sendRaw(rawEmail);
    }

    private static void sendRaw(String rawEmail) {
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
}
