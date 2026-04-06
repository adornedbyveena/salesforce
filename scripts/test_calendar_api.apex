HttpRequest req = new HttpRequest();
req.setEndpoint('callout:Google_APIs/calendar/v3/calendars/primary/events');
req.setMethod('POST');
req.setHeader('Content-Type', 'application/json');
req.setBody('{"summary":"ABV Test","start":{"date":"2026-06-01"},"end":{"date":"2026-06-02"}}');

HttpResponse res = new Http().send(req);
System.debug('Status: ' + res.getStatusCode());
Map<String,Object> parsed = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
Map<String,Object> error = (Map<String,Object>) parsed.get('error');
if (error != null) {
    System.debug('Error message: ' + error.get('message'));
    System.debug('Error status:  ' + error.get('status'));
    List<Object> details = (List<Object>) error.get('details');
    if (details != null) {
        for (Object d : details) System.debug('Detail: ' + d);
    }
}
