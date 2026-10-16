package com.lifeorganizer.media;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import software.amazon.awssdk.services.s3.model.S3Object;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static org.assertj.core.api.Assertions.*;

/** Real SDK/HTTP interactions against a local storage stand-in, never an external account. */
class StorageAdaptersTests {
    HttpServer server;
    Map<String, byte[]> objects;
    List<String> deleted;
    String endpoint;
    boolean failDeletion;
    @BeforeEach void start() throws Exception {
        objects=new ConcurrentHashMap<>(); deleted=Collections.synchronizedList(new ArrayList<>());
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        endpoint="http://127.0.0.1:"+server.getAddress().getPort();
        server.createContext("/", exchange -> {
            String path=exchange.getRequestURI().getPath(), query=exchange.getRequestURI().getRawQuery(), method=exchange.getRequestMethod();
            int status=200; byte[] response=new byte[0];
            if (path.startsWith("/storage/v1/object/info/media/")) {
                String key=path.substring("/storage/v1/object/info/media/".length());
                if (objects.containsKey(key)) response="{}".getBytes();
                else { status=400; response="{ \"statusCode\" : \"404\", \"error\": \"Not Found\" }".getBytes(); }
                exchange.getResponseHeaders().set("Content-Type","application/json");
            } else if (path.equals("/storage/v1/object/media") && method.equals("DELETE")) {
                if (failDeletion) status=403;
                else { String body=new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8); String key=body.split("\\\"")[3]; objects.remove(key); deleted.add(key); response="[]".getBytes(); }
            } else if (path.startsWith("/bucket/")) {
                String key=path.substring("/bucket/".length());
                if (method.equals("PUT")) { objects.put(key,exchange.getRequestBody().readAllBytes()); exchange.getResponseHeaders().set("ETag","\"test-etag\""); }
                else if (method.equals("HEAD")) {
                    if (!objects.containsKey(key)) status=404;
                    else exchange.getResponseHeaders().set("Content-Length",String.valueOf(objects.get(key).length));
                } else if (method.equals("GET")) { if (objects.containsKey(key)) response=objects.get(key); else status=404; }
                else if (method.equals("DELETE")) { objects.remove(key); deleted.add(key); }
            } else if (path.equals("/bucket") || path.equals("/bucket/")) {
                if (method.equals("GET")) {
                    String prefix=Arrays.stream(query.split("&")).filter(v -> v.startsWith("prefix=")).findFirst().map(v -> URLDecoder.decode(v.substring(7),StandardCharsets.UTF_8)).orElse("");
                    var keys=objects.keySet().stream().filter(k -> k.startsWith(prefix)).sorted().toList();
                    StringBuilder xml=new StringBuilder("<ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Name>bucket</Name><IsTruncated>false</IsTruncated><KeyCount>"+keys.size()+"</KeyCount>");
                    for (String key:keys) xml.append("<Contents><Key>").append(key).append("</Key><LastModified>2026-01-01T00:00:00Z</LastModified><Size>3</Size></Contents>");
                    response=xml.append("</ListBucketResult>").toString().getBytes();
                } else if (method.equals("POST") && query.startsWith("delete")) {
                    String input=new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);
                    var matcher=java.util.regex.Pattern.compile("<Key>(.*?)</Key>").matcher(input);
                    StringBuilder xml=new StringBuilder("<DeleteResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\">");
                    while (matcher.find()) {
                        String key=matcher.group(1);
                        if (failDeletion) xml.append("<Error><Key>").append(key).append("</Key><Code>AccessDenied</Code><Message>No</Message></Error>");
                        else { objects.remove(key); deleted.add(key); xml.append("<Deleted><Key>").append(key).append("</Key></Deleted>"); }
                    }
                    response=xml.append("</DeleteResult>").toString().getBytes();
                }
                exchange.getResponseHeaders().set("Content-Type","application/xml");
            } else status=404;
            if (method.equals("HEAD")) exchange.sendResponseHeaders(status,-1);
            else { exchange.sendResponseHeaders(status,response.length); exchange.getResponseBody().write(response); }
            exchange.close();
        });
        server.start();
    }
    @AfterEach void stop() { server.stop(0); }
    R2Storage r2() { return new R2Storage(new R2Properties(endpoint,"bucket","test-key","test-secret")); }
    @Test void realS3UploadVerificationPrivateReadSigningAndPrefixDeletion() throws Exception {
        UUID group=UUID.randomUUID(), other=UUID.randomUUID();
        String key=R2Storage.groupPrefix(group)+"photo.jpg", otherKey=R2Storage.groupPrefix(other)+"keep.jpg";
        objects.put(otherKey,new byte[]{9});
        try (var ignored=new CloseableStorage(r2())) {
            R2Storage storage=ignored.storage;
            InputStream notRewindable = new FilterInputStream(new ByteArrayInputStream(new byte[]{1,2,3})) {
                @Override public boolean markSupported() { return false; }
                @Override public void reset() throws IOException { throw new IOException("Multipart streams cannot rewind"); }
            };
            storage.upload(key,notRewindable,3,"image/jpeg");
            assertThat(objects.get(key)).containsExactly(1,2,3);
            Instant now=Instant.now();
            String signed=storage.readUrl(key,now.plusSeconds(60),now);
            assertThat(signed).contains("X-Amz-Algorithm=AWS4-HMAC-SHA256","X-Amz-Expires=60").doesNotContain("test-secret");
            assertThat(HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(signed)).GET().build(),HttpResponse.BodyHandlers.ofByteArray()).body()).containsExactly(1,2,3);
            assertThatThrownBy(() -> storage.readUrl(key,now.minusSeconds(1),now)).isInstanceOf(NoSuchElementException.class);
            storage.deleteGroup(group); assertThat(objects).containsOnlyKeys(otherKey); assertThat(deleted).containsExactly(key);
            storage.deleteGroup(group); // idempotent
        }
    }
    @Test void partialR2DeletionFailureIsReportedForRetry() {
        UUID group=UUID.randomUUID(); String key=R2Storage.groupPrefix(group)+"photo.jpg"; objects.put(key,new byte[]{1}); failDeletion=true;
        try (var ignored=new CloseableStorage(r2())) { assertThatThrownBy(() -> ignored.storage.deleteGroup(group)).isInstanceOf(MediaStorageException.class); }
        assertThat(objects).containsKey(key);
    }
    @Test void missingR2ConfigurationFailsWithoutCallingAnyStorage() {
        R2Storage storage=new R2Storage(new R2Properties("","","",""));
        assertThatThrownBy(() -> storage.upload("no",new ByteArrayInputStream(new byte[]{1}),1,"image/jpeg")).isInstanceOf(MediaStorageException.class);
        assertThat(objects).isEmpty();
    }
    @Test void legacyDeletionUsesStorageApiAndVerifiesAbsenceIncludingSupabase400NotFound() {
        String key="memories/old.jpg", url=endpoint+"/storage/v1/object/public/media/"+key; objects.put(key,new byte[]{1});
        LegacySupabaseStorage storage=new LegacySupabaseStorage(endpoint,"local-service-key");
        storage.delete(url); storage.delete(url);
        assertThat(objects).isEmpty(); assertThat(deleted).containsExactly(key);
    }
    @Test void legacyFailureKeepsObjectAndNeverSendsSecretsToAnotherOriginOrBucket() {
        String key="memories/old.jpg"; objects.put(key,new byte[]{1}); failDeletion=true;
        LegacySupabaseStorage storage=new LegacySupabaseStorage(endpoint,"local-service-key");
        for (String url:List.of("https://attacker.test/storage/v1/object/public/media/"+key,endpoint+"/storage/v1/object/public/other/"+key,endpoint+"/storage/v1/object/public/media/memories/../other.jpg"))
            assertThatThrownBy(() -> storage.delete(url)).isInstanceOf(MediaStorageException.class);
        assertThatThrownBy(() -> storage.delete(endpoint+"/storage/v1/object/public/media/"+key)).isInstanceOf(MediaStorageException.class);
        assertThat(objects).containsKey(key); assertThat(deleted).isEmpty();
    }
    record CloseableStorage(R2Storage storage) implements AutoCloseable { public void close() { storage.close(); } }
}
