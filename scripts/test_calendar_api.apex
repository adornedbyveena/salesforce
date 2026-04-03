// Test the Google Calendar API call directly to see any error
try {
    String eventId = GoogleCalendarService.createEvent(
        'Test ABV Event',
        'Testing calendar sync',
        Date.today().addDays(30)
    );
    System.debug('SUCCESS — event created: ' + eventId);
} catch (Exception e) {
    System.debug('ERROR type: ' + e.getTypeName());
    System.debug('ERROR msg:  ' + e.getMessage());
}
