package com.lifeorganizer.birthdays;

import java.time.*;

/** IANA africa: Morocco returned to GMT on 2026-09-20, 01:00Z.
 * Account for older JDK tzdb releases still projecting GMT+1 after this change.
 */
public final class MoroccoTime {
    private static final Instant GMT_START = Instant.parse("2026-09-20T01:00:00Z");
    private MoroccoTime() {}
    public static ZoneId zone(String timeZone, Instant now) {
        if ((timeZone.equals("Africa/Casablanca") || timeZone.equals("Africa/El_Aaiun")) && !now.isBefore(GMT_START)) {
            return ZoneOffset.UTC;
        }
        return ZoneId.of(timeZone);
    }
}
