// Find the permission set
PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'ABV_Calendar_Access' LIMIT 1];

// Assign to active users with full Salesforce or Admin licenses only
List<User> users = [
    SELECT Id FROM User
    WHERE IsActive = true
    AND Profile.UserLicense.Name IN ('Salesforce', 'Salesforce Platform', 'System Administrator')
];
List<PermissionSetAssignment> toInsert = new List<PermissionSetAssignment>();

// Get already-assigned users to avoid duplicates
Set<Id> alreadyAssigned = new Set<Id>();
for (PermissionSetAssignment psa : [SELECT AssigneeId FROM PermissionSetAssignment WHERE PermissionSetId = :ps.Id]) {
    alreadyAssigned.add(psa.AssigneeId);
}

for (User u : users) {
    if (!alreadyAssigned.contains(u.Id)) {
        toInsert.add(new PermissionSetAssignment(PermissionSetId = ps.Id, AssigneeId = u.Id));
    }
}

if (!toInsert.isEmpty()) {
    insert toInsert;
    System.debug('Assigned ABV_Calendar_Access to ' + toInsert.size() + ' users.');
} else {
    System.debug('All active users already have the permission set.');
}
