trigger OpportunityTrigger on Opportunity (after insert) {
    List<Id> newInquiryIds = new List<Id>();
    for (Opportunity opp : Trigger.new) {
        if (opp.StageName == 'New Inquiry' && opp.LeadSource == 'Web') {
            newInquiryIds.add(opp.Id);
        }
    }
    if (!newInquiryIds.isEmpty()) {
        System.enqueueJob(new LeadNotificationQueueable(newInquiryIds));
    }
}
