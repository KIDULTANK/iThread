package com.ithread.android;

import java.util.Arrays;
import org.junit.Test;
import static org.junit.Assert.*;

public final class RuntimeDiagnosticsTest {
    private RuntimeDiagnostics sample(String version, Boolean listener) {
        return new RuntimeDiagnostics("dev-test", "10", 29, true, "com.example.webview", version, listener);
    }
    @Test public void oldKernelIsNotConfusedWithOldAndroid() {
        RuntimeDiagnostics info = sample("123.0.1.2", true);
        assertEquals(Arrays.asList("WEBVIEW_TOO_OLD"), info.issues());
        String report = info.report(RuntimeDiagnostics.Event.COMPATIBILITY_BLOCKED);
        assertTrue(report.contains("android=10\napi=29"));
        assertTrue(report.contains("webview.version=123.0.1.2"));
        assertTrue(report.contains("webview.minimum=124"));
    }
    @Test public void modernKernelStillNeedsTheSecureBridge() {
        RuntimeDiagnostics info = sample("150.0.0.0", false);
        assertEquals(Arrays.asList("MESSAGE_LISTENER_UNSUPPORTED"), info.issues());
        assertTrue(info.explanation().contains("安全消息接口"));
        assertFalse(info.explanation().contains("低于"));
    }
    @Test public void missingAndUnknownAreDifferentFromTooOld() {
        RuntimeDiagnostics missing = new RuntimeDiagnostics("test", "15", 35, false, null, null, null);
        assertEquals(Arrays.asList("WEBVIEW_PROVIDER_UNAVAILABLE", "MESSAGE_LISTENER_CHECK_UNAVAILABLE"), missing.issues());
        assertEquals(Arrays.asList("WEBVIEW_VERSION_UNKNOWN"), sample("unknown", true).issues());
        assertFalse(sample(null, true).supported());
    }
    @Test public void supportsAndroid10WithAModernKernel() {
        assertTrue(sample("124.0.6367.179", true).supported());
    }
    @Test public void copiedReportIsBoundedAndCannotInjectExtraLines() {
        RuntimeDiagnostics info = new RuntimeDiagnostics("\u007fdev\nextra=bad", "10", 29,
                true, "p".repeat(400), "124.1", true);
        String report = info.report(RuntimeDiagnostics.Event.RENDERER_TERMINATED);
        assertTrue(report.length() < 700);
        assertFalse(report.contains("\nextra="));
        assertTrue(report.contains("event=RENDERER_TERMINATED"));
        assertTrue(report.contains("compatibility=OK"));
        assertFalse(report.contains("http"));
    }
}
