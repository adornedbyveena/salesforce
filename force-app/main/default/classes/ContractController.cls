public with sharing class ContractController {

    @AuraEnabled
    public static void sendContractEmail(String recordId, String pdfBase64, String fileName) {
        Opportunity opp = [
            SELECT Id, Name, CloseDate, Client_Email__c, Client_Name_Formula__c, Account.Name
            FROM Opportunity
            WHERE Id = :recordId
            LIMIT 1
        ];

        String clientName  = String.isNotBlank(opp.Client_Name_Formula__c)
                             ? opp.Client_Name_Formula__c : opp.Account.Name;
        String eventDate   = opp.CloseDate != null ? opp.CloseDate.format() : '';
        String folderName  = clientName + (String.isNotBlank(eventDate) ? ' - ' + eventDate : '');

        // Generate token for the client signing link
        String token       = EncodingUtil.convertToHex(Crypto.generateAesKey(128));
        String contractUrl = System.Label.Contract_Site_URL + '?token=' + token;

        // Decode the client-generated PDF blob
        Blob pdfBlob = Test.isRunningTest()
            ? Blob.valueOf('test')
            : EncodingUtil.base64Decode(pdfBase64);

        // 1 — Upload to Google Drive
        String folderUrl = GoogleDriveService.uploadContract(folderName, fileName, pdfBlob);

        // 2 — Send via Gmail (PDF attached + signing link in body)
        String pdfBase64ForEmail = Test.isRunningTest() ? '' : EncodingUtil.base64Encode(pdfBlob);
        GoogleGmailService.sendContractEmail(opp.Client_Email__c, clientName, opp.Name, contractUrl, pdfBase64ForEmail, fileName);

        // 3 — DML last (after all callouts)
        update new Opportunity(
            Id                    = recordId,
            Contract_Token__c     = token,
            Contract_Status__c    = 'Sent',
            Contract_Sent_Date__c = Date.today(),
            StageName             = 'Contract Sent',
            Drive_Folder_URL__c   = folderUrl
        );
    }
}