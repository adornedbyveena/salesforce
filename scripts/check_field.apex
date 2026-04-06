// Check FLS for the field
Schema.DescribeFieldResult dfr = Schema.SObjectType.Opportunity.fields.getMap()
    .get('calendar_event_id__c')
    ?.getDescribe();

if (dfr == null) {
    System.debug('Field not visible in describe at all — FLS hidden');
} else {
    System.debug('isAccessible: ' + dfr.isAccessible());
    System.debug('isUpdateable: ' + dfr.isUpdateable());
    System.debug('Label: ' + dfr.getLabel());
}
