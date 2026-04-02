public class GoogleCalendarService {

    static final String NC = 'callout:Google_APIs';

    static final String REAUTH_MSG =
        'Google Calendar authentication has expired. ' +
        'To fix: Setup → Security → Named Credentials → External Credentials → ' +
        'Google_OAuth → Named Principals → ABV_Google → Authenticate.';

    static void checkResponse(HttpResponse res, String context) {
        if (res.getStatusCode() == 401) {
            throw new AuraHandledException(REAUTH_MSG);
        }
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            throw new CalloutException('Google Calendar error (' + context + '): HTTP ' + res.getStatusCode());
        }
    }

    // Google Calendar all-day events use exclusive end date (day after event)
    static String toDateString(Date d) {
        return String.valueOf(d); // returns YYYY-MM-DD
    }

    static Map<String, Object> buildEventBody(String summary, String description, Date eventDate) {
        return new Map<String, Object>{
            'summary'     => summary,
            'description' => description,
            'start'       => new Map<String, String>{ 'date' => toDateString(eventDate) },
            'end'         => new Map<String, String>{ 'date' => toDateString(eventDate.addDays(1)) }
        };
    }

    // Creates a new calendar event, returns the Google Calendar event ID
    public static String createEvent(String summary, String description, Date eventDate) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(NC + '/calendar/v3/calendars/primary/events');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(buildEventBody(summary, description, eventDate)));

        HttpResponse res = new Http().send(req);
        checkResponse(res, 'create');

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) body.get('id');
    }

    // Updates an existing calendar event
    public static void updateEvent(String eventId, String summary, String description, Date eventDate) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(NC + '/calendar/v3/calendars/primary/events/' + eventId);
        req.setMethod('PATCH');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(buildEventBody(summary, description, eventDate)));

        HttpResponse res = new Http().send(req);
        checkResponse(res, 'update');
    }

    // Deletes a calendar event (ignores 404 — already deleted)
    public static void deleteEvent(String eventId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(NC + '/calendar/v3/calendars/primary/events/' + eventId);
        req.setMethod('DELETE');

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() == 401) throw new AuraHandledException(REAUTH_MSG);
        // 404 = already gone, treat as success
        if (res.getStatusCode() != 204 && res.getStatusCode() != 200 && res.getStatusCode() != 404) {
            throw new CalloutException('Google Calendar delete error: HTTP ' + res.getStatusCode());
        }
    }
}
