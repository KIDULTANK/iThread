package com.ithread.android;

/** Runs only on the bundled, bridge-ineligible compatibility document. No map/user input is evaluated. */
final class RuntimeCapabilities {
    static final String SCRIPT = "(function(){var missing=[];function need(ok,name){if(!ok)missing.push(name);}"
            + "need(typeof structuredClone==='function','structuredClone');"
            + "if(typeof structuredClone==='function'){try{need(structuredClone({a:new Uint8Array([7])}).a[0]===7,'cloneTypedArray');}catch(e){missing.push('cloneTypedArray');}}"
            + "need(typeof crypto==='object'&&typeof crypto.randomUUID==='function','randomUUID');"
            + "need(typeof indexedDB==='object'&&typeof indexedDB.open==='function','IndexedDB');"
            + "need(typeof Worker==='function','Worker');need(typeof ResizeObserver==='function','ResizeObserver');"
            + "need(typeof TextEncoder==='function'&&typeof TextDecoder==='function','textCodecs');"
            + "need(typeof DOMMatrixReadOnly==='function','DOMMatrixReadOnly');"
            + "need(typeof AbortController==='function','AbortController');need(typeof Object.hasOwn==='function','Object.hasOwn');"
            + "need(typeof Array.prototype.at==='function','Array.at');need(typeof String.prototype.replaceAll==='function','replaceAll');"
            + "need('noModule' in document.createElement('script'),'moduleScripts');"
            + "return missing.length===0?'PASS':'FAIL';})()";
}
