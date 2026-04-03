// Check job status and verify Calendar Event IDs were written back
List<AsyncApexJob> jobs = [
    SELECT Id, Status, NumberOfErrors, JobItemsProcessed, ExtendedStatus
    FROM AsyncApexJob
    WHERE ApexClass.Name = 'CalendarSyncQueueable'
    ORDER BY CreatedDate DESC
    LIMIT 3
];
for (AsyncApexJob j : jobs) {
    System.debug('Job: ' + j.Status + ' | Errors: ' + j.NumberOfErrors + ' | ' + j.ExtendedStatus);
}

// Check how many opps now have a Calendar Event ID
Integer synced = [SELECT COUNT() FROM Opportunity WHERE Calendar_Event_Id__c != null];
Integer total  = [SELECT COUNT() FROM Opportunity WHERE CloseDate != null];
System.debug('Synced: ' + synced + ' / ' + total + ' opportunities');
