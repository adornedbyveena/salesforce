public with sharing class DriveFolderController {

    private static final String NC = 'callout:Google_APIs';
    private static final String REAUTH_MSG =
        'Google Drive authentication has expired. ' +
        'To fix: Setup → Security → Named Credentials → External Credentials → ' +
        'Google_OAuth → Named Principals → ABV_Google → Authenticate.';

    @AuraEnabled(cacheable=false)
    public static List<Map<String,String>> getFilesInFolder(String folderUrl) {
        if (String.isBlank(folderUrl)) return new List<Map<String,String>>();

        String folderId = folderUrl.substringAfterLast('/');
        String q = '\'' + folderId + '\' in parents and trashed=false';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(NC + '/drive/v3/files'
            + '?q='      + EncodingUtil.urlEncode(q, 'UTF-8')
            + '&fields=' + EncodingUtil.urlEncode('files(id,name,mimeType,webViewLink,modifiedTime)', 'UTF-8')
            + '&orderBy=modifiedTime+desc');
        req.setMethod('GET');
        HttpResponse res = new Http().send(req);

        if (res.getStatusCode() == 401) throw new AuraHandledException(REAUTH_MSG);
        if (res.getStatusCode() != 200) throw new AuraHandledException('Could not load Drive files (' + res.getStatusCode() + ').');

        Map<String,Object> body  = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        List<Object>       files = (List<Object>) body.get('files');
        if (files == null) return new List<Map<String,String>>();

        List<Map<String,String>> result = new List<Map<String,String>>();
        for (Object f : files) {
            Map<String,Object> file = (Map<String,Object>) f;
            result.add(new Map<String,String>{
                'id'          => (String) file.get('id'),
                'name'        => (String) file.get('name'),
                'mimeType'    => (String) file.get('mimeType'),
                'webViewLink' => (String) file.get('webViewLink'),
                'modified'    => (String) file.get('modifiedTime')
            });
        }
        return result;
    }
}
