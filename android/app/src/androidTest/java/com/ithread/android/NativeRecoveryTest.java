package com.ithread.android;

import android.content.ClipboardManager;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewRenderProcess;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.util.concurrent.TimeUnit;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class NativeRecoveryTest extends TabletTestBase {
    @Before public void launch() { scenario = ActivityScenario.launch(MainActivity.class); }
    @After public void close() { if (scenario != null) scenario.close(); }

    @Test public void recoversFromTerminatedRendererWithoutClearingLocalData() throws Exception {
        ready();
        android.util.Log.i("iThreadRuntimeTest", "recovery: editor ready");
        evaluate("localStorage.setItem('android-renderer-recovery','synthetic-retained');true");
        evaluate("window.__rendererSeeded=false;(async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('mindmap-studio',7);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});"
                + "const tx=db.transaction('maps','readwrite');const done=new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});"
                + "tx.objectStore('maps').put({schemaVersion:1,id:'android-renderer-recovery',title:'恢复 Test',root:{id:'recovery-root',topic:'恢复 Test',note:'synthetic-note',children:[]}},'android-renderer-recovery');"
                + "await done;db.close();window.__rendererSeeded=true;})().catch(()=>{});true");
        waitTrue("window.__rendererSeeded===true");
        android.util.Log.i("iThreadRuntimeTest", "recovery: persisted fixture ready; terminating renderer");
        scenario.onActivity(activity -> {
            WebView web = findWeb(activity.getWindow().getDecorView());
            WebViewRenderProcess process = web.getWebViewRenderProcess();
            assertNotNull("Expected a separate WebView renderer", process);
            assertTrue("Renderer termination was not accepted", process.terminate());
        });
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
        boolean[] shown = {false};
        while (!shown[0] && System.nanoTime() < end) {
            scenario.onActivity(activity -> shown[0] = activity.getWindow().getDecorView()
                    .findViewWithTag("runtime-diagnostics") != null);
            if (!shown[0]) Thread.sleep(200);
        }
        assertTrue("Native recovery screen did not appear", shown[0]);
        waitForWindowFocus(scenario);
        android.util.Log.i("iThreadRuntimeTest", "recovery: native support visible");
        captureRuntimeScreen("renderer-recovery");
        scenario.onActivity(activity -> {
            View decor = activity.getWindow().getDecorView();
            assertNull("Dead WebView must not be reused", findWeb(decor));
            TextView report = decor.findViewWithTag("runtime-diagnostics");
            assertTrue(report.getText().toString().contains("event=RENDERER_TERMINATED"));
            assertTrue(report.getText().toString().contains("compatibility=OK"));
        });
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        UiObject2 copy = device.wait(Until.findObject(By.text("复制诊断信息 / Copy diagnostics")), 10000);
        assertNotNull("Copy button not visible", copy);
        copy.click(); // Real input: do not read clipboard inside the same synchronous UI callback.
        waitForWindowFocus(scenario);
        boolean[] copied = {false};
        end = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (!copied[0] && System.nanoTime() < end) {
            scenario.onActivity(activity -> {
                if (!activity.hasWindowFocus()) return;
                ClipboardManager clipboard = (ClipboardManager) activity.getSystemService(android.app.Activity.CLIPBOARD_SERVICE);
                android.content.ClipData clip = clipboard.getPrimaryClip();
                TextView report = activity.getWindow().getDecorView().findViewWithTag("runtime-diagnostics");
                copied[0] = clip != null && clip.getItemCount() == 1 && report.getText().toString()
                        .equals(String.valueOf(clip.getItemAt(0).getText()));
            });
            if (!copied[0]) Thread.sleep(200);
        }
        assertTrue("Copy did not place the diagnostic report on the clipboard", copied[0]);
        android.util.Log.i("iThreadRuntimeTest", "recovery: copied diagnostics");
        android.util.Log.i("iThreadRuntimeTest", "recovery: invoking retry");
        UiObject2 retry = device.wait(Until.findObject(By.text("重新检查并打开 / Retry")), 10000);
        assertNotNull("Retry button not visible", retry);
        retry.click();
        android.util.Log.i("iThreadRuntimeTest", "recovery: retry action returned");
        // Wait for the recreated Activity to contain a fresh WebView before running editor probes.
        boolean[] restored = {false};
        end = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
        while (!restored[0] && System.nanoTime() < end) {
            scenario.onActivity(activity -> restored[0] = findWeb(activity.getWindow().getDecorView()) != null);
            if (!restored[0]) Thread.sleep(200);
        }
        assertTrue("Retry did not create a new WebView", restored[0]);
        android.util.Log.i("iThreadRuntimeTest", "recovery: replacement WebView created");
        ready();
        android.util.Log.i("iThreadRuntimeTest", "recovery: replacement editor ready");
        assertEquals("true", evaluate("localStorage.getItem('android-renderer-recovery')==='synthetic-retained'"));
        evaluate("window.__rendererMapKept=false;(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('mindmap-studio',7);r.onsuccess=()=>ok(r.result)});"
                + "const doc=await new Promise(ok=>{const r=db.transaction('maps').objectStore('maps').get('android-renderer-recovery');r.onsuccess=()=>ok(r.result)});"
                + "window.__rendererMapKept=doc?.root?.note==='synthetic-note';db.close()})().catch(()=>{});true");
        waitTrue("window.__rendererMapKept===true");
        evaluate("localStorage.removeItem('android-renderer-recovery');true");
    }
}
