package com.ithread.android;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.net.Uri;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** Native support UI works even when no WebView can be created. Nothing is sent automatically. */
final class RuntimeSupportView extends ScrollView {
    RuntimeSupportView(Activity activity, RuntimeDiagnostics diagnostics, RuntimeDiagnostics.Event event) {
        super(activity);
        setFillViewport(true);
        LinearLayout column = new LinearLayout(activity);
        column.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(24); column.setPadding(padding, padding, padding, padding);
        addView(column, new LayoutParams(-1, -2));
        ImageView icon = new ImageView(activity);
        icon.setImageResource(R.mipmap.ic_launcher);
        icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        column.addView(icon, new LinearLayout.LayoutParams(dp(52), dp(52)));
        boolean compatibility = event == RuntimeDiagnostics.Event.COMPATIBILITY_BLOCKED;
        text(column, compatibility ? "暂时无法启动 iThread\nUnable to start iThread"
                : "编辑器需要重新加载\nReload the editor", 23, true);
        text(column, compatibility ? diagnostics.explanation()
                : "页面或渲染进程已停止。重试不会清空本地文件库，但未完成保存的修改可能无法恢复。\n"
                + "The page or renderer stopped. Retry keeps the local library; unsaved edits may not be recoverable.", 16, false);
        if (compatibility) text(column,
                "安卓系统版本与 WebView 内核版本不同。本预览要求 Android 10+ 和 WebView 124+。\n"
                + "请通过设备或模拟器的官方渠道检查 WebView 更新；更新电脑浏览器不会更新这里的内核。\n"
                + "Android and WebView versions are separate. This preview requires Android 10+ and WebView 124+.\n"
                + "Check the device/emulator's official WebView updates, not your Windows browser.", 14, false);
        text(column, "请保留本地数据，不要为排查问题卸载应用或清除存储。\nKeep your data; do not uninstall or clear storage to troubleshoot.", 14, false);
        String report = diagnostics.report(event);
        TextView details = text(column, report, 13, false);
        details.setTypeface(Typeface.MONOSPACE); details.setTextIsSelectable(true);
        details.setTag("runtime-diagnostics");
        Button copy = button(column, "复制诊断信息 / Copy diagnostics", "copy-diagnostics", false);
        copy.setOnClickListener(view -> {
            try {
                ClipboardManager clipboard = (ClipboardManager) activity.getSystemService(Activity.CLIPBOARD_SERVICE);
                if (clipboard == null) throw new IllegalStateException();
                clipboard.setPrimaryClip(ClipData.newPlainText("iThread diagnostics", report));
                Toast.makeText(activity, "已复制，可粘贴反馈 / Copied for feedback", Toast.LENGTH_SHORT).show();
            } catch (Exception ignored) {
                Toast.makeText(activity, "请长按上方文本复制 / Select the report text to copy", Toast.LENGTH_SHORT).show();
            }
        });
        Button retry = button(column, "重新检查并打开 / Retry", "retry-startup", true);
        retry.setOnClickListener(view -> { retry.setEnabled(false); activity.recreate(); });
        if (diagnostics.providerFound && !diagnostics.providerPackage.equals("UNKNOWN")) {
            button(column, "查看 WebView 应用信息 / WebView details", "webview-details", false)
                    .setOnClickListener(view -> {
                        try { activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:" + diagnostics.providerPackage))); }
                        catch (Exception ignored) { Toast.makeText(activity, "请在系统设置中查看 WebView / Check WebView in system settings", Toast.LENGTH_LONG).show(); }
                    });
        }
        text(column, "诊断只含应用、安卓和 WebView 环境信息，不含导图、文件路径、设备标识或云盘凭据。不会自动上传。\n"
                + "Diagnostics include only app, Android and WebView environment details. No maps, file paths, device IDs or cloud credentials; no automatic upload.", 12, false);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(LinearLayout column, String value, int size, boolean heading) {
        TextView text = new TextView(getContext()); text.setText(value); text.setTextSize(size);
        text.setTextColor(0xff253a32);
        if (heading) text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(-1, -2);
        layout.bottomMargin = dp(18); column.addView(text, layout); return text;
    }
    private Button button(LinearLayout column, String label, String tag, boolean primary) {
        Button button = new Button(getContext()); button.setText(label); button.setAllCaps(false);
        button.setMinHeight(dp(48)); button.setTag(tag);
        button.setBackgroundTintList(ColorStateList.valueOf(primary ? 0xff246b53 : 0xffe2e9df));
        button.setTextColor(primary ? 0xffffffff : 0xff253a32);
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(-1, -2);
        layout.bottomMargin = dp(8); column.addView(button, layout); return button;
    }
}
