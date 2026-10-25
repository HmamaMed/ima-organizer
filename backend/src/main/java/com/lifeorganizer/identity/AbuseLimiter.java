package com.lifeorganizer.identity;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.bind.annotation.ResponseStatus;

@Service
@Profile("couples")
public class AbuseLimiter {
    private final JdbcTemplate jdbc;
    public AbuseLimiter(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public static class LimitExceeded extends RuntimeException { public LimitExceeded() { super("Too many attempts. Try again later."); } }
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = LimitExceeded.class)
    public void check(String key, int limit, int seconds) {
        long bucket = java.time.Instant.now().getEpochSecond() / seconds;
        Integer count = jdbc.queryForObject("insert into abuse_limits (key_hash, bucket, hits) values (?, ?, 1) on conflict (key_hash, bucket) do update set hits = abuse_limits.hits + 1 returning hits", Integer.class, SecretTokens.hash(key), bucket);
        if (count != null && count > limit) throw new LimitExceeded();
    }
}
