@isTest
private class VenueSearchControllerTest {

    static final String AUTOCOMPLETE_RESP = '{"predictions":['
        + '{"place_id":"place1","description":"The Grand Hall, Houston, TX, USA",'
        + '"structured_formatting":{"main_text":"The Grand Hall","secondary_text":"Houston, TX, USA"}}'
        + '],"status":"OK"}';

    static final String DETAILS_RESP = '{"result":{'
        + '"name":"The Grand Hall",'
        + '"formatted_address":"123 Main St, Houston, TX 77001",'
        + '"address_components":['
        + '{"long_name":"123","short_name":"123","types":["street_number"]},'
        + '{"long_name":"Main Street","short_name":"Main St","types":["route"]},'
        + '{"long_name":"Houston","short_name":"Houston","types":["locality"]},'
        + '{"long_name":"Texas","short_name":"TX","types":["administrative_area_level_1"]},'
        + '{"long_name":"77001","short_name":"77001","types":["postal_code"]},'
        + '{"long_name":"United States","short_name":"US","types":["country"]}'
        + '],'
        + '"geometry":{"location":{"lat":29.7604,"lng":-95.3698}},'
        + '"rating":4.5,'
        + '"types":["event_venue"]'
        + '},"status":"OK"}';

    static final String DISTANCE_RESP = '{"rows":[{"elements":[{"status":"OK",'
        + '"distance":{"text":"5.4 mi"},'
        + '"duration":{"text":"12 mins"}'
        + '}]}],"status":"OK"}';

    // ── searchVenues ──────────────────────────────────────────────────────────

    @isTest
    static void searchVenues_returnsResults() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(AUTOCOMPLETE_RESP));
        Test.startTest();
        List<Map<String,String>> results = VenueSearchController.searchVenues('Grand Hall');
        Test.stopTest();
        System.assertEquals(1, results.size(), 'Should return 1 prediction');
        System.assertEquals('place1', results[0].get('placeId'));
        System.assertEquals('The Grand Hall', results[0].get('mainText'));
    }

    @isTest
    static void searchVenues_blankInput_returnsEmpty() {
        Test.startTest();
        List<Map<String,String>> results = VenueSearchController.searchVenues('');
        Test.stopTest();
        System.assertEquals(0, results.size(), 'Blank input should return empty list');
    }

    @isTest
    static void searchVenues_nonOkStatus_returnsEmpty() {
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout().add(500, ''));
        Test.startTest();
        List<Map<String,String>> results = VenueSearchController.searchVenues('Test');
        Test.stopTest();
        System.assertEquals(0, results.size(), 'Non-200 should return empty list');
    }

    // ── getVenueDetails ───────────────────────────────────────────────────────

    @isTest
    static void getVenueDetails_returnsDetails() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(DETAILS_RESP));
        Test.startTest();
        Map<String,Object> details = VenueSearchController.getVenueDetails('place1');
        Test.stopTest();
        System.assertNotEquals(null, details, 'Should return venue details');
        System.assertEquals('The Grand Hall', details.get('name'));
        System.assertEquals('123 Main Street', details.get('street'));
        System.assertEquals('Houston', details.get('city'));
        System.assertEquals('TX', details.get('state'));
        System.assertEquals('77001', details.get('postalCode'));
        System.assertEquals(29.7604, details.get('lat'));
    }

    @isTest
    static void getVenueDetails_blankPlaceId_returnsNull() {
        Test.startTest();
        Map<String,Object> details = VenueSearchController.getVenueDetails('');
        Test.stopTest();
        System.assertEquals(null, details, 'Blank placeId should return null');
    }

    @isTest
    static void getVenueDetails_nonOkStatus_returnsNull() {
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout().add(404, ''));
        Test.startTest();
        Map<String,Object> details = VenueSearchController.getVenueDetails('place1');
        Test.stopTest();
        System.assertEquals(null, details, 'Non-200 should return null');
    }

    // ── getDistanceToVenue ────────────────────────────────────────────────────

    @isTest
    static void getDistanceToVenue_returnsDistance() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(DISTANCE_RESP));
        Test.startTest();
        String dist = VenueSearchController.getDistanceToVenue('29.7604', '-95.3698');
        Test.stopTest();
        System.assert(dist != null && dist.contains('mi'), 'Should return distance string');
    }

    @isTest
    static void getDistanceToVenue_blankParams_returnsNull() {
        Test.startTest();
        String dist = VenueSearchController.getDistanceToVenue('', '');
        Test.stopTest();
        System.assertEquals(null, dist, 'Blank params should return null');
    }

    @isTest
    static void getDistanceToVenue_nonOkElementStatus_returnsNull() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(
            '{"rows":[{"elements":[{"status":"ZERO_RESULTS"}]}]}'
        ));
        Test.startTest();
        String dist = VenueSearchController.getDistanceToVenue('29.7604', '-95.3698');
        Test.stopTest();
        System.assertEquals(null, dist, 'Non-OK element status should return null');
    }

    // ── saveVenueAddress ──────────────────────────────────────────────────────

    @isTest
    static void saveVenueAddress_updatesOpportunity() {
        Account acc = new Account(Name = 'Test Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name = 'Test Event', StageName = 'New Inquiry',
            CloseDate = Date.today().addDays(30), AccountId = acc.Id
        );
        insert opp;

        Test.startTest();
        VenueSearchController.saveVenueAddress(
            opp.Id, '123 Main St', 'Houston', 'TX', '77001', 'United States', 'place1'
        );
        Test.stopTest();

        Opportunity updated = [SELECT Venue__Street__s, Venue__City__s, Venue__StateCode__s,
                                      Venue__PostalCode__s, Venue__CountryCode__s, Venue_Place_Id__c
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('123 Main St', updated.Venue__Street__s);
        System.assertEquals('Houston',     updated.Venue__City__s);
        System.assertEquals('TX',          updated.Venue__StateCode__s);
        System.assertEquals('77001',       updated.Venue__PostalCode__s);
        System.assertEquals('US',          updated.Venue__CountryCode__s);
        System.assertEquals('place1',      updated.Venue_Place_Id__c);
    }

    // ── clearVenue ────────────────────────────────────────────────────────────

    @isTest
    static void clearVenue_clearsFields() {
        Account acc = new Account(Name = 'Test Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name = 'Test Event', StageName = 'New Inquiry',
            CloseDate = Date.today().addDays(30), AccountId = acc.Id,
            Venue__Street__s = '123 Main St', Venue__City__s = 'Houston',
            Venue__StateCode__s = 'TX', Venue_Place_Id__c = 'place1'
        );
        insert opp;

        Test.startTest();
        VenueSearchController.clearVenue(opp.Id);
        Test.stopTest();

        Opportunity updated = [SELECT Venue__Street__s, Venue__City__s, Venue_Place_Id__c
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals(null, updated.Venue__Street__s, 'Street should be cleared');
        System.assertEquals(null, updated.Venue__City__s,   'City should be cleared');
        System.assertEquals(null, updated.Venue_Place_Id__c,'PlaceId should be cleared');
    }
}
