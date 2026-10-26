package com.ithread.android;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real bundled WebView + React editor + touch actions. Composition events are synthetic, not an IME certification. */
@RunWith(AndroidJUnit4.class)
public final class TabletEditingTest extends TabletTestBase {
    @Before public void launch() { scenario = ActivityScenario.launch(MainActivity.class); }
    @After public void close() { if (scenario != null) scenario.close(); }

    private void editFirstTopic() throws Exception {
        ready();
        evaluate("document.querySelector('.st-new')?.click();true");
        waitTrue("Boolean(document.querySelector('.react-flow__node'))");
        evaluate("window.__editNode=document.querySelector('.react-flow__node');window.__originalTopic=window.__editNode.innerText;"
                + "window.__editNode.firstElementChild.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));true");
        waitTrue("Boolean(document.querySelector('[contenteditable=true]') && document.querySelector('.mm-android-edit-actions'))");
        waitTrue("document.activeElement===document.querySelector('[contenteditable=true]') && window.__editNode.isConnected");
        // DOM existence precedes TopicNode's focus/seed effect on a cold, older engine.
        evaluate("window.__editSettled=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__editSettled=document.activeElement===document.querySelector('[contenteditable=true]')}));true");
        waitTrue("window.__editSettled===true");
    }
    private void tapAction(boolean done) throws Exception {
        waitForWindowFocus(scenario);
        String label;
        if (done) label = "\"完成\"".equals(evaluate("document.querySelector('.mm-android-edit-done').innerText")) ? "完成" : "Done";
        else label = "\"取消\"".equals(evaluate("document.querySelector('.mm-android-edit-actions button').innerText")) ? "取消" : "Cancel";
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        String app = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName();
        UiObject2 button = device.wait(Until.findObject(By.pkg(app).text(label)), 10000);
        assertNotNull("Editor action is not touch-accessible", button);
        button.click();
        waitTrue("!document.querySelector('[contenteditable=true]') && !document.querySelector('.mm-android-edit-actions')");
    }

    @Test public void compositionConfirmationStaysInEditorAndTouchDoneCommits() throws Exception {
        editFirstTopic();
        evaluate("window.__imeTrace=[];for(const kind of ['focusin','focusout','compositionstart','compositionend','keydown']){document.addEventListener(kind,e=>{if(window.__imeTrace.length<24)window.__imeTrace.push({kind,target:e.target.tagName,key:e.key,composing:e.isComposing,keyCode:e.keyCode,connected:window.__editNode.isConnected})},true)};true");
        evaluate("window.__topicInput=document.querySelector('[contenteditable=true]');"
                + "window.__topicInput.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));"
                + "window.__topicInput.textContent='平板中文编辑';"
                + "window.__topicInput.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText'}));"
                + "window.__topicInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true}));true");
        waitTrue("Boolean(document.querySelector('[contenteditable=true]') && document.querySelector('.mm-android-edit-done')?.disabled)");
        evaluate("window.__topicInput.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'平板中文编辑'}));true");
        waitTrue("!document.querySelector('.mm-android-edit-done').disabled");
        assertEquals("true", evaluate("(()=>{const bar=document.querySelector('.mm-android-edit-actions');const r=bar.getBoundingClientRect();return !bar.closest('.react-flow') && r.top>=0 && r.bottom<=innerHeight && getComputedStyle(bar).position==='fixed'})()"));
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).waitForIdle();
        Thread.sleep(300); // Let the software renderer present the frame captured below.
        captureRuntimeScreen("tablet-edit-actions");
        tapAction(true);
        waitTrue("window.__editNode.innerText.includes('平板中文编辑') && window.__editNode.classList.contains('selected')");
    }

    @Test public void touchCancelLeavesExistingTopicUnchanged() throws Exception {
        editFirstTopic();
        evaluate("document.querySelector('[contenteditable=true]').textContent='synthetic-unaccepted-draft';true");
        tapAction(false);
        waitTrue("window.__editNode.innerText===window.__originalTopic && !window.__editNode.innerText.includes('synthetic-unaccepted-draft')");
    }
}
