public with sharing class ContractController {

    @AuraEnabled
    public static void saveContractHtml(String recordId, String html) {
        String token = EncodingUtil.convertToHex(Crypto.generateAesKey(128));
        update new Opportunity(
            Id = recordId,
            Contract_HTML__c = html,
            Contract_Token__c = token,
            Contract_Status__c = 'Draft'
        );
    }

    @AuraEnabled
    public static String generateContractPdf(String recordId) {
        // Token was already saved (and committed) by saveContractHtml — just read it
        Opportunity opp = [SELECT Contract_Token__c FROM Opportunity WHERE Id = :recordId LIMIT 1];
        String token = opp.Contract_Token__c;

        PageReference pdfPage = Page.ContractAcceptance;
        pdfPage.getParameters().put('token', token);
        pdfPage.getParameters().put('pdf', 'true');
        Blob pdfBlob = Test.isRunningTest()
            ? Blob.valueOf('test')
            : pdfPage.getContentAsPDF();
        return EncodingUtil.base64Encode(pdfBlob);
    }

    @AuraEnabled
    public static void sendContractEmail(String recordId) {
        Opportunity opp = [
            SELECT Id, Name, CloseDate, Client_Email__c, Client_Name_Formula__c, Account.Name, Contract_Token__c
            FROM Opportunity
            WHERE Id = :recordId
            LIMIT 1
        ];

        String token       = opp.Contract_Token__c;
        String clientName  = String.isNotBlank(opp.Client_Name_Formula__c)
                             ? opp.Client_Name_Formula__c : opp.Account.Name;
        String contractUrl = System.Label.Contract_Site_URL + '?token=' + token;

        // 1 — Re-generate PDF blob (callout)
        PageReference pdfPage = Page.ContractAcceptance;
        pdfPage.getParameters().put('token', token);
        pdfPage.getParameters().put('pdf', 'true');
        Blob pdfBlob = Test.isRunningTest()
            ? Blob.valueOf('test')
            : pdfPage.getContentAsPDF();

        // 2 — Upload to Google Drive: ABV Contracts and Invoices / <Client Name> - <Event Date> /
        String eventDate  = opp.CloseDate != null ? opp.CloseDate.format() : '';
        String folderName = clientName + (String.isNotBlank(eventDate) ? ' - ' + eventDate : '');
        String fileName   = clientName + ' - Contract - ' + Date.today().format() + '.pdf';
        String folderUrl  = GoogleDriveService.uploadContract(folderName, fileName, pdfBlob);

        // 3 — Send via Gmail
        GoogleGmailService.sendContractEmail(opp.Client_Email__c, clientName, opp.Name, contractUrl);

        // 4 — Update Opportunity status (DML must be last — after all callouts)
        update new Opportunity(
            Id                   = recordId,
            Contract_Status__c   = 'Sent',
            Contract_Sent_Date__c = Date.today(),
            StageName            = 'Contract Sent',
            Drive_Folder_URL__c  = folderUrl
        );
    }

    private static String buildEmailBody(String clientName, String oppName, String url) {
        return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            + '<div style="background:#D4AF37;padding:24px;text-align:center;">'
            + '<h2 style="color:#fff;margin:0;">Adorned By Veena</h2>'
            + '</div>'
            + '<div style="padding:32px;">'
            + '<p>Dear ' + clientName + ',</p>'
            + '<p>Your event contract for <strong>' + oppName + '</strong> is ready for review and signature.</p>'
            + '<p>Please click the button below to view and sign your contract:</p>'
            + '<p style="text-align:center;margin:32px 0;">'
            + '<a href="' + url + '" style="background:#D4AF37;color:#fff;padding:14px 28px;'
            + 'text-decoration:none;border-radius:4px;font-weight:bold;font-size:16px;">'
            + 'View &amp; Sign Contract</a>'
            + '</p>'
            + '<p>If you have any questions, please don\'t hesitate to reach out.</p>'
            + '<p>Warm regards,<br/><strong>Adorned By Veena</strong></p>'
            + '</div>'
            + '</div>';
    }
}
