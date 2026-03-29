public class LeadNotificationQueueable implements Queueable, Database.AllowsCallouts {

    private List<Id> oppIds;

    public LeadNotificationQueueable(List<Id> oppIds) {
        this.oppIds = oppIds;
    }

    public void execute(QueueableContext ctx) {
        List<Opportunity> opps = [
            SELECT Id, Name, Event_Type__c, CloseDate, Alternative_Event_Date__c,
                   Date_Flexibility__c, Estimated_Budget__c, Estimated_Guest_Count__c,
                   Services__c, Description, LeadSource,
                   Account.FirstName, Account.LastName, Account.PersonEmail, Account.Phone
            FROM Opportunity
            WHERE Id IN :oppIds
        ];

        String orgUrl = URL.getOrgDomainUrl().toExternalForm();

        for (Opportunity opp : opps) {
            if (opp.Account == null || String.isBlank(opp.Account.PersonEmail)) continue;

            String firstName  = opp.Account.FirstName != null ? opp.Account.FirstName : '';
            String clientName = (firstName + ' ' + opp.Account.LastName).trim();
            String oppUrl     = orgUrl + '/' + opp.Id;

            try {
                GoogleGmailService.sendLeadThankYou(
                    opp.Account.PersonEmail,
                    firstName,
                    opp.Name
                );
            } catch (Exception e) {
                System.debug('LeadNotification: thank-you email failed — ' + e.getMessage());
            }

            try {
                GoogleGmailService.sendInternalLeadNotification(
                    clientName,
                    opp.Account.PersonEmail,
                    opp.Account.Phone,
                    opp.Name,
                    opp.Event_Type__c,
                    opp.CloseDate,
                    opp.Alternative_Event_Date__c,
                    opp.Date_Flexibility__c,
                    opp.Estimated_Budget__c,
                    opp.Estimated_Guest_Count__c,
                    opp.Services__c,
                    opp.Description,
                    oppUrl
                );
            } catch (Exception e) {
                System.debug('LeadNotification: internal alert email failed — ' + e.getMessage());
            }
        }
    }
}
