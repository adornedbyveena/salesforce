trigger ContractActionEventTrigger on Contract_Action__e (after insert) {
    List<Opportunity> toUpdate = new List<Opportunity>();

    for (Contract_Action__e evt : Trigger.new) {
        List<Opportunity> opps = [
            SELECT Id, Contract_Status__c
            FROM Opportunity
            WHERE Contract_Token__c = :evt.Token__c
            LIMIT 1
        ];
        if (opps.isEmpty()) continue;

        Opportunity opp = opps[0];
        if (evt.Action__c == 'Accept') {
            opp.Contract_Status__c        = 'Signed';
            opp.Contract_Signed_Date_Time__c = DateTime.now();
            opp.StageName                 = 'Contract Signed';
        } else if (evt.Action__c == 'Decline') {
            opp.Contract_Status__c = 'Declined';
        }
        toUpdate.add(opp);
    }

    if (!toUpdate.isEmpty()) update toUpdate;
}