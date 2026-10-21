package com.ithread.android;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public final class SyncPolicyTest {
    @Test public void requiresModernWebViewForSharedEditorFeatures() {
        assertTrue(SyncPolicy.supportedWebView("124.0.6367.179"));
        assertTrue(SyncPolicy.supportedWebView("150.0.0.0"));
        assertFalse(SyncPolicy.supportedWebView("123.0.0.0"));
        assertFalse(SyncPolicy.supportedWebView(null));
        assertFalse(SyncPolicy.supportedWebView("unknown"));
    }
    @Test public void allowsDedicatedNutstoreDirectory() {
        assertEquals("https://dav.jianguoyun.com/dav/%E6%B5%8B%E8%AF%95/",
                SyncPolicy.directory("https://dav.jianguoyun.com/dav/%E6%B5%8B%E8%AF%95").toString());
    }
    @Test public void rejectsUnsafeDirectories() {
        for (String url : new String[] {
                "http://dav.jianguoyun.com/dav/maps/", "https://example.com/dav/maps/",
                "https://dav.jianguoyun.com.evil.test/dav/maps/", "https://dav.jianguoyun.com:443/dav/maps/",
                "https://user:pass@dav.jianguoyun.com/dav/maps/", "https://dav.jianguoyun.com/dav/maps/?secret=x",
                "https://dav.jianguoyun.com/dav/maps/#x", "https://dav.jianguoyun.com/other/maps/",
                "https://dav.jianguoyun.com/dav/../maps/", "https://dav.jianguoyun.com/dav/%2e%2e/maps/",
                "https://dav.jianguoyun.com/dav/%2f/maps/", "https://dav.jianguoyun.com/dav/%5c/maps/" }) {
            assertThrows(url, IllegalArgumentException.class, () -> SyncPolicy.directory(url));
        }
    }
    @Test public void restrictsNativeFileRequests() {
        SyncPolicy.request("", "PROPFIND");
        SyncPolicy.request("map-1.json", "GET");
        SyncPolicy.request("map-1--" + "a".repeat(64) + ".ithread-sync.json", "PUT");
        for (String file : new String[] { "../x.json", "x/y.json", "https://evil.test/x.json", "x.json?x", "%2e%2e.json", "x.txt" })
            assertThrows(IllegalArgumentException.class, () -> SyncPolicy.request(file, "GET"));
        assertThrows(IllegalArgumentException.class, () -> SyncPolicy.request("", "PUT"));
        assertThrows(IllegalArgumentException.class, () -> SyncPolicy.request("x.json", "DELETE"));
    }
    @Test public void acceptsOnlyAppDocumentEvenOnSameOrigin() {
        assertTrue(SyncPolicy.appDocument(SyncPolicy.DOCUMENT + "?map=test#root"));
        for (String url : new String[] { "https://appassets.androidplatform.net/assets/other.html",
                "https://appassets.androidplatform.net.evil.test/assets/index.html", "file:///assets/index.html",
                "https://appassets.androidplatform.net:444/assets/index.html" })
            assertFalse(SyncPolicy.appDocument(url));
        assertFalse(SyncPolicy.appDocument(null));
    }
    @Test public void boundsUnknownLengthStreams() throws Exception {
        byte[] bytes = "synthetic".getBytes(StandardCharsets.UTF_8);
        assertArrayEquals(bytes, SyncTransport.readBounded(new ByteArrayInputStream(bytes), bytes.length));
        assertThrows(IllegalArgumentException.class,
                () -> SyncTransport.readBounded(new ByteArrayInputStream(bytes), bytes.length - 1));
    }
    @Test public void preflightCountsWithoutKeepingASecondFileCopy() throws Exception {
        byte[] bytes = new byte[32769];
        assertEquals(bytes.length, SyncTransport.checkReadable(new ByteArrayInputStream(bytes), bytes.length));
        assertThrows(IllegalArgumentException.class,
                () -> SyncTransport.checkReadable(new ByteArrayInputStream(bytes), bytes.length - 1));
        assertThrows(IllegalArgumentException.class, () -> SyncTransport.checkReadable(null, 1));
    }
}
