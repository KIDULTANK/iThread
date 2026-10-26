package com.ithread.android;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class HuaweiProfileTest extends TabletTestBase {
    @Before public void launch() { scenario = ActivityScenario.launch(MainActivity.class); }
    @After public void close() { if (scenario != null) scenario.close(); }
    @Test public void isolatedProfilePassesProbeBeforeLoadingEditor() throws Exception {
        if (!BuildConfig.HUAWEI_COMPAT) {
            assertFalse(SyncPolicy.supportedWebView("123.0.0.0"));
            return;
        }
        ready();
        assertEquals("com.ithread.android.huawei.compat", InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
        assertEquals("true", evaluate("document.documentElement.dataset.compat==='huawei' && location.pathname==='/assets/index.html' && Boolean(window.iThreadAndroid)"));
        scenario.onActivity(activity -> {
            try {
                java.lang.reflect.Field field = MainActivity.class.getDeclaredField("diagnostics");
                field.setAccessible(true);
                RuntimeDiagnostics info = (RuntimeDiagnostics) field.get(activity);
                assertTrue(info.huaweiCompat);
                assertTrue(info.chromiumMajor >= 98);
                assertTrue(info.supported());
                assertEquals("PASS", info.probe);
                android.util.Log.i("iThreadCompatTest", "provider=" + info.providerVersion
                        + " chromium=" + info.chromiumMajor + " probe=" + info.probe);
            } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        });
        captureRuntimeScreen("huawei-profile-editor");
    }
}
