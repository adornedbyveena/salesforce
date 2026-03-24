public with sharing class ContractController {

    @AuraEnabled
    public static void saveContractHtml(String recordId, String html) {
        update new Opportunity(
            Id = recordId,
            Contract_HTML__c = html,
            Contract_Status__c = 'Draft'
        );
    }

    @AuraEnabled
    public static void sendContractEmail(String recordId) {
        Opportunity opp = [
            SELECT Id, Name, Client_Email__c, Client_Name_Formula__c, Account.Name
            FROM Opportunity
            WHERE Id = :recordId
            LIMIT 1
        ];

        String token = EncodingUtil.convertToHex(Crypto.generateAesKey(128));
        String acceptanceUrl = System.Label.Contract_Site_URL + '?token=' + token;

        String clientName = String.isNotBlank(opp.Client_Name_Formula__c)
            ? opp.Client_Name_Formula__c
            : opp.Account.Name;

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{ opp.Client_Email__c });
        email.setSubject('Your Contract from Adorned By Veena \u2013 ' + opp.Name);
        email.setHtmlBody(buildEmailBody(clientName, opp.Name, acceptanceUrl));
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });

        update new Opportunity(
            Id = recordId,
            Contract_Token__c = token,
            Contract_Status__c = 'Sent',
            Contract_Sent_Date__c = Date.today(),
            StageName = 'Contract Sent'
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
