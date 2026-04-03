// Dynamic SOQL bypasses compile-time schema cache lag for new fields
String q = 'SELECT Id FROM Opportunity'
         + ' WHERE Calendar_Event_Id__c = null'
         + ' AND CloseDate != null'
         + ' AND IsDeleted = false';

List<SObject> opps = Database.query(q);
System.debug('Opportunities to sync: ' + opps.size());

if (!opps.isEmpty()) {
    List<Id> ids = new List<Id>();
    for (SObject o : opps) ids.add((Id) o.get('Id'));
    System.enqueueJob(new CalendarSyncQueueable(ids));
    System.debug('CalendarSyncQueueable enqueued for ' + ids.size() + ' opportunities.');
} else {
    System.debug('No opportunities to sync.');
}
