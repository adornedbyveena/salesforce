trigger OpportunityTrigger on Opportunity (after insert, after update) {

    // ── Lead notification emails (insert only, Web + New Inquiry) ────────────
    if (Trigger.isInsert) {
        List<Id> newInquiryIds = new List<Id>();
        for (Opportunity opp : Trigger.new) {
            if (opp.StageName == 'New Inquiry' && opp.LeadSource == 'Web') {
                newInquiryIds.add(opp.Id);
            }
        }
        if (!newInquiryIds.isEmpty()) {
            System.enqueueJob(new LeadNotificationQueueable(newInquiryIds));
        }

        // Create Google Calendar event for all new opportunities
        System.enqueueJob(new CalendarSyncQueueable(new List<Id>(Trigger.newMap.keySet())));
    }

    // ── Calendar sync on update (date, name, stage, or event type changed) ──
    if (Trigger.isUpdate) {
        List<Id> changedIds = new List<Id>();
        for (Opportunity opp : Trigger.new) {
            Opportunity old = Trigger.oldMap.get(opp.Id);
            if (opp.CloseDate    != old.CloseDate
             || opp.Name         != old.Name
             || opp.StageName    != old.StageName
             || opp.Event_Type__c != old.Event_Type__c) {
                changedIds.add(opp.Id);
            }
        }
        if (!changedIds.isEmpty()) {
            System.enqueueJob(new CalendarSyncQueueable(changedIds));
        }
    }
}
