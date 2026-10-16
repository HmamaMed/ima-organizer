package com.lifeorganizer.media;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.media.r2")
public record R2Properties(String endpoint, String bucket, String accessKeyId, String secretAccessKey) {
    public boolean configured() {
        return endpoint != null && !endpoint.isBlank() && bucket != null && !bucket.isBlank()
            && accessKeyId != null && !accessKeyId.isBlank() && secretAccessKey != null && !secretAccessKey.isBlank();
    }
}
