package com.ithread.android;

import org.junit.Test;
import static org.junit.Assert.*;

public final class HuaweiCompatibilityTest {
    private RuntimeDiagnostics info(int chromium, Boolean listener, String probe) {
        return new RuntimeDiagnostics("huawei-test", "13", 33, true, "com.huawei.webview",
                "14.0.0.321", listener, true, chromium, probe);
    }
    @Test public void vendorVersionDoesNotStandForChromiumVersion() {
        assertEquals(99, SyncPolicy.chromiumMajor("Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/99.0.4844.88 Mobile Safari/537.36"));
        assertEquals(-1, SyncPolicy.chromiumMajor("14.0.0.321"));
        assertEquals(-1, SyncPolicy.chromiumMajor(null));
        assertEquals(-1, SyncPolicy.chromiumMajor("fakeChrome/150.0.1"));
        assertEquals(-1, SyncPolicy.chromiumMajor("Chrome/9999.1"));
        assertEquals(-1, SyncPolicy.chromiumMajor("x".repeat(4097)));
    }
    @Test public void huawei99NeedsACompletedCapabilityProbe() {
        RuntimeDiagnostics pending = info(99, true, "NOT_RUN");
        assertTrue(pending.mayInitialize());
        assertFalse(pending.supported());
        RuntimeDiagnostics passed = pending.withProbe("PASS");
        assertTrue(passed.supported());
        assertTrue(passed.report(RuntimeDiagnostics.Event.COMPATIBILITY_BLOCKED).contains("webview.version=14.0.0.321"));
        assertTrue(passed.report(RuntimeDiagnostics.Event.COMPATIBILITY_BLOCKED).contains("chromium.major=99"));
        assertFalse(passed.report(RuntimeDiagnostics.Event.COMPATIBILITY_BLOCKED).contains("WEBVIEW_TOO_OLD"));
    }
    @Test public void legacyProfileStillRejectsAncientUnknownOrInsecureEngines() {
        assertFalse(info(97, true, "PASS").mayInitialize());
        assertFalse(info(-1, true, "PASS").mayInitialize());
        assertFalse(info(99, false, "PASS").mayInitialize());
        assertFalse(info(99, null, "PASS").mayInitialize());
        assertFalse(info(99, true, "FAIL").supported());
        assertFalse(info(99, true, "TIMEOUT").supported());
    }
    @Test public void standardProfileAndOriginRulesRemainStrict() {
        assertFalse(new RuntimeDiagnostics("standard", "13", 33, true, "com.huawei.webview", "14.0.0.321", true).supported());
        assertFalse(SyncPolicy.supportedWebView("123.0.0.0"));
        assertTrue(SyncPolicy.supportedWebView("124.0.0.0"));
        assertFalse(SyncPolicy.appDocument(SyncPolicy.COMPAT_DOCUMENT));
        assertFalse(SyncPolicy.appDocument("https://example.com/assets/index.html"));
    }
}
