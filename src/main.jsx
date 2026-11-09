import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {readState, stageState, writeState} from './storage';
import './style.css';

const uuid = () => crypto.randomUUID();
const starter = () => { const chapterId=uuid(); return {schemaVersion:1,activeId:chapterId,chapters:[{id:chapterId,title:'第1章',text:'彼は目を伏せた。\n「ずっと好きだった」\n\n私は思わず顔を上げる。\n「……今さら？」\n「今さらでも、好きなんだよ」',updatedAt:new Date().toISOString()}]}; };
const chars = s => Array.from(s).length;
const extract = s => [...s.matchAll(/「([^」]*)」/gs)].map(m=>m[1]);
const download = (name, data, type) => { const url=URL.createObjectURL(new Blob([data],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
const filename = s => s.replace(/[\\/:*?"<>|]/g,'_').slice(0,70)||'原稿';
function App(){
 const [state,renderState]=useState(null),[saveStatus,setSaveStatus]=useState('読み込み中'),[tab,setTab]=useState('editor'),[includeSpaces,setIncludeSpaces]=useState(true),[toast,setToast]=useState('');
 const importRef=useRef(null), current=useRef(null), blocked=useRef(false);
 const [loadError,setLoadError]=useState('');
 function setState(change){
  const next=typeof change==='function'?change(current.current):change;
  current.current=next;
  try{stageState(next);blocked.current=false;setSaveStatus('保存中…');}
  catch(e){blocked.current=true;setSaveStatus('未保存: '+e.message);}
  renderState(next);
 }
 useEffect(()=>{let alive=true;readState().then(data=>{if(alive){const next=data||starter();current.current=next;renderState(next);}}).catch(e=>{if(alive)setLoadError(e.message);});return()=>{alive=false};},[]);
 useEffect(()=>{
  if(!state||blocked.current)return;
  let alive=true;
  try{stageState(state);}catch(e){blocked.current=true;setSaveStatus('未保存: '+e.message);return;}
  setSaveStatus('保存中…');
  writeState(state).then(()=>{if(alive)setSaveStatus('この端末に保存済み');}).catch(()=>{if(alive)setSaveStatus('復旧用保存済み・通常保存に失敗。バックアップしてください');});
  return()=>{alive=false};
 },[state]);
 useEffect(()=>{const warn=e=>{if(blocked.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2300);return()=>clearTimeout(t)},[toast]);
 const chapter=state?.chapters.find(c=>c.id===state.activeId)||state?.chapters[0];
 const dialogue=useMemo(()=>extract(chapter?.text||''),[chapter?.text]);
 const text=chapter?.text||'';
 const count=includeSpaces?chars(text):chars(text.replace(/\s/g,''));
 const dialogueCount=dialogue.reduce((sum,s)=>sum+chars(s),0);
 function updateChapter(patch){setState(old=>({...old,chapters:old.chapters.map(c=>c.id===old.activeId?{...c,...patch,updatedAt:new Date().toISOString()}:c)}));}
 function addChapter(){const id=uuid();setState(old=>({...old,activeId:id,chapters:[...old.chapters,{id,title:`第${old.chapters.length+1}章`,text:'',updatedAt:new Date().toISOString()}]}));setTab('editor');}
 function removeChapter(){if(state.chapters.length===1){setToast('最後の章は削除できません');return;}if(!confirm(`「${chapter.title}」を削除しますか？ この操作は元に戻せません。`))return;setState(old=>{const chapters=old.chapters.filter(c=>c.id!==old.activeId);return {...old,activeId:chapters[0].id,chapters};});}
 async function copy(value){try{await navigator.clipboard.writeText(value);setToast('コピーしました');}catch{setToast('コピーできませんでした。ブラウザの権限を確認してください');}}
 async function exportBackup(){if(!state)return;download('原稿バックアップ_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json;charset=utf-8');}
 async function importBackup(file){if(!file)return;try{const data=JSON.parse(await file.text());if(data.schemaVersion!==1||!Array.isArray(data.chapters)||!data.chapters.length||!data.chapters.every(c=>typeof c.id==='string'&&typeof c.title==='string'&&typeof c.text==='string')||!data.chapters.some(c=>c.id===data.activeId))throw Error('形式が正しくありません');if(!confirm('現在の原稿をバックアップの内容で置き換えます。先に現在のバックアップを保存することをおすすめします。続行しますか？'))return;setState(data);setToast(blocked.current?'復元しましたが未保存です。バックアップを保管してください':'バックアップを復元しました');}catch(e){setToast('読み込めませんでした: '+e.message);}finally{if(importRef.current)importRef.current.value='';}}
 if(loadError)return <div className="loading" role="alert">原稿を読み込めませんでした。既存データの上書きを停止しています。<p>{loadError}</p><button onClick={()=>location.reload()}>再読み込み</button></div>;
 if(!state)return <div className="loading">原稿を読み込んでいます…</div>;
 return <div className="app">
  <header className="topbar"><div><strong className="brand">原稿エディタ</strong><span className="subbrand">小説・漫画</span></div><div className="header-actions"><span className="save-state" aria-live="polite">● {saveStatus}</span><button className="secondary" onClick={exportBackup}>バックアップ</button></div></header>
  <div className="workspace"><aside className="sidebar"><div className="section-head"><span>章一覧</span><button className="mini" onClick={addChapter}>＋ 追加</button></div><nav>{state.chapters.map(c=><button key={c.id} className={'chapter '+(c.id===chapter.id?'selected':'')} onClick={()=>{setState(old=>({...old,activeId:c.id}));setTab('editor')}}><span>{c.title||'無題'}</span><small>{chars(c.text).toLocaleString()}字</small></button>)}</nav><div className="sidebar-bottom"><button className="secondary full" onClick={()=>importRef.current?.click()}>バックアップを復元</button><input ref={importRef} hidden type="file" accept=".json,application/json" onChange={e=>importBackup(e.target.files?.[0])}/><p>原稿はこの端末内に保存されます。別端末との自動同期は未実装です。</p></div></aside>
  <main className="main"><div className="docbar"><input className="title-input" aria-label="章タイトル" value={chapter.title} onChange={e=>updateChapter({title:e.target.value})}/><button className="danger" onClick={removeChapter}>章を削除</button></div>
   <div className="mobile-tabs"><button className={tab==='editor'?'active':''} onClick={()=>setTab('editor')}>本文</button><button className={tab==='dialogue'?'active':''} onClick={()=>setTab('dialogue')}>セリフ抽出 ({dialogue.length})</button></div>
   <div className="panels"><section className={'editor-panel '+(tab==='dialogue'?'mobile-hidden':'')}><div className="panel-heading"><h2>本文</h2><label><input type="checkbox" checked={includeSpaces} onChange={e=>setIncludeSpaces(e.target.checked)}/> 空白・改行を数える</label></div><textarea className="editor" spellCheck="false" value={text} onChange={e=>updateChapter({text:e.target.value})} placeholder="ここから書き始める…" aria-label="本文"/><div className="stats"><div><strong>{count.toLocaleString()}</strong><small>本文文字数</small></div><div><strong>{dialogueCount.toLocaleString()}</strong><small>セリフ文字数</small></div><div><strong>{dialogue.length}</strong><small>セリフ件数</small></div></div></section>
   <section className={'dialogue-panel '+(tab==='editor'?'mobile-hidden':'')}><div className="panel-heading"><h2>セリフ抽出</h2><span className="muted">「」内をカッコなしで抽出</span></div><div className="dialogue-actions"><button onClick={()=>copy(dialogue.join('\n'))} disabled={!dialogue.length}>すべてコピー</button><button className="secondary" onClick={()=>download(filename(chapter.title)+'_セリフ.txt',dialogue.join('\n'),'text/plain;charset=utf-8')} disabled={!dialogue.length}>TXT出力</button><button className="secondary" onClick={()=>download(filename(chapter.title)+'.txt',text,'text/plain;charset=utf-8')}>本文TXT</button></div><div className="dialogues">{dialogue.length?dialogue.map((line,i)=><div className="dialogue-row" key={i}><span className="index">{i+1}</span><div className="dialogue-text">{line}</div><button className="copy-one" onClick={()=>copy(line)} aria-label={`${i+1}番目のセリフをコピー`}>コピー</button></div>):<p className="empty">「」で囲んだセリフがここに表示されます。</p>}</div></section></div>
  </main></div><footer><span>全章合計 {state.chapters.reduce((n,c)=>n+chars(c.text),0).toLocaleString()}文字</span><span>ローカル保存版 · 同期機能は今後追加</span></footer>{toast&&<div className="toast" role="status">{toast}</div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
