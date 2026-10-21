package com.ithread.android;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;
import static org.junit.Assume.*;

abstract class TabletTestBase {
    protected ActivityScenario<MainActivity> scenario;
    protected static WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int at = 0; at < group.getChildCount(); at++) {
                WebView found = findWeb(group.getChildAt(at));
                if (found != null) return found;
            }
        }
        return null;
    }
    protected String evaluate(String script) throws Exception {
        CompletableFuture<String> response = new CompletableFuture<>();
        scenario.onActivity(activity -> {
            WebView web = findWeb(activity.getWindow().getDecorView());
            if (web == null) { response.complete("null"); return; }
            web.evaluateJavascript(script, response::complete);
        });
        return response.get(10, TimeUnit.SECONDS);
    }
    protected void waitTrue(String script) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
        while (System.nanoTime() < end) {
            if ("true".equals(evaluate(script))) return;
            Thread.sleep(200);
        }
        fail("Android state not reached: " + script + "\n" + evaluate("document.body.innerText.slice(0,1200)"));
    }
    protected void ready() throws Exception {
        final boolean[] supported = { false };
        scenario.onActivity(activity -> supported[0] = findWeb(activity.getWindow().getDecorView()) != null);
        assumeTrue("WebView upgrade prompt only; editor tests skipped", supported[0]);
        waitTrue("Boolean(document.querySelector('.start') || document.querySelector('.mm-editor'))");
    }
}
