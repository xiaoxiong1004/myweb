/* Optional, visible QA controls. Never displayed on the normal website. */
if(new URLSearchParams(location.search).has('review')){
  const panel=document.createElement('aside');panel.setAttribute('aria-label','动画检查');panel.style.cssText='position:fixed;right:10px;bottom:10px;z-index:999;background:#fff;color:#123;padding:12px;display:flex;gap:10px;font:14px sans-serif;border-radius:8px';
  panel.innerHTML='<button id="review-flight">开始转场检查</button><label>转场秒数 <input id="review-time" aria-label="转场秒数" type="number" min="0" max="4.19" step="0.1" value="2.7" style="width:65px"></label><button id="review-seek">查看此帧</button><button id="review-play">继续播放</button><button id="review-age">查看页面时刻</button><label>页面 <select aria-label="检查页面" id="review-scene"><option>1</option><option>4</option><option>5</option><option>7</option><option>10</option><option>11</option></select></label><button id="review-go">进入页面</button>';
  document.body.append(panel);
  document.querySelector('#review-flight').onclick=()=>{go(1);flyToOrigin();BatikMotion.reviewFlight(0)};
  document.querySelector('#review-seek').onclick=()=>BatikMotion.reviewFlight(+document.querySelector('#review-time').value);
  document.querySelector('#review-play').onclick=()=>{BatikMotion.clearReview();BatikMotion.resumeFlight()};document.querySelector('#review-age').onclick=()=>BatikMotion.reviewAge(+document.querySelector('#review-scene').value,+document.querySelector('#review-time').value);
  document.querySelector('#review-go').onclick=()=>{const n=+document.querySelector('#review-scene').value;entered[n]=performance.now();go(n)};
}
