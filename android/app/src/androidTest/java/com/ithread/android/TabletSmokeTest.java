package com.ithread.android;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.*;

/** Runs the APK's real bundled editor and native bridge, without a live cloud account. */
@RunWith(AndroidJUnit4.class)
public final class TabletSmokeTest {
    private ActivityScenario<MainActivity> scenario;
    private boolean supported;

    @Before public void launch() {
        scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(activity -> {
            android.content.pm.PackageInfo provider = WebViewCompat.getCurrentWebViewPackage(activity);
            supported = provider != null && SyncPolicy.supportedWebView(provider.versionName)
                    && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
            System.out.println("ITHREAD_WEBVIEW " + (provider == null ? "missing" : provider.versionName)
                    + " EDITOR_SUPPORTED=" + supported);
        });
    }
    @After public void close() { if (scenario != null) scenario.close(); }

    private static WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int at = 0; at < group.getChildCount(); at++) {
                WebView result = findWeb(group.getChildAt(at));
                if (result != null) return result;
            }
        }
        return null;
    }
    private String evaluate(String script) throws Exception {
        CompletableFuture<String> result = new CompletableFuture<>();
        scenario.onActivity(activity -> {
            WebView web = findWeb(activity.getWindow().getDecorView());
            if (web == null) { result.complete("null"); return; }
            web.evaluateJavascript(script, result::complete);
        });
        return result.get(30, TimeUnit.SECONDS);
    }
    private void waitTrue(String script) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
        while (System.nanoTime() < end) {
            if ("true".equals(evaluate(script))) return;
            Thread.sleep(200);
        }
        fail("Bundled Android editor/bridge did not reach the expected state: " + script);
    }
    private void ready() throws Exception {
        assumeTrue("Old emulator WebView: validates upgrade prompt, not editor compatibility", supported);
        waitTrue("Boolean(document.querySelector('.start') || document.querySelector('.mm-editor .react-flow'))");
        TabletTestBase.waitForWindowFocus(scenario);
    }

    @Test public void launchesEditorOrShowsActionableWebViewRequirement() throws Exception {
        if (supported) {
            ready();
            assertEquals("true", evaluate("document.documentElement.dataset.platform === 'android' && Boolean(window.iThreadAndroid)"));
        } else {
            scenario.onActivity(activity -> {
                TextView report = activity.getWindow().getDecorView().findViewWithTag("runtime-diagnostics");
                assertNotNull(report);
                assertTrue(report.getText().toString().contains("webview.minimum=124"));
                assertTrue(report.getText().toString().contains("event=COMPATIBILITY_BLOCKED"));
                assertNotNull(activity.getWindow().getDecorView().findViewWithTag("retry-startup"));
                assertNotNull(activity.getWindow().getDecorView().findViewWithTag("copy-diagnostics"));
            });
            TabletTestBase.captureRuntimeScreen("compatibility");
        }
    }

    @Test public void realBridgeCreatesAndClosesMemoryOnlySession() throws Exception {
        ready();
        evaluate("window.__bridgeSmoke = null; (async () => { try { const token = await window.iThreadAndroid.syncConnect({endpoint:'https://dav.jianguoyun.com/dav/synthetic/',username:'synthetic',password:'synthetic'}); window.__bridgeSmoke = await window.iThreadAndroid.syncDisconnect(token); } catch { window.__bridgeSmoke = false; } })(); true");
        waitTrue("window.__bridgeSmoke === true");
    }

    @Test public void realBridgeRejectsArbitraryNativeHost() throws Exception {
        ready();
        evaluate("window.__policySmoke = null; window.iThreadAndroid.syncConnect({endpoint:'https://example.com/maps/',username:'synthetic',password:'synthetic'}).then(() => window.__policySmoke = false, () => window.__policySmoke = true); true");
        waitTrue("window.__policySmoke === true");
    }

    @Test public void rotatesAndRetainsLocalDataAcrossRecreation() throws Exception {
        ready();
        evaluate("localStorage.setItem('ithread-android-smoke','synthetic'); true");
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.setOrientationNatural();
        Thread.sleep(500);
        String natural = evaluate("window.innerWidth > window.innerHeight");
        device.setOrientationLeft();
        waitTrue("(window.innerWidth > window.innerHeight) !== " + natural);
        device.setOrientationNatural();
        waitTrue("(window.innerWidth > window.innerHeight) === " + natural);
        device.unfreezeRotation();
        scenario.recreate();
        ready();
        assertEquals("true", evaluate("localStorage.getItem('ithread-android-smoke') === 'synthetic'"));
        evaluate("localStorage.removeItem('ithread-android-smoke'); true");
    }

    @Test public void cancelledSystemExportDoesNotReportSuccess() throws Exception {
        ready();
        evaluate("window.__exportSmoke = null; window.iThreadAndroid.saveFile({filename:'synthetic.ithread',mime:'application/json',base64:'e30='}).then(value => window.__exportSmoke = value, () => window.__exportSmoke = 'failed'); true");
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.waitForIdle();
        String app = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName();
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
        while (app.equals(device.getCurrentPackageName()) && System.nanoTime() < end) Thread.sleep(200);
        assertNotEquals("System document picker did not open", app, device.getCurrentPackageName());
        for (int at = 0; at < 4 && !app.equals(device.getCurrentPackageName()); at++) {
            device.pressBack();
            Thread.sleep(500);
        }
        waitTrue("window.__exportSmoke === false");
    }
}
