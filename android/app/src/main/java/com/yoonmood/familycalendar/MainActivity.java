package com.yoonmood.familycalendar;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(com.yoonmood.familycalendar.RingtonePlugin.class);
    }
}
