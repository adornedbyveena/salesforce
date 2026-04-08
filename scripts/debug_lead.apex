// Check Web-to-Lead is enabled and get the org ID needed for the form
Organization org = [SELECT Id, Name, IsSandbox FROM Organization LIMIT 1];
System.debug('Org ID: ' + org.Id);
System.debug('Org Name: ' + org.Name);
System.debug('Is Sandbox: ' + org.IsSandbox);

// Check Lead fields available (to confirm web-to-lead custom fields)
Map<String, Schema.SObjectField> leadFields = Schema.SObjectType.Lead.fields.getMap();
List<String> customLeadFields = new List<String>();
for (String f : leadFields.keySet()) {
    if (f.endsWith('__c')) customLeadFields.add(f);
}
customLeadFields.sort();
System.debug('Custom Lead fields: ' + customLeadFields);
