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
    final boolean huaweiCompat;
    final int chromiumMajor;
    final String probe;

    RuntimeDiagnostics(String appVersion, String androidRelease, int api, boolean providerFound,
            String providerPackage, String providerVersion, Boolean listenerSupport) {
        this(appVersion, androidRelease, api, providerFound, providerPackage, providerVersion,
                listenerSupport, false, -1, "NOT_RUN");
    }

    RuntimeDiagnostics(String appVersion, String androidRelease, int api, boolean providerFound,
            String providerPackage, String providerVersion, Boolean listenerSupport,
            boolean huaweiCompat, int chromiumMajor, String probe) {
        this.appVersion = safe(appVersion); this.androidRelease = safe(androidRelease); this.api = api;
        this.providerFound = providerFound; this.providerPackage = safe(providerPackage);
        this.providerVersion = safe(providerVersion); this.listenerSupport = listenerSupport;
        this.huaweiCompat = huaweiCompat; this.chromiumMajor = chromiumMajor;
        this.probe = "PASS".equals(probe) || "FAIL".equals(probe) || "TIMEOUT".equals(probe) ? probe : "NOT_RUN";
    }

    RuntimeDiagnostics withProbe(String result) {
        return new RuntimeDiagnostics(appVersion, androidRelease, api, providerFound, providerPackage,
                providerVersion, listenerSupport, huaweiCompat, chromiumMajor, result);
    }

    List<String> issues() {
        List<String> issues = preflightIssues();
        if (huaweiCompat && !probe.equals("PASS")) issues.add("FEATURE_PROBE_" + probe);
        return issues;
    }

    private List<String> preflightIssues() {
        List<String> issues = new ArrayList<>();
        if (!providerFound) issues.add("WEBVIEW_PROVIDER_UNAVAILABLE");
        else {
            int major = huaweiCompat ? chromiumMajor : SyncPolicy.webViewMajor(providerVersion);
            if (major < 0) issues.add(huaweiCompat ? "CHROMIUM_VERSION_UNKNOWN" : "WEBVIEW_VERSION_UNKNOWN");
            else if (major < (huaweiCompat ? SyncPolicy.COMPAT_MIN_CHROMIUM_MAJOR : SyncPolicy.MIN_WEBVIEW_MAJOR))
                issues.add(huaweiCompat ? "CHROMIUM_TOO_OLD" : "WEBVIEW_TOO_OLD");
        }
        if (listenerSupport == null) issues.add("MESSAGE_LISTENER_CHECK_UNAVAILABLE");
        else if (!listenerSupport) issues.add("MESSAGE_LISTENER_UNSUPPORTED");
        return issues;
    }

    boolean supported() { return issues().isEmpty(); }
    boolean mayInitialize() { return preflightIssues().isEmpty(); }

    String report(Event event) {
        return "iThread Android diagnostics v1\n"
                + "app=" + appVersion + "\nandroid=" + androidRelease + "\napi=" + api
                + "\nwebview.package=" + providerPackage + "\nwebview.version=" + providerVersion
                + (huaweiCompat ? "\ncompat.profile=huawei-test\nchromium.major=" + chromiumMajor
                    + "\nchromium.minimum=" + SyncPolicy.COMPAT_MIN_CHROMIUM_MAJOR + "\ncapability.probe=" + probe
                    : "\nwebview.minimum=" + SyncPolicy.MIN_WEBVIEW_MAJOR)
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
                case "CHROMIUM_VERSION_UNKNOWN": reasons.add("无法识别实际 Chromium 内核版本。\nThe actual Chromium version could not be identified."); break;
                case "CHROMIUM_TOO_OLD": reasons.add("专用包需要 Chromium 98+，这里比较的是实际内核，而非华为组件版本号。\nThis test build needs Chromium 98+, not a Huawei package version number."); break;
                case "FEATURE_PROBE_NOT_RUN": reasons.add("运行能力检查尚未完成。\nThe runtime capability check has not completed."); break;
                case "FEATURE_PROBE_FAIL": reasons.add("当前内核缺少编辑器所需的运行能力。\nRequired editor capabilities are missing."); break;
                case "FEATURE_PROBE_TIMEOUT": reasons.add("运行能力检查超时，请重试或反馈诊断。\nThe runtime check timed out. Retry or share diagnostics."); break;
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
