public with sharing class VenueSearchController {

    private static final String KEY    = 'AIzaSyAOxiaHz5eFvX56W8dd3UMCxgte9fkJbNo';
    private static final String AC_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    private static final String DT_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

    // The API key has HTTP-referrer restrictions (*.salesforce.com, *.force.com).
    // Apex callouts don't send a Referer header automatically, so we set it explicitly.
    private static final String REFERER = URL.getOrgDomainUrl().toExternalForm();

    // ── Autocomplete: return up to 5 suggestions biased to Houston/Texas, US only ──
    @AuraEnabled(cacheable=false)
    public static List<Map<String,String>> searchVenues(String input) {
        if (String.isBlank(input)) return new List<Map<String,String>>();

        String url = AC_URL
            + '?input='      + EncodingUtil.urlEncode(input, 'UTF-8')
            + '&components=country:us'
            + '&location=29.7604,-95.3698'
            + '&radius=700000'
            + '&key=' + KEY;

        HttpRequest req = new HttpRequest();
        req.setEndpoint(url);
        req.setMethod('GET');
        req.setTimeout(10000);
        req.setHeader('Referer', REFERER);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) return new List<Map<String,String>>();

        Map<String,Object> body       = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        List<Object>       predictions = (List<Object>) body.get('predictions');
        if (predictions == null) return new List<Map<String,String>>();

        List<Map<String,String>> results = new List<Map<String,String>>();
        for (Object pred : predictions) {
            Map<String,Object> p  = (Map<String,Object>) pred;
            Map<String,Object> sf = (Map<String,Object>) p.get('structured_formatting');
            results.add(new Map<String,String>{
                'placeId'      => (String) p.get('place_id'),
                'description'  => (String) p.get('description'),
                'mainText'     => sf != null ? (String) sf.get('main_text')      : (String) p.get('description'),
                'secondaryText'=> sf != null ? (String) sf.get('secondary_text') : ''
            });
        }
        return results;
    }

    // ── Place details: address + photo URLs + name + rating ──
    @AuraEnabled(cacheable=false)
    public static Map<String,Object> getVenueDetails(String placeId) {
        if (String.isBlank(placeId)) return null;

        String url = DT_URL
            + '?place_id=' + EncodingUtil.urlEncode(placeId, 'UTF-8')
            + '&fields=name,formatted_address,address_components,geometry,rating,types'
            + '&key=' + KEY;

        HttpRequest req = new HttpRequest();
        req.setEndpoint(url);
        req.setMethod('GET');
        req.setTimeout(10000);
        req.setHeader('Referer', REFERER);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) return null;

        Map<String,Object> body   = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        Map<String,Object> result = (Map<String,Object>) body.get('result');
        if (result == null) return null;

        // Parse address components
        String streetNumber = '', route = '', city = '', state = '', postalCode = '', country = '';
        List<Object> comps = (List<Object>) result.get('address_components');
        if (comps != null) {
            for (Object c : comps) {
                Map<String,Object> comp  = (Map<String,Object>) c;
                List<Object>       types = (List<Object>) comp.get('types');
                String             lng   = (String) comp.get('long_name');
                String             sht   = (String) comp.get('short_name');
                if      (types.contains('street_number'))            streetNumber = lng;
                else if (types.contains('route'))                    route        = lng;
                else if (types.contains('locality'))                 city         = lng;
                else if (types.contains('sublocality_level_1') && city == '') city = lng;
                else if (types.contains('administrative_area_level_1')) state     = sht; // abbreviation
                else if (types.contains('postal_code'))              postalCode   = lng;
                else if (types.contains('country'))                  country      = lng;
            }
        }
        String street = (streetNumber + ' ' + route).trim();
        if (street == '') street = (String) result.get('formatted_address');

        // Extract lat/lng for Street View
        Double lat = null, lng = null;
        Map<String,Object> geometry = (Map<String,Object>) result.get('geometry');
        if (geometry != null) {
            Map<String,Object> location = (Map<String,Object>) geometry.get('location');
            if (location != null) {
                lat = (Double) location.get('lat');
                lng = (Double) location.get('lng');
            }
        }

        return new Map<String,Object>{
            'name'      => (String)  result.get('name'),
            'rating'    =>           result.get('rating'),
            'types'     =>           result.get('types'),
            'street'    => street,
            'city'      => city,
            'state'     => state,
            'postalCode'=> postalCode,
            'country'   => country,
            'lat'       => lat,
            'lng'       => lng
        };
    }

    // ── Distance from org address to venue (Distance Matrix API) ──
    @AuraEnabled(cacheable=false)
    public static String getDistanceToVenue(String venueLat, String venueLng) {
        if (String.isBlank(venueLat) || String.isBlank(venueLng)) return null;

        Organization org = [SELECT Street, City, State, PostalCode FROM Organization LIMIT 1];
        List<String> parts = new List<String>();
        if (String.isNotBlank(org.Street))     parts.add(org.Street);
        if (String.isNotBlank(org.City))       parts.add(org.City);
        if (String.isNotBlank(org.State))      parts.add(org.State);
        if (String.isNotBlank(org.PostalCode)) parts.add(org.PostalCode);
        if (parts.isEmpty()) return null;
        String origin = String.join(parts, ', ');

        String url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
            + '?origins='      + EncodingUtil.urlEncode(origin, 'UTF-8')
            + '&destinations=' + EncodingUtil.urlEncode(venueLat + ',' + venueLng, 'UTF-8')
            + '&units=imperial'
            + '&key='          + KEY;

        HttpRequest req = new HttpRequest();
        req.setEndpoint(url);
        req.setMethod('GET');
        req.setTimeout(10000);
        req.setHeader('Referer', REFERER);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) return null;

        Map<String,Object> body     = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        List<Object>       rows     = (List<Object>) body.get('rows');
        if (rows == null || rows.isEmpty()) return null;

        List<Object> elements = (List<Object>) ((Map<String,Object>) rows.get(0)).get('elements');
        if (elements == null || elements.isEmpty()) return null;

        Map<String,Object> el = (Map<String,Object>) elements.get(0);
        if ('OK' != (String) el.get('status')) return null;

        String distText = (String) ((Map<String,Object>) el.get('distance')).get('text');
        String durText  = (String) ((Map<String,Object>) el.get('duration')).get('text');
        return distText + ' · ' + durText + ' drive';
    }

    // ── Clear venue from Opportunity ──
    @AuraEnabled
    public static void clearVenue(Id opportunityId) {
        Opportunity opp = new Opportunity(Id = opportunityId);
        opp.Venue__Street__s      = null;
        opp.Venue__City__s        = null;
        opp.Venue__StateCode__s   = null;
        opp.Venue__PostalCode__s  = null;
        opp.Venue__CountryCode__s = null;
        opp.Venue_Place_Id__c     = null;
        update opp;
    }

    // ── Save venue address + place ID to Opportunity ──
    @AuraEnabled
    public static void saveVenueAddress(
            Id     opportunityId,
            String street,
            String city,
            String state,
            String postalCode,
            String country,
            String placeId) {

        Opportunity opp = new Opportunity(Id = opportunityId);
        opp.Venue__Street__s      = street;
        opp.Venue__City__s        = city;
        opp.Venue__StateCode__s   = state;    // state abbreviation (TX, CA …)
        opp.Venue__PostalCode__s  = postalCode;
        opp.Venue__CountryCode__s = 'US';     // restricted to US
        opp.Venue_Place_Id__c     = placeId;
        update opp;
    }
}
