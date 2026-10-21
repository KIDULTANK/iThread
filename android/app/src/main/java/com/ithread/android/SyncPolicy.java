package com.ithread.android;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/** Pure policy, shared by the transport and JVM tests. No arbitrary native HTTP proxy. */
final class SyncPolicy {
    static final int MAX_BYTES = 16 * 1024 * 1024;
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String DOCUMENT = ORIGIN + "/assets/index.html";

    static URI directory(String text) {
        if (text.length() > 4096) throw new IllegalArgumentException("Invalid directory");
        URI uri = URI.create(text);
        if (!"https".equals(uri.getScheme()) || !"dav.jianguoyun.com".equals(uri.getHost())
                || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getQuery() != null
                || uri.getFragment() != null || !uri.getRawPath().startsWith("/dav/"))
            throw new IllegalArgumentException("Invalid directory");
        for (String part : uri.getRawPath().split("/")) {
            String decoded;
            try { decoded = URLDecoder.decode(part, "UTF-8"); }
            catch (java.io.UnsupportedEncodingException impossible) { throw new IllegalStateException(impossible); }
            if (decoded.contains("/") || decoded.contains("\\") || decoded.equals(".")
                    || decoded.equals("..")) throw new IllegalArgumentException("Invalid path");
        }
        return URI.create(text.endsWith("/") ? text : text + "/");
    }

    static void request(String filename, String method) {
        boolean directory = filename.isEmpty();
        if (!(directory || filename.matches("[a-zA-Z0-9_-]{1,128}(?:--[a-f0-9]{64}\\.ithread-sync)?\\.json"))
                || !(directory ? method.equals("PROPFIND") : method.equals("GET") || method.equals("PUT")))
            throw new IllegalArgumentException("Invalid request");
    }

    static boolean appDocument(String text) {
        if (text == null) return false;
        URI uri = URI.create(text);
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null
                && "/assets/index.html".equals(uri.getRawPath());
    }
}
