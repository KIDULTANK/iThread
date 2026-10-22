package com.ithread.android;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run seed on the pinned previous preview, install the new APK without clearing data, then verify.
 * Fixtures are artificial. This exercises installation persistence, not a cloud service. */
@RunWith(AndroidJUnit4.class)
public final class UpgradeStorageTest extends TabletTestBase {
    @Before public void launch() { scenario = ActivityScenario.launch(MainActivity.class); }
    @After public void close() { if (scenario != null) scenario.close(); }

    @Test public void seedBaselineData() throws Exception {
        ready();
        evaluate("window.__upgradeDone=false; window.__upgradeError=''; (async()=>{try{"
                + "const db=await new Promise((ok,no)=>{const r=indexedDB.open('mindmap-studio',7);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});"
                + "const id='android-upgrade-fixture',workspace='synthetic-workspace',ts=1700000000000;"
                + "const doc={schemaVersion:1,id,title:'升级保留 Test',root:{id:'upgrade-root',topic:'升级保留 Test',children:[{id:'upgrade-child',topic:'中文 English',note:'保留备注',collapsed:true,children:[]}]}};"
                + "const key=JSON.stringify([workspace,id]),conflictKey=JSON.stringify([workspace,id,'synthetic-etag']);"
                + "const rows=[['maps',id,doc],['versions',null,{id:id+':'+ts,mapId:id,ts,title:doc.title,nodeCount:2,doc}],"
                + "['recovery',id,{mapId:id,savedAt:ts,doc}],"
                + "['syncStates',key,{workspace,mapId:id,enabled:true,version:3,observed:doc,base:doc,baseEtag:'synthetic-base'}],"
                + "['syncConflicts',conflictKey,{workspace,mapId:id,local:doc,remote:{value:doc,etag:'synthetic-etag'},savedAt:ts}]];"
                + "const tx=db.transaction(['maps','versions','recovery','syncStates','syncConflicts','meta'],'readwrite');"
                + "const done=new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error)});"
                + "for(const [store,key,value] of rows){if(key===null)tx.objectStore(store).put(value);else tx.objectStore(store).put(value,key)}"
                + "tx.objectStore('meta').put(rows,'android-upgrade-checkpoint');await done;db.close();"
                + "localStorage.setItem('mindmap-locale','zh-CN');localStorage.setItem('android-upgrade-marker','dev1-preserved');window.__upgradeDone=true;"
                + "}catch(e){window.__upgradeError=String(e)}})();true");
        waitTrue("window.__upgradeDone === true || Boolean(window.__upgradeError)");
        org.junit.Assert.assertEquals("Baseline fixture creation", "\"\"", evaluate("window.__upgradeError"));
        org.junit.Assert.assertEquals("true", evaluate("window.__upgradeDone"));
    }

    @Test public void verifyAfterUpgrade() throws Exception {
        ready();
        evaluate("window.__upgradeVerified=false;window.__upgradeError='';(async()=>{try{"
                + "if(localStorage.getItem('android-upgrade-marker')!=='dev1-preserved'||localStorage.getItem('mindmap-locale')!=='zh-CN')throw Error('Local settings lost');"
                + "const db=await new Promise((ok,no)=>{const r=indexedDB.open('mindmap-studio',7);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});"
                + "const read=(store,key)=>new Promise((ok,no)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});"
                + "const rows=await read('meta','android-upgrade-checkpoint');if(!rows||rows.length!==5)throw Error('Baseline checkpoint missing');"
                + "for(const [store,key,expected] of rows){const actual=await read(store,key===null?expected.id:key);if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Changed store: '+store)}"
                + "db.close();window.__upgradeVerified=true;}catch(e){window.__upgradeError=String(e)}})();true");
        waitTrue("window.__upgradeVerified === true || Boolean(window.__upgradeError)");
        org.junit.Assert.assertEquals("Upgrade data verification", "\"\"", evaluate("window.__upgradeError"));
        org.junit.Assert.assertEquals("true", evaluate("window.__upgradeVerified"));
    }
}
