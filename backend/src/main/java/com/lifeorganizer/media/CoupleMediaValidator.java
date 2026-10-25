package com.lifeorganizer.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.nio.file.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Decodes/re-encodes photos without metadata; inspects audio streams and duration server-side. */
@Component
@Profile("couples")
public class CoupleMediaValidator {
    private final java.util.concurrent.Semaphore processing = new java.util.concurrent.Semaphore(4);
    private final String probe;
    private final String encoder;
    public CoupleMediaValidator(@Value("${app.media.ffprobe:ffprobe}") String probe,@Value("${app.media.ffmpeg:ffmpeg}")String encoder) { this.probe=probe;this.encoder=encoder; }
    public record Validated(Path path,String type,long size) implements AutoCloseable {
        public void close() { try { Files.deleteIfExists(path); } catch (IOException ignored) {} }
    }
    public Validated validate(MultipartFile file) {
        if (file.getSize()<1 || file.getSize()>25L*1024*1024) throw new IllegalArgumentException("Choose a file between 1 byte and 25 MB");
        if (!processing.tryAcquire()) throw new IllegalStateException("Uploads are busy. Try again in a moment.");
        String claimed=MediaUploadService.type(file.getContentType());
        Path original=null,clean=null;
        try {
            original=Files.createTempFile("couple-upload-", ".media");
            try (InputStream in=file.getInputStream()) {
                long copied=Files.copy(in,original,StandardCopyOption.REPLACE_EXISTING);
                if (copied!=file.getSize()) throw new IllegalArgumentException("The file could not be read completely");
            }
            String type;
            if (claimed.startsWith("image/")) {
                clean=Files.createTempFile("couple-photo-", ".image");
                try (var input=ImageIO.createImageInputStream(original.toFile())) {
                    var readers=ImageIO.getImageReaders(input);
                    if (!readers.hasNext()) throw new IllegalArgumentException("Choose a valid JPEG or PNG photo");
                    var reader=readers.next();
                    try {
                        reader.setInput(input,true,true);
                        String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                        if (!List.of("jpeg","jpg","png").contains(format)) throw new IllegalArgumentException("Choose a JPEG or PNG photo");
                        int width=reader.getWidth(0),height=reader.getHeight(0);
                        if (width<1 || height<1 || (long)width*height>16_000_000) throw new IllegalArgumentException("Photos must be at most 16 megapixels");
                        var image=reader.read(0); boolean png=format.equals("png");
                        if (!ImageIO.write(image,png?"png":"jpeg",clean.toFile())) throw new IllegalArgumentException("This photo could not be processed");
                        type=png?"image/png":"image/jpeg";
                    } finally { reader.dispose(); }
                }
                Files.deleteIfExists(original); original=null;
            } else if (claimed.startsWith("audio/")) {
                byte[] magic=new byte[16]; int length;
                try (InputStream input=Files.newInputStream(original)) { length=input.read(magic); }
                boolean known=length>=8 && ((magic[0]=='R'&&magic[1]=='I'&&magic[2]=='F'&&magic[3]=='F')
                        || (magic[0]=='O'&&magic[1]=='g'&&magic[2]=='g'&&magic[3]=='S')
                        || (magic[0]=='I'&&magic[1]=='D'&&magic[2]=='3') || (magic[0]&0xff)==0xff
                        || (magic[4]=='f'&&magic[5]=='t'&&magic[6]=='y'&&magic[7]=='p')
                        || ((magic[0]&0xff)==0x1a&&(magic[1]&0xff)==0x45&&(magic[2]&0xff)==0xdf&&(magic[3]&0xff)==0xa3));
                if (!known) throw new IllegalArgumentException("Choose a valid audio recording");
                Process process;
                try { process=new ProcessBuilder(probe,"-protocol_whitelist","file,pipe","-v","error","-show_entries","stream=codec_type:format=duration,format_name","-of","default=noprint_wrappers=1",original.toString()).redirectErrorStream(true).start(); }
                catch (IOException unavailable) { throw new MediaStorageException("Audio validation is unavailable on this server"); }
                try {
                    if (!process.waitFor(8,TimeUnit.SECONDS)) { process.destroyForcibly();throw new IllegalArgumentException("This recording could not be inspected"); }
                    String output=new String(process.getInputStream().readNBytes(8192),StandardCharsets.UTF_8);
                    if (process.exitValue()!=0 || !output.contains("codec_type=audio") || output.contains("codec_type=video")) throw new IllegalArgumentException("Choose an audio-only recording");
                    Map<String,String> values=new HashMap<>();
                    output.lines().filter(line->line.contains("=")).forEach(line->{var pair=line.split("=",2);values.put(pair[0],pair[1]);});
                    // Decode up to 61 seconds rather than trusting an attacker-controlled duration header.
                    clean=Files.createTempFile("couple-audio-", ".wav");
                    Process decoded;
                    try { decoded=new ProcessBuilder(encoder,"-nostdin","-protocol_whitelist","file,pipe","-v","error","-i",original.toString(),"-map","0:a:0","-vn","-t","61","-ar","24000","-ac","1","-c:a","pcm_s16le","-map_metadata","-1","-y",clean.toString()).redirectErrorStream(true).start(); }
                    catch (IOException unavailable) { throw new MediaStorageException("Audio validation is unavailable on this server"); }
                    try {
                        if(!decoded.waitFor(8,TimeUnit.SECONDS)){decoded.destroyForcibly();throw new IllegalArgumentException("This recording could not be processed");}
                        if(decoded.exitValue()!=0)throw new IllegalArgumentException("Choose a valid audio recording");
                        try(var sound=javax.sound.sampled.AudioSystem.getAudioInputStream(clean.toFile())){
                            double duration=sound.getFrameLength()/(double)sound.getFormat().getFrameRate();
                            if(!Double.isFinite(duration)||duration<=0||duration>60)throw new IllegalArgumentException("Recordings must be 60 seconds or shorter");
                        } catch(javax.sound.sampled.UnsupportedAudioFileException invalid){throw new IllegalArgumentException("This recording could not be inspected");}
                    } finally { decoded.destroyForcibly(); }
                    type="audio/wav";
                } finally { process.destroyForcibly(); }
                Files.deleteIfExists(original);original=null;
            } else throw new IllegalArgumentException("Choose a JPEG/PNG photo or a supported audio recording");
            long size=Files.size(clean);
            if (size<1 || size>25L*1024*1024) throw new IllegalArgumentException("Processed media must be 25 MB or smaller");
            var result=new Validated(clean,type,size);clean=null;return result;
        } catch (InterruptedException interrupted) { Thread.currentThread().interrupt();throw new MediaStorageException("Audio validation was interrupted"); }
        catch (IOException invalid) { throw new IllegalArgumentException("This media file could not be processed"); }
        finally {
            processing.release();
            for (Path path:new Path[]{original,clean}) if (path!=null) try { Files.deleteIfExists(path); } catch (IOException ignored) {}
        }
    }
}
