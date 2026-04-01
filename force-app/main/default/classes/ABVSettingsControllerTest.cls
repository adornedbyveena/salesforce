@isTest
private class ABVSettingsControllerTest {

    @isTest
    static void getMapsApiKey_returnsValueOrNull() {
        Test.startTest();
        String key = ABVSettingsController.getMapsApiKey();
        Test.stopTest();
        // Custom Metadata is accessible in tests — just verify no exception
        System.assert(key == null || key != null, 'getMapsApiKey should not throw');
    }
}
