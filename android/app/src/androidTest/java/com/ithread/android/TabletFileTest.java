package com.ithread.android;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.KeyEvent;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;

/** Real keyboard -> picker adapter -> shared parser -> editor -> native document write.
 * Only the external picker result is stubbed; all files are artificial and app-private. */
@RunWith(AndroidJUnit4.class)
public final class TabletFileTest extends TabletTestBase {
    private Context context;
    @Before public void launch() throws Exception {
        Intents.init();
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        scenario = ActivityScenario.launch(MainActivity.class);
    }
    @After public void close() { if (scenario != null) scenario.close(); Intents.release(); }

    private File fixture(String name, byte[] bytes) throws Exception {
        File directory = new File(context.getCacheDir(), "instrumented-fixtures");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Fixture cache unavailable");
        File file = new File(directory, name);
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
        return file;
    }
    private Uri uri(File file) {
        return FileProvider.getUriForFile(context, context.getPackageName() + ".test-files", file);
    }
    private void shortcut(int key) throws Exception {
        waitForWindowFocus(scenario);
        scenario.onActivity(activity -> findWeb(activity.getWindow().getDecorView()).requestFocus());
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressKeyCode(key, KeyEvent.META_CTRL_ON);
    }
    private JSONObject importAndSave(String name, byte[] bytes, String title) throws Exception {
        ready();
        evaluate("document.querySelector('.st-new')?.click(); true");
        waitTrue("Boolean(document.querySelector('.mm-editor') && document.getElementById('mmap-input'))");
        File input = fixture(name, bytes);
        File output = fixture(name + ".export.ithread", new byte[0]);
        intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(
                new Instrumentation.ActivityResult(Activity.RESULT_OK, new Intent().setData(uri(input))));
        intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(
                new Instrumentation.ActivityResult(Activity.RESULT_OK, new Intent().setData(uri(output))));
        shortcut(KeyEvent.KEYCODE_O);
        waitTrue("Array.from(document.querySelectorAll('.react-flow__node')).some(n => n.innerText.includes(" + JSONObject.quote(title) + "))");
        shortcut(KeyEvent.KEYCODE_S);
        long end = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(45);
        while (output.length() == 0 && System.nanoTime() < end) Thread.sleep(200);
        assertTrue("Native export file was not written", output.length() > 0);
        // The write acknowledgement comes after close. Wait for a complete JSON file, not its first byte.
        JSONObject saved = null;
        while (System.nanoTime() < end) {
            try { saved = new JSONObject(new String(Files.readAllBytes(output.toPath()), StandardCharsets.UTF_8)); break; }
            catch (Exception incomplete) { Thread.sleep(200); }
        }
        assertNotNull("Export JSON was incomplete", saved);
        assertEquals(1, saved.getInt("schemaVersion"));
        assertEquals(title, saved.getJSONObject("root").getString("topic"));
        assertArrayEquals("Import must not overwrite the original document", bytes, Files.readAllBytes(input.toPath()));
        return saved;
    }

    @Test public void importsHierarchicalMarkdownAndPreservesRichText() throws Exception {
        String source = "# 平板 Markdown Test\n- **重点**\n  - ==高亮==\n- <u>下划线</u>\n";
        JSONObject doc = importAndSave("synthetic.md", source.getBytes(StandardCharsets.UTF_8), "平板 Markdown Test");
        JSONArray children = doc.getJSONObject("root").getJSONArray("children");
        assertEquals(2, children.length());
        assertEquals("重点", children.getJSONObject(0).getString("topic"));
        assertTrue(children.getJSONObject(0).getString("topicRich").contains("strong"));
        assertEquals("高亮", children.getJSONObject(0).getJSONArray("children").getJSONObject(0).getString("topic"));
    }

    @Test public void importsItmzWithChineseNotesLinksAndFolding() throws Exception {
        String xml = "<iThoughts><topics><topic uuid='synthetic-root' text='平板 itmz Test'>"
                + "<topic uuid='synthetic-a' text='分支 A' note='人工备注' link='https://example.com/' folded='1'>"
                + "<topic uuid='synthetic-b' text='下一级'/></topic></topic></topics></iThoughts>";
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("mapdata.xml"));
            zip.write(xml.getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
        }
        JSONObject doc = importAndSave("synthetic.itmz", bytes.toByteArray(), "平板 itmz Test");
        JSONObject branch = doc.getJSONObject("root").getJSONArray("children").getJSONObject(0);
        assertEquals("人工备注", branch.getString("note"));
        assertEquals("https://example.com/", branch.getString("hyperlink"));
        assertTrue(branch.getBoolean("collapsed"));
        assertEquals("下一级", branch.getJSONArray("children").getJSONObject(0).getString("topic"));
    }

    private int count(JSONObject node) throws Exception {
        int count = 1;
        JSONArray children = node.getJSONArray("children");
        for (int at = 0; at < children.length(); at++) count += count(children.getJSONObject(at));
        return count;
    }
    @Test public void importsAndSavesFiveThousandCollapsedTopics() throws Exception {
        JSONArray branches = new JSONArray();
        StringBuilder note = new StringBuilder();
        for (int n = 0; n < 64; n++) note.append("人工样本");
        for (int b = 0; b < 100; b++) {
            JSONArray leaves = new JSONArray();
            for (int c = 0; c < 49; c++) leaves.put(new JSONObject().put("id", "leaf-" + b + "-" + c)
                    .put("topic", "条目 " + b + "-" + c).put("note", note.toString()).put("children", new JSONArray()));
            branches.put(new JSONObject().put("id", "branch-" + b).put("topic", "分支 " + b)
                    .put("collapsed", true).put("children", leaves));
        }
        JSONObject original = new JSONObject().put("schemaVersion", 1).put("id", "synthetic-large")
                .put("title", "大图 5001 Test").put("root", new JSONObject().put("id", "root-large")
                        .put("topic", "大图 5001 Test").put("children", branches));
        byte[] input = original.toString().getBytes(StandardCharsets.UTF_8);
        assertTrue(input.length > 3 * 1024 * 1024);
        JSONObject doc = importAndSave("synthetic-large.ithread", input, "大图 5001 Test");
        assertEquals(5001, count(doc.getJSONObject("root")));
        JSONObject first = doc.getJSONObject("root").getJSONArray("children").getJSONObject(0);
        assertTrue(first.getBoolean("collapsed"));
        assertEquals(note.toString(), first.getJSONArray("children").getJSONObject(0).getString("note"));
    }
}
