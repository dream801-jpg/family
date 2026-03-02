package com.yoonmood.familycalendar;

import android.app.Activity;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Ringtone")
public class RingtonePlugin extends Plugin {

    @PluginMethod
    public void pickRingtone(PluginCall call) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true);

        String currentUriString = call.getString("currentUri");
        if (currentUriString != null && !currentUriString.isEmpty()) {
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(currentUriString));
        }

        startActivityForResult(call, intent, "pickRingtoneResult");
    }

    @ActivityCallback
    private void pickRingtoneResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK) {
            Intent data = result.getData();
            if (data != null) {
                Uri uri = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
                JSObject ret = new JSObject();
                if (uri != null) {
                    ret.put("uri", uri.toString());
                    
                    // Try to get title
                    try {
                        android.media.Ringtone ringtone = RingtoneManager.getRingtone(getContext(), uri);
                        String title = ringtone.getTitle(getContext());
                        ret.put("title", title);
                    } catch (Exception e) {
                        ret.put("title", "Unknown Sound");
                    }
                } else {
                    ret.put("uri", ""); // Silent
                    ret.put("title", "Silent");
                }
                call.resolve(ret);
            } else {
                call.reject("No data returned");
            }
        } else {
            call.reject("User canceled");
        }
    }
}
