# Birthday Reminders

Private annual birthday lists for each authenticated account, with owner-scoped CRUD and server-side FCM reminders 3 days and 1 day beforehand at 19:00 Moroccan GMT. No browser-only storage substitute is used.

The backend must be deployed before the new UI can load/save against a hosted server. The existing Hibernate update configuration adds `birthday_reminders`, `birthday_deliveries`, and `birthday_notifications`. The worker checks every five minutes; Firebase configuration and a permitted, registered native device are required for push delivery.

Profile → Notifications now provides a private birthday inbox, including when push delivery is unavailable. Deleting an inbox message preserves the birthday and future reminders. Its occurrence marker prevents it from reappearing on worker retries. New push taps open `/notifications`; older `/birthdays` links remain supported. See [inbox validation](../../../../design-validation/notification-inbox/README.md).

[Implementation, screenshots, verification and limitations](../../../../design-validation/birthday-reminders/README.md).
