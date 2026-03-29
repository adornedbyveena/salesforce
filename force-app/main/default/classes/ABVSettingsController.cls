public with sharing class ABVSettingsController {
    // Key is restricted to *.salesforce.com and *.force.com in Google Cloud Console
    private static final String MAPS_KEY = 'AIzaSyAOxiaHz5eFvX56W8dd3UMCxgte9fkJbNo';

    @AuraEnabled(cacheable=true)
    public static String getMapsApiKey() {
        return MAPS_KEY;
    }
}
