package com.lifeorganizer.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/** Only deletes old files from the explicitly configured project and memories/ prefix. */
@Service
public class LegacySupabaseStorage {
    private final String origin;
    private final String key;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    public LegacySupabaseStorage(@Value("${app.media.legacy-supabase.url:}") String origin,
                                 @Value("${app.media.legacy-supabase.service-role-key:}") String key) {
        this.origin = origin.replaceAll("/+$", ""); this.key = key;
    }
    public boolean configured() { return !origin.isBlank() && !key.isBlank(); }
    public String objectKey(String publicUrl) {
        if (origin.isBlank()) throw new MediaStorageException("Old media cleanup needs the previous storage project configuration.");
        URI base = URI.create(origin), uri;
        try { uri = URI.create(publicUrl); } catch (IllegalArgumentException e) { throw new MediaStorageException("An old media URL cannot be safely deleted.",e); }
        if (!base.getScheme().equals(uri.getScheme()) || !base.getAuthority().equals(uri.getAuthority()) || uri.getRawQuery() != null)
            throw new MediaStorageException("An old media file is outside the configured storage project.");
        String prefix = "/storage/v1/object/public/media/";
        if (!uri.getRawPath().startsWith(prefix)) throw new MediaStorageException("An old media file is outside the managed media bucket.");
        String object = URLDecoder.decode(uri.getRawPath().substring(prefix.length()), StandardCharsets.UTF_8);
        if (!object.startsWith("memories/") || !object.matches("[a-zA-Z0-9._/-]+") || object.contains("..") || object.contains("//"))
            throw new MediaStorageException("An old media object key is outside the managed memories prefix.");
        return object;
    }
    public void delete(String publicUrl) {
        String object = objectKey(publicUrl);
        if (!configured()) throw new MediaStorageException("Old media cleanup needs a Supabase service-role key.");
        try {
            if (missing(object)) return;
            var request = HttpRequest.newBuilder(URI.create(origin + "/storage/v1/object/media"))
                .timeout(Duration.ofSeconds(30)).header("Authorization", "Bearer " + key).header("apikey",key)
                .header("Content-Type","application/json")
                .method("DELETE",HttpRequest.BodyPublishers.ofString("{\"prefixes\":[\"" + object + "\"]}")).build();
            var result = http.send(request,HttpResponse.BodyHandlers.discarding());
            if (result.statusCode() < 200 || result.statusCode() >= 300) throw new MediaStorageException("Old media deletion failed; cleanup will retry.");
            if (!missing(object)) throw new MediaStorageException("An old media file still exists; cleanup will retry.");
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new MediaStorageException("Old media cleanup was interrupted.",e); }
        catch (java.io.IOException e) { throw new MediaStorageException("Could not reach the previous media storage; cleanup will retry.",e); }
    }
    private boolean missing(String object) throws java.io.IOException, InterruptedException {
        var result = http.send(HttpRequest.newBuilder(URI.create(origin + "/storage/v1/object/info/media/" + object))
            .timeout(Duration.ofSeconds(15)).header("Authorization", "Bearer " + key).header("apikey",key).GET().build(), HttpResponse.BodyHandlers.ofString());
        String body = result.body().replaceAll("\\s", "");
        if (result.statusCode() == 404 || (result.statusCode() == 400 && (body.contains("\"statusCode\":\"404\"") || body.contains("\"statusCode\":404")))) return true;
        if (result.statusCode() != 200) throw new MediaStorageException("Could not verify the old media file; cleanup will retry.");
        return false;
    }

}
