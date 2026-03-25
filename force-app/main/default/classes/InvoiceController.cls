public with sharing class InvoiceController {

    @AuraEnabled
    public static void sendInvoiceEmail(String recordId, String pdfBase64, String fileName) {
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

        Blob pdfBlob = EncodingUtil.base64Decode(pdfBase64);

        // 1 — Upload PDF to Google Drive
        String folderUrl = GoogleDriveService.uploadContract(folderName, fileName, pdfBlob);

        // 2 — Send email via Gmail with PDF attached
        GoogleGmailService.sendInvoiceEmail(opp.Client_Email__c, clientName, opp.Name, pdfBase64, fileName);

        // 3 — DML last (after all callouts)
        update new Opportunity(
            Id                   = recordId,
            Invoice_Status__c    = 'Sent',
            Invoice_Sent_Date__c = Date.today(),
            Drive_Folder_URL__c  = folderUrl
        );
    }
}