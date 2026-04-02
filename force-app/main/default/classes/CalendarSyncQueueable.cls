public class CalendarSyncQueueable implements Queueable, Database.AllowsCallouts {

    private List<Id> oppIds;

    public CalendarSyncQueueable(List<Id> oppIds) {
        this.oppIds = oppIds;
    }

    public void execute(QueueableContext ctx) {
        List<Opportunity> opps = [
            SELECT Id, Name, CloseDate, Calendar_Event_Id__c,
                   Client_Name_Formula__c, Account.Name, Event_Type__c, StageName
            FROM Opportunity
            WHERE Id IN :oppIds
            AND CloseDate != null
        ];

        List<Opportunity> toUpdate = new List<Opportunity>();

        for (Opportunity opp : opps) {
            try {
                String clientName = String.isNotBlank(opp.Client_Name_Formula__c)
                    ? opp.Client_Name_Formula__c : opp.Account.Name;

                String description = 'Client: ' + (clientName != null ? clientName : '—');
                if (String.isNotBlank(opp.Event_Type__c)) description += '\nEvent Type: ' + opp.Event_Type__c;
                if (String.isNotBlank(opp.StageName))     description += '\nStatus: '     + opp.StageName;

                if (String.isNotBlank(opp.Calendar_Event_Id__c)) {
                    GoogleCalendarService.updateEvent(
                        opp.Calendar_Event_Id__c, opp.Name, description, opp.CloseDate
                    );
                } else {
                    String eventId = GoogleCalendarService.createEvent(opp.Name, description, opp.CloseDate);
                    toUpdate.add(new Opportunity(Id = opp.Id, Calendar_Event_Id__c = eventId));
                }

            } catch (Exception e) {
                System.debug('CalendarSyncQueueable: failed for ' + opp.Id + ' — ' + e.getMessage());
            }
        }

        if (!toUpdate.isEmpty()) update toUpdate;
    }
}
