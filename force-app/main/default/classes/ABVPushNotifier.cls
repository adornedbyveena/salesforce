public class ABVPushNotifier {

    private static final String NOTIF_TYPE = 'ABV_Internal';
    private static final String VEENA_EMAIL = 'veena@adornedbyveena.com';

    public static void notifyVeena(String title, String body, Id targetId) {
        try {
            List<CustomNotificationType> types = [
                SELECT Id FROM CustomNotificationType
                WHERE DeveloperName = :NOTIF_TYPE LIMIT 1
            ];
            if (types.isEmpty()) return;

            List<User> users = [
                SELECT Id FROM User
                WHERE Email = :VEENA_EMAIL AND IsActive = true LIMIT 1
            ];
            if (users.isEmpty()) return;

            Messaging.CustomNotification notif = new Messaging.CustomNotification();
            notif.setNotificationTypeId(types[0].Id);
            notif.setTargetId(targetId);
            notif.setTitle(title);
            notif.setBody(body);
            notif.send(new Set<String>{ users[0].Id });
        } catch (Exception e) {
            System.debug('ABVPushNotifier: push failed — ' + e.getMessage());
        }
    }
}
