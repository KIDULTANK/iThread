package com.ithread.android;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private WebView web;
    private final SyncTransport sync = new SyncTransport();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(2, 2, 30, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(8));
    // Decoding must not occupy the UI thread or queue behind slow network calls.
    private final ThreadPoolExecutor decoder = new ThreadPoolExecutor(1, 1, 30, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(2));
    private ValueCallback<Uri[]> fileChooser;
    private byte[] saveBytes;
    private String saveId;
    private JavaScriptReplyProxy saveReply;
    private volatile boolean destroyed;
    private final Runnable expiry = new Runnable() {
        @Override public void run() { sync.expire(); handler.postDelayed(this, 30000); }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xfff6f3ec);
        setContentView(root);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return insets;
        });
        android.content.pm.PackageInfo provider = WebViewCompat.getCurrentWebViewPackage(this);
        if (provider == null || !SyncPolicy.supportedWebView(provider.versionName)
                || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView message = new TextView(this);
            message.setText("请将 Android System WebView 更新到 124 或更高版本后重新打开 iThread。\nUpdate Android System WebView to version 124 or later to run iThread.");
            root.addView(message);
            return;
        }
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only OS-granted content URIs from the document picker.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", path -> {
                        try {
                            if (path.contains("..") || path.contains("\\") || path.startsWith("/")) return blocked();
                            return new WebResourceResponse(mime(path), "UTF-8", getAssets().open("web/" + path));
                        } catch (Exception ignored) { return blocked(); }
                }).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // All executable content is bundled. External links open outside this WebView;
                // cloud networking is only through the separate, provider-scoped native transport.
                WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                return response != null ? response : blocked();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (SyncPolicy.appDocument(request.getUrl().toString()) && request.isForMainFrame()) return false;
                if (request.isForMainFrame() && request.hasGesture()
                        && Arrays.asList("https", "http", "mailto").contains(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (Exception ignored) { showFailure(); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileChooser != null) { callback.onReceiveValue(null); return true; }
                fileChooser = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*")
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, 1); }
                catch (Exception ignored) { fileChooser = null; callback.onReceiveValue(null); showFailure(); }
                return true;
            }
        });
        WebViewCompat.addWebMessageListener(web, "IThreadNative", Collections.singleton(SyncPolicy.ORIGIN),
                (view, message, sourceOrigin, mainFrame, reply) -> {
                    if (!mainFrame || !SyncPolicy.ORIGIN.equals(sourceOrigin.toString())
                            || !SyncPolicy.appDocument(view.getUrl())) return;
                    String raw = message.getData();
                    if (raw == null || raw.length() > 24 * 1024 * 1024) return;
                    try { decoder.execute(() -> dispatch(raw, reply)); }
                    catch (Exception ignored) {
                        // IDs are first in the bundled bootstrap's envelope. Bound the scan so a
                        // rejected large message never gets decoded on the UI thread.
                        java.util.regex.Matcher id = java.util.regex.Pattern.compile("\"id\"\\s*:\\s*\"([a-f0-9-]{36})\"")
                                .matcher(raw.substring(0, Math.min(raw.length(), 128)));
                        if (id.find()) respond(reply, id.group(1), null, true);
                    }
                });
        handler.post(expiry);
        web.loadUrl(SyncPolicy.DOCUMENT);
        if (android.os.Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
    }

    private void dispatch(String raw, JavaScriptReplyProxy reply) {
        if (destroyed) return;
        try {
            JSONObject request = new JSONObject(raw);
            String id = request.getString("id"), method = request.getString("method");
            if (!id.matches("[a-f0-9-]{36}")) return;
            JSONObject input = request.getJSONObject("input");
            try {
                if (method.equals("syncCloseAll")) { sync.closeAll(); respond(reply, id, true, false); return; }
                if (method.equals("syncDisconnect")) {
                    respond(reply, id, sync.close(input.getString("token")), false); return;
                }
                if (method.equals("syncConnect")) { respond(reply, id, sync.connect(input), false); return; }
                if (method.equals("saveFile")) { saveFile(input, id, reply); return; }
                if (!method.equals("syncRequest")) throw new IllegalArgumentException("Unknown method");
                workers.execute(() -> {
                    try { respond(reply, id, sync.request(input), false); }
                    catch (Exception ignored) { respond(reply, id, null, true); }
                });
            } catch (Exception ignored) { respond(reply, id, null, true); }
        } catch (Exception ignored) { /* Never log bridge messages or credentials. */ }
    }

    private static String mime(String path) {
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", null,
                new ByteArrayInputStream(new byte[0]));
    }

    private void respond(JavaScriptReplyProxy reply, String id, Object value, boolean error) {
        final String encoded;
        try {
            JSONObject result = new JSONObject().put("id", id);
            if (error) result.put("error", "Android operation failed. Check connection, size limit and credentials.");
            else result.put("value", value == null ? JSONObject.NULL : value);
            encoded = result.toString();
        } catch (Exception ignored) { return; }
        handler.post(() -> {
            if (destroyed) return;
            try {
                reply.postMessage(encoded);
            } catch (Exception ignored) { /* Closing/navigating the app invalidates the reply channel. */ }
        });
    }

    private void saveFile(JSONObject input, String id, JavaScriptReplyProxy reply) {
        try {
            String name = input.getString("filename").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            if (name.trim().isEmpty() || name.length() > 240) throw new IllegalArgumentException("Invalid filename");
            byte[] bytes = Base64.decode(input.getString("base64"), Base64.DEFAULT);
            if (bytes.length > SyncPolicy.MAX_BYTES) throw new IllegalArgumentException("Export too large");
            String mime = input.getString("mime");
            if (!mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")) mime = "application/octet-stream";
            final String type = mime;
            handler.post(() -> {
                if (destroyed) return;
                if (saveId != null) { respond(reply, id, null, true); return; }
                saveBytes = bytes; saveId = id; saveReply = reply;
                try {
                    startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(type)
                            .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, name), 2);
                } catch (Exception ignored) {
                    saveBytes = null; saveId = null; saveReply = null;
                    respond(reply, id, null, true);
                }
            });
        } catch (Exception ignored) {
            respond(reply, id, null, true);
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 1 && fileChooser != null) {
            ValueCallback<Uri[]> callback = fileChooser; fileChooser = null;
            Uri[] uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            if (uris == null) { callback.onReceiveValue(null); return; }
            try {
                workers.execute(() -> {
                    try {
                        if (uris.length > 8) throw new IllegalArgumentException("Too many files");
                        for (Uri uri : uris) {
                            if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("Invalid file");
                            try (InputStream input = getContentResolver().openInputStream(uri)) {
                                SyncTransport.checkReadable(input, SyncPolicy.MAX_BYTES);
                            }
                        }
                        handler.post(() -> { if (!destroyed) callback.onReceiveValue(uris); });
                    } catch (Exception ignored) {
                        handler.post(() -> { if (!destroyed) { callback.onReceiveValue(null); showFailure(); } });
                    }
                });
            } catch (Exception ignored) { callback.onReceiveValue(null); showFailure(); }
        }
        if (requestCode == 2 && saveId != null) {
            String id = saveId; byte[] bytes = saveBytes; JavaScriptReplyProxy reply = saveReply;
            saveId = null; saveBytes = null; saveReply = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) {
                respond(reply, id, false, false); return;
            }
            Uri uri = data.getData();
            try {
                workers.execute(() -> {
                    try {
                        if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("Invalid file");
                        try (OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
                            if (out == null) throw new IllegalStateException("Missing destination");
                            out.write(bytes);
                        }
                        respond(reply, id, true, false);
                    } catch (Exception ignored) { respond(reply, id, null, true); }
                });
            } catch (Exception ignored) { respond(reply, id, null, true); }
        }
    }

    private void showFailure() {
        Toast.makeText(this, "操作失败，请检查权限、网络及 16 MiB 文件限制。\nOperation failed; check permissions, network and the 16 MiB file limit.", Toast.LENGTH_LONG).show();
    }

    @Override protected void onStart() { super.onStart(); sync.setEnabled(true); }
    @Override protected void onStop() { sync.setEnabled(false); super.onStop(); }
    @Override public void onBackPressed() {
        handleBack();
    }
    private void handleBack() {
        if (web != null && web.canGoBack()) web.goBack();
        else {
            if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))", null);
            handler.postDelayed(this::finish, 250);
        }
    }
    @Override protected void onDestroy() {
        destroyed = true; handler.removeCallbacks(expiry); sync.setEnabled(false); decoder.shutdownNow(); workers.shutdownNow();
        if (fileChooser != null) fileChooser.onReceiveValue(null);
        if (web != null) web.destroy();
        saveBytes = null; saveId = null; saveReply = null;
        super.onDestroy();
    }
}
