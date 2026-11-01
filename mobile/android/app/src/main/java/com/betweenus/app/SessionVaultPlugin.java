package com.betweenus.app;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Only the rotating refresh token is saved. The key never leaves Android Keystore. */
@CapacitorPlugin(name = "SessionVault")
public class SessionVaultPlugin extends Plugin {
    private static final String ALIAS = "com.betweenus.session.v1";
    private AtomicFile file() {
        // Excluded from cloud backup and device transfer; keys are device-specific.
        return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "session.enc"));
    }
    private KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store = keyStore();
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        if (!create) return null;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }
    @PluginMethod
    public synchronized void read(PluginCall call) {
        try {
            AtomicFile stored = file();
            if (!stored.getBaseFile().exists()) { call.resolve(new JSObject()); return; }
            byte[] bytes = stored.readFully();
            SecretKey secret = key(false);
            if (secret == null || bytes.length < 29) { stored.delete(); call.resolve(new JSObject()); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(128, Arrays.copyOfRange(bytes, 0, 12)));
            String token = new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8);
            JSObject result = new JSObject(); result.put("token", token); call.resolve(result);
        } catch (javax.crypto.AEADBadTagException | android.security.keystore.KeyPermanentlyInvalidatedException lostKey) {
            file().delete();
            try { keyStore().deleteEntry(ALIAS); } catch (Exception ignored) { /* Next login reports an unavailable keystore. */ }
            call.resolve(new JSObject());
        } catch (Exception failure) { call.reject("Could not read the saved session", failure); }
    }
    @PluginMethod
    public synchronized void write(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isBlank() || token.length() > 512) { call.reject("Invalid session token"); return; }
        AtomicFile stored = file(); FileOutputStream output = null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(true));
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            output = stored.startWrite(); output.write(cipher.getIV()); output.write(encrypted);
            stored.finishWrite(output); call.resolve();
        } catch (Exception failure) {
            if (output != null) stored.failWrite(output);
            call.reject("Could not save the session", failure);
        }
    }
    @PluginMethod
    public synchronized void clear(PluginCall call) {
        try {
            file().delete();
            // A fresh login also gets a fresh key, including after a device key becomes unusable.
            keyStore().deleteEntry(ALIAS);
            if (file().getBaseFile().exists()) call.reject("Could not remove the saved session");
            else call.resolve();
        } catch (Exception failure) { call.reject("Could not remove the saved session", failure); }
    }
}
