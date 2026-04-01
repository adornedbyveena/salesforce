@isTest
public class ABVMockHttpCallout implements HttpCalloutMock {

    private List<HttpResponse> responses = new List<HttpResponse>();
    private Integer callIndex = 0;

    public ABVMockHttpCallout add(Integer statusCode, String body) {
        HttpResponse r = new HttpResponse();
        r.setStatusCode(statusCode);
        r.setBody(body);
        responses.add(r);
        return this;
    }

    public HttpResponse respond(HttpRequest req) {
        if (callIndex < responses.size()) {
            return responses[callIndex++];
        }
        // Repeat last response for any additional calls
        if (!responses.isEmpty()) return responses[responses.size() - 1];
        HttpResponse r = new HttpResponse();
        r.setStatusCode(200);
        r.setBody('{}');
        return r;
    }

    // Convenience: single 200 response
    public static ABVMockHttpCallout ok(String body) {
        return new ABVMockHttpCallout().add(200, body);
    }

    // Convenience: Drive upload sequence (folder found, folder found, create file, upload)
    public static ABVMockHttpCallout driveUpload() {
        return new ABVMockHttpCallout()
            .add(200, '{"files":[{"id":"rootFolderId"}]}')   // search ABV root
            .add(200, '{"files":[{"id":"eventFolderId"}]}')  // search event folder
            .add(200, '{"id":"fileId"}')                     // create file metadata
            .add(200, '{"id":"fileId"}');                    // upload PDF
    }

    // Convenience: Drive + Gmail sequence (4 Drive + 1 Gmail)
    public static ABVMockHttpCallout driveAndGmail() {
        return driveUpload().add(200, '{"id":"msgId"}');
    }
}
