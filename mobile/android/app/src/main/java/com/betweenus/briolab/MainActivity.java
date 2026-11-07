package com.betweenus.briolab;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(SessionVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
