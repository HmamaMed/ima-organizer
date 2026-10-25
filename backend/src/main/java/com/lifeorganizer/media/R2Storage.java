package com.lifeorganizer.media;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import java.io.InputStream;
import java.io.IOException;
import java.nio.file.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Private R2 bucket. Credentials never leave the backend. */
@Service
public class R2Storage {
    private static final Logger log = LoggerFactory.getLogger(R2Storage.class);
    private final R2Properties properties;
    private S3Client client;
    private S3Presigner presigner;
    public R2Storage(R2Properties properties) { this.properties = properties; }
    private synchronized void initialize() {
        if (client != null) return;
        if (!properties.configured()) throw new MediaStorageException("Media storage is not configured yet.");
        var credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(properties.accessKeyId(), properties.secretAccessKey()));
        var configuration = S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build();
        client = S3Client.builder().overrideConfiguration(c -> c.apiCallTimeout(Duration.ofMinutes(2)).apiCallAttemptTimeout(Duration.ofSeconds(30))).endpointOverride(URI.create(properties.endpoint())).region(Region.of("auto"))
                .credentialsProvider(credentials).serviceConfiguration(configuration)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED).build();
        presigner = S3Presigner.builder().endpointOverride(URI.create(properties.endpoint())).region(Region.of("auto"))
                .credentialsProvider(credentials).serviceConfiguration(configuration).build();
    }
    public void upload(String key, InputStream input, long size, String type) {
        initialize();
        Path temporary = null;
        try {
            // Multipart streams are not rewindable. A private temp file gives the SDK
            // a repeatable body for signing/retries without buffering 25 MB in heap.
            temporary = Files.createTempFile("lo-media-", ".upload");
            long copied = Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
            if (copied != size) throw new MediaStorageException("The file could not be read completely. Please try again.");
            client.putObject(PutObjectRequest.builder().bucket(properties.bucket()).key(key).contentType(type)
                    .cacheControl("private, no-store").build(), RequestBody.fromFile(temporary));
            if (client.headObject(HeadObjectRequest.builder().bucket(properties.bucket()).key(key).build()).contentLength() != size)
                throw new MediaStorageException("The uploaded file could not be verified.");
        } catch (MediaStorageException e) { throw e; }
        catch (IOException e) { throw new MediaStorageException("Could not prepare this file for upload. Please try again.", e); }
        catch (RuntimeException e) {
            log.warn("R2 upload failed for {}", key, e);
            throw new MediaStorageException("Could not store this file. Please try again.", e);
        }
        finally {
            if (temporary != null) {
                try { Files.deleteIfExists(temporary); }
                catch (IOException e) { log.warn("Could not remove a temporary media upload file", e); }
            }
        }
    }
    public String readUrl(String key, Instant categoryExpiry, Instant now) {
        initialize();
        long seconds = categoryExpiry == null ? 900 : Math.min(900, Duration.between(now, categoryExpiry).getSeconds());
        if (seconds <= 0) throw new NoSuchElementException("This memory category has expired");
        return presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(Duration.ofSeconds(seconds))
                .getObjectRequest(GetObjectRequest.builder().bucket(properties.bucket()).key(key)
                    .responseCacheControl("private, no-store, max-age=0").build()).build()).url().toString();
    }
    public void deleteObject(String key) {
        initialize();
        client.deleteObject(DeleteObjectRequest.builder().bucket(properties.bucket()).key(key).build());
    }
    /** Read-only metadata check for existing uploads during the personal-data upgrade. */
    public long objectSize(String key) {
        initialize();
        return client.headObject(HeadObjectRequest.builder().bucket(properties.bucket()).key(key).build()).contentLength();
    }
    public static String groupPrefix(UUID groupId) { return "memories/" + groupId + "/"; }
    public void deleteGroup(UUID groupId) {
        initialize();
        // List the whole exact category prefix, including interrupted/uncommitted uploads.
        while (true) {
            var objects = client.listObjectsV2(ListObjectsV2Request.builder().bucket(properties.bucket()).prefix(groupPrefix(groupId)).build()).contents();
            if (objects.isEmpty()) return;
            var result = client.deleteObjects(DeleteObjectsRequest.builder().bucket(properties.bucket())
                .delete(Delete.builder().objects(objects.stream().map(o -> ObjectIdentifier.builder().key(o.key()).build()).toList()).build()).build());
            if (!result.errors().isEmpty()) throw new MediaStorageException("Some memory files could not be deleted yet.");
        }
    }
    public List<S3Object> listGroup(UUID groupId) {
        initialize();
        List<S3Object> result = new ArrayList<>();
        for (var page : client.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(properties.bucket()).prefix(groupPrefix(groupId)).build())) result.addAll(page.contents());
        return result;
    }
    @PreDestroy public synchronized void close() {
        if (presigner != null) presigner.close();
        if (client != null) client.close();
    }
}
