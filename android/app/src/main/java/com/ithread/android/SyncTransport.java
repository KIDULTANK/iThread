package com.ithread.android;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Base64;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONObject;

final class SyncTransport {
    private final OkHttpClient client = new OkHttpClient.Builder()
            .followRedirects(false).followSslRedirects(false)
            .connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
            .callTimeout(30, TimeUnit.SECONDS).build();
    private final Map<String, Session> sessions = new HashMap<>();
    private int active;
    private boolean enabled = true;
    synchronized void setEnabled(boolean value) { enabled = value; if (!value) closeAll(); }
    private static long now() { return TimeUnit.NANOSECONDS.toMillis(System.nanoTime()); }
    private static final class Session {
        URI root;
        String authorization;
        long expires;
        Set<Call> calls = new HashSet<>();
    }

    synchronized String connect(JSONObject input) throws Exception {
        expire();
        String username = input.getString("username"), password = input.getString("password");
        if (!enabled || sessions.size() >= 8 || username.length() > 256 || password.length() > 2048
                || username.contains(":") || (username + password).matches("(?s).*[\\r\\n].*"))
            throw new IllegalArgumentException("Invalid credentials");
        Session session = new Session();
        session.root = SyncPolicy.directory(input.getString("endpoint"));
        session.authorization = "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
        session.expires = now() + 600000;
        String token = UUID.randomUUID().toString();
        sessions.put(token, session);
        return token;
    }

    synchronized boolean close(String token) {
        Session session = sessions.remove(token);
        if (session == null) return false;
        session.authorization = "";
        for (Call call : session.calls) call.cancel();
        return true;
    }

    synchronized void closeAll() {
        for (String token : new HashSet<>(sessions.keySet())) close(token);
    }

    synchronized void expire() {
        for (String token : new HashSet<>(sessions.keySet()))
            if (sessions.get(token).expires <= now()) close(token);
    }

    JSONObject request(JSONObject input) throws Exception {
        String token = input.getString("token");
        String filename = input.getString("filename"), method = input.getString("method");
        SyncPolicy.request(filename, method);
        Session session;
        Call call;
        synchronized (this) {
            expire();
            session = sessions.get(token);
            if (!enabled || session == null || active >= 2) throw new IllegalStateException("Session unavailable");
            Request.Builder request = new Request.Builder().url(session.root.resolve(filename).toString())
                    .header("Authorization", session.authorization);
            JSONObject headers = input.optJSONObject("headers");
            if (headers == null) throw new IllegalArgumentException("Invalid headers");
            for (Iterator<String> keys = headers.keys(); keys.hasNext();) {
                String name = keys.next(), value = headers.getString(name);
                String lower = name.toLowerCase(Locale.ROOT);
                if (!Arrays.asList("content-type", "depth", "if-match", "if-none-match").contains(lower)
                        || value.length() > 512 || value.contains("\r") || value.contains("\n")
                        || (lower.equals("depth") && !value.equals("1")))
                    throw new IllegalArgumentException("Invalid header");
                request.header(name, value);
            }
            if (method.equals("PROPFIND")) request.header("Depth", "1");
            byte[] body = input.optString("body", "").getBytes(StandardCharsets.UTF_8);
            if (body.length > SyncPolicy.MAX_BYTES || (method.equals("GET") && input.has("body")))
                throw new IllegalArgumentException("Invalid body");
            request.method(method, method.equals("GET") ? null : RequestBody.create(body,
                    MediaType.parse(headers.optString("content-type", "application/json; charset=utf-8"))));
            call = client.newCall(request.build());
            session.calls.add(call);
            active++;
        }
        try (Response response = call.execute()) {
            if (response.body() == null) throw new IllegalStateException("Missing response");
            int limit = filename.isEmpty() ? 2 * 1024 * 1024 : SyncPolicy.MAX_BYTES;
            if (response.body().contentLength() > limit) throw new IllegalArgumentException("Response too large");
            byte[] bytes = readBounded(response.body().byteStream(), limit);
            synchronized (this) {
                if (sessions.get(token) != session) throw new IllegalStateException("Session closed");
            }
            JSONObject responseHeaders = new JSONObject();
            for (String name : Arrays.asList("etag", "content-type")) {
                String value = response.header(name);
                if (value != null) responseHeaders.put(name, value);
            }
            return new JSONObject().put("status", response.code()).put("headers", responseHeaders)
                    .put("body", new String(bytes, StandardCharsets.UTF_8));
        } finally {
            synchronized (this) { session.calls.remove(call); active--; }
        }
    }

    static byte[] readBounded(InputStream input, int limit) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        transferBounded(input, limit, output);
        return output.toByteArray();
    }

    static int checkReadable(InputStream input, int limit) throws Exception {
        return transferBounded(input, limit, null);
    }

    private static int transferBounded(InputStream input, int limit, java.io.OutputStream output) throws Exception {
        if (input == null) throw new IllegalArgumentException("Missing input");
        byte[] buffer = new byte[32768];
        int read, total = 0;
        while ((read = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted()) throw new java.io.InterruptedIOException("Cancelled");
            if (total + read > limit) throw new IllegalArgumentException("File too large");
            if (output != null) output.write(buffer, 0, read);
            total += read;
        }
        return total;
    }
}
