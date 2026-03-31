public with sharing class ABVSettingsController {

    @AuraEnabled(cacheable=true)
    public static String getMapsApiKey() {
        ABV_Settings__mdt setting = ABV_Settings__mdt.getInstance('Google_Maps_API_Key');
        return setting != null ? setting.Value__c : null;
    }
}
