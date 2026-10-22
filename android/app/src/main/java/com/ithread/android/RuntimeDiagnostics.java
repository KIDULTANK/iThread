package com.ithread.android;

import java.util.ArrayList;
import java.util.List;

/** Explicit allowlist of support data. Never takes URLs, files, maps, credentials or device IDs. */
final class RuntimeDiagnostics {
    enum Event { COMPATIBILITY_BLOCKED, WEBVIEW_START_FAILED, PAGE_LOAD_FAILED, RENDERER_CRASHED, RENDERER_TERMINATED }
    final String appVersion, androidRelease, providerPackage, providerVersion;
    final int api;
    final boolean providerFound;
    final Boolean listenerSupport;

    RuntimeDiagnostics(String appVersion, String androidRelease, int api, boolean providerFound,
            String providerPackage, String providerVersion, Boolean listenerSupport) {
        this.appVersion = safe(appVersion); this.androidRelease = safe(androidRelease); this.api = api;
        this.providerFound = providerFound; this.providerPackage = safe(providerPackage);
        this.providerVersion = safe(providerVersion); this.listenerSupport = listenerSupport;
    }

    List<String> issues() {
        List<String> issues = new ArrayList<>();
        if (!providerFound) issues.add("WEBVIEW_PROVIDER_UNAVAILABLE");
        else {
            int major = SyncPolicy.webViewMajor(providerVersion);
            if (major < 0) issues.add("WEBVIEW_VERSION_UNKNOWN");
            else if (major < SyncPolicy.MIN_WEBVIEW_MAJOR) issues.add("WEBVIEW_TOO_OLD");
        }
        if (listenerSupport == null) issues.add("MESSAGE_LISTENER_CHECK_UNAVAILABLE");
        else if (!listenerSupport) issues.add("MESSAGE_LISTENER_UNSUPPORTED");
        return issues;
    }

    boolean supported() { return issues().isEmpty(); }

    String report(Event event) {
        return "iThread Android diagnostics v1\n"
                + "app=" + appVersion + "\nandroid=" + androidRelease + "\napi=" + api
                + "\nwebview.package=" + providerPackage + "\nwebview.version=" + providerVersion
                + "\nwebview.minimum=" + SyncPolicy.MIN_WEBVIEW_MAJOR
                + "\nweb_message_listener=" + (listenerSupport == null ? "UNKNOWN" : listenerSupport)
                + "\nevent=" + event.name() + "\ncompatibility="
                + (supported() ? "OK" : String.join(",", issues()));
    }

    String explanation() {
        List<String> reasons = new ArrayList<>();
        for (String issue : issues()) {
            switch (issue) {
                case "WEBVIEW_PROVIDER_UNAVAILABLE": reasons.add("未检测到可用的 WebView 提供程序。\nNo usable WebView provider was detected."); break;
                case "WEBVIEW_VERSION_UNKNOWN": reasons.add("无法识别当前 WebView 版本。\nThe WebView version could not be identified."); break;
                case "WEBVIEW_TOO_OLD": reasons.add("当前 WebView 低于本预览要求的 " + SyncPolicy.MIN_WEBVIEW_MAJOR + "。\nThis preview requires WebView " + SyncPolicy.MIN_WEBVIEW_MAJOR + " or later."); break;
                case "MESSAGE_LISTENER_CHECK_UNAVAILABLE": reasons.add("无法检查安全消息接口是否可用。\nThe secure messaging capability could not be checked."); break;
                case "MESSAGE_LISTENER_UNSUPPORTED": reasons.add("当前内核缺少安全消息接口。\nThis WebView lacks the required secure messaging interface."); break;
            }
        }
        return String.join("\n\n", reasons);
    }

    private static String safe(String value) {
        if (value == null || value.trim().isEmpty()) return "UNKNOWN";
        String cleaned = value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return cleaned.isEmpty() ? "UNKNOWN" : cleaned.substring(0, Math.min(cleaned.length(), 160));
    }
}
