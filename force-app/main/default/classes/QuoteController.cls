public with sharing class QuoteController {

    @AuraEnabled
    public static void sendQuoteEmail(String recordId, String pdfBase64, String fileName, String quoteHtml) {
        Opportunity opp = [
            SELECT Id, Name, CloseDate, Client_Email__c, Client_Name_Formula__c, Account.Name
            FROM Opportunity
            WHERE Id = :recordId
            LIMIT 1
        ];

        String clientName = String.isNotBlank(opp.Client_Name_Formula__c)
                            ? opp.Client_Name_Formula__c : opp.Account.Name;
        String eventDate  = opp.CloseDate != null ? opp.CloseDate.format() : '';
        String folderName = clientName + (String.isNotBlank(eventDate) ? ' - ' + eventDate : '');

        // Generate token for the client approval link
        String token    = EncodingUtil.convertToHex(Crypto.generateAesKey(128));
        String quoteUrl = System.Label.Quote_Site_URL + '?token=' + token;

        Blob pdfBlob = Test.isRunningTest()
            ? Blob.valueOf('test')
            : EncodingUtil.base64Decode(pdfBase64);

        // 1 — Upload to Google Drive
        String folderUrl = GoogleDriveService.uploadContract(folderName, fileName, pdfBlob);

        // 2 — Send via Gmail (catch so Drive URL is always saved even if email fails)
        String pdfBase64ForEmail = Test.isRunningTest() ? '' : EncodingUtil.base64Encode(pdfBlob);
        String emailError = null;
        try {
            GoogleGmailService.sendQuoteEmail(opp.Client_Email__c, clientName, opp.Name, quoteUrl, pdfBase64ForEmail, fileName);
        } catch (Exception e) {
            emailError = e.getMessage();
        }

        // 3 — DML always runs after all callouts
        update new Opportunity(
            Id                  = recordId,
            Quote_Token__c      = token,
            Quote_Status__c     = 'Sent',
            Quote_Sent_Date__c  = Date.today(),
            StageName           = 'Building Proposal',
            Drive_Folder_URL__c = folderUrl,
            Quote_HTML__c       = quoteHtml
        );

        if (emailError != null) {
            throw new AuraHandledException('Quote saved to Drive but email failed: ' + emailError);
        }
    }
}
