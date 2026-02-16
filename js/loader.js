'use strict';

// ==========================
// FIX: https + no double load + keep globals for OTTWidget.js
// ==========================

// 1) BASE URL
var x0;
if (typeof window["loaderLocation"] !== "undefined") {
  x0 = String(window["loaderLocation"] || "");
} else if (typeof window["\x6c\x6f\x61\x64\x65\x72\x4c\x6f\x63\x61\x74\x69\x6f\x6e"] !== "undefined") {
  x0 = String(window["\x6c\x6f\x61\x64\x65\x72\x4c\x6f\x63\x61\x74\x69\x6f\x6e"] || "");
} else {
  // дефолт как у оригинала, но протокол безопасный
  x0 = (location && location.protocol === 'https:' ? 'https://' : 'http://') + "widget1.ottplayer.tv/";
}

// нормализация
if (location && location.protocol === 'https:' && x0.indexOf('http://') === 0) x0 = 'https://' + x0.slice(7);
if (x0.slice(-1) !== '/') x0 += '/';

// cachebuster (как было)
var x1 = Math["\x63\x65\x69\x6c"](Date["\x6e\x6f\x77"]() / (60 * 1000));

// ==========================
// helpers
// ==========================
function x2(src) {
  var x3 = document.createElement("link");
  x3.type = "text/css";
  x3.rel = "stylesheet";
  x3.async = false;
  x3.href = src;
  document.getElementsByTagName("head")[0].appendChild(x3);
}

function x4(src, cb) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.onload = function () { cb(); };
  s.onerror = function () { cb(); };
  s.async = false;
  s.src = src;
  document.getElementsByTagName("head")[0].appendChild(s);
}

function x7(base, arr, withRcid, done) {
  if (arr.length > 0) {
    var c = 0;
    var one = function () {
      c++;
      if (c === arr.length) done();
    };
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (withRcid) p += ("?rcid=" + x1);
      x4(base + p, one);
    }
  } else done();
}

// ==========================
// CSS load (как оригинал)
// ==========================
x2(x0 + "css/Main.css" + "?rcid=" + x1);

// ==========================
// !!! IMPORTANT: these MUST be global for OTTWidget.js
// ==========================
var xf = { xg:0, xh:1, xi:2, xj:3, xk:4, xl:5, xm:6, xn:7, xo:8, xp:9, xq:10, xr:11, xs:12, xt:14 };
var xu = { xv: xf.xg, xw: 0 };
window.xu = xu;
window.xf = xf; // <-- ключевой фикс, чтобы OTTWidget.js видел xf

function xx() {
  var xy = (navigator.userAgent).toLowerCase();
  var xz = String(window.location).toLowerCase();
  var x10 = xf.xg;

  if (xz.indexOf("/operatv") > 0) x10 = xf.xo;
  else if (xz.indexOf("/nettv") > 0) x10 = xf.xk;
  else if (xz.indexOf("/dune") > 0) x10 = xf.xq;
  else if (xy.indexOf("maple") > 0) {
    x10 = xf.xh;
    var x11 = document.getElementById("pluginObjectNNavi"), x12 = "xxx-2010";
    try { x12 = x11.GetFirmware(); } catch (e) {}
    x12 = x12.split("-");
    if (x12[1]) {
      for (var x14 = 2010; x14 < 2020; x14++) {
        if (x12[1].indexOf(String(x14)) !== -1) { xu.xw = x14; break; }
      }
    }
  } else if (
    (xy.indexOf("web0s") > 0) ||
    (xy.indexOf("webos") > 0) ||
    ((xy.indexOf("webappmanager") > 0) && (xy.indexOf("safari/537.36") > 0)) ||
    ((xy.indexOf("safari/537.31") > 0) && (xy.indexOf("smarttv/5.0") > 0)) ||
    ((xy.indexOf("safari/537.31") > 0) && (xy.indexOf("smarttv/6.0") > 0))
  ) x10 = xf.xj;
  else if ((xy.indexOf("netcast") > 0) || (xy.indexOf("lg simplesmart.tv") > 0)) x10 = xf.xi;
  else if (xy.indexOf("dunehd") > 0) x10 = xf.xq;
  else if (
    (xy.indexOf("opera tv store") > 0) ||
    (xy.indexOf("sonycebrowser") > 0) ||
    (xy.indexOf("inettvbrowser") > 0) ||
    ((xy.indexOf("tv store") > 0) && (xy.indexOf("model/") > 0))
  ) x10 = xf.xo;
  else if (xy.indexOf("nettv") > 0) x10 = xf.xk;
  else if (!!window.tizen) x10 = xf.xm;
  else if (xy.indexOf("tizen") > 0) x10 = xf.xm;
  else if ((xy.indexOf("opera") === 0) && (xy.indexOf("linux sh4") > 0)) x10 = xf.xn;
  else if (xy.indexOf("viera") > 0) x10 = xf.xp;
  else if ((window["JSTV"]) || (xy.indexOf("qtembedded") > 0)) x10 = xf.xr;
  else if (xy.indexOf("playstation") > 0) x10 = xf.xs;

  if (!!window.gSTB) { x10 = xf.xl; try { window.moveTo(0, 0); } catch (e) {} }
  return x10;
}

// ==========================
// UI loader elements
// ==========================
var x15 = false;

function x16() {
  var x17 = document.body,
    x18 = document.createElement("div"),
    x19 = document.createElement("div"),
    x1a = document.createElement("img");
  x18.id = "css3"; x17.appendChild(x18);
  x19.id = "css5"; x18.appendChild(x19);
  x1a.id = "css2"; x18.appendChild(x1a);
  if (xu.xv === xf.xg) x1a.style.background = "rgb(0,5,80)";
}

var x1p, x1q = 0, x1r = [0x5c, 0x7c, 0x2f, 0x2d];
function x1s() {
  x1p = document.createElement("div");
  x1p.style.cssText =
    "width:6em;height:1.2em;top:5%;left:3%;background:rgb(40,65,97);color:rgb(240,240,240);position:absolute;z-index:100;font-size:3em;text-align:center;border-radius:0.2em;";
  document.body.appendChild(x1p);
}
function x1d() {
  if (!x1p) return;
  x1p.innerHTML = "Loading " + String.fromCharCode(x1r[x1q++]);
  if (x1q > 3) x1q = 0;
}
function x1e() { try { x1p && document.body.removeChild(x1p); } catch (e) {} }

var x1t;
function x1u() {
  x1t = document.createElement("div");
  x1t.style.cssText =
    "width:94%;height:1.2em;top:12%;left:3%;position:absolute;background:transparent;z-index:100;font-size:1.6em;text-align:center;border-radius:0.2em;";
  document.body.appendChild(x1t);
}
function x1g() { try { x1t && document.body.removeChild(x1t); } catch (e) {} }
function x1v(msg) {
  if (!x1t) return;
  x1t.style.background = "rgb(150,80,80)";
  x1t.innerHTML = msg;
}

function x1b() {
  if ((x15) && (window.x1c)) {
    x1d();
    setTimeout(function () {
      x1e();
      try { if (window.x1f && window.x1f.onLoad) window.x1f.onLoad(); } catch (e) {}
      x1g();
    }, 0);
  } else {
    x1d();
    setTimeout(x1b, 100);
  }
}

// ==========================
// platform-specific includes + main includes
// ==========================
function x1h() {
  var x1i = [
    "$MANAGER_WIDGET/Common/API/Widget.js",
    "$MANAGER_WIDGET/Common/API/Plugin.js",
    "$MANAGER_WIDGET/Common/API/TVKeyValue.js"
  ];
  var x1j = [];
  var x1k = ["js/lib/webOSjs-0.1.0/webOS.js"];
  var x1l = ["$WEBAPIS/webapis/webapis.js"];
  var x1m = ["js/lib/json2.min.js", "js/OTTWidget.js"];

  var x1n = function () { x15 = true; };
  var x1o = function () { x7(x0, x1m, true, x1n); };

  xu.xv = xx();

  // оригинал добавляет object для netcast/dune — если нужно, вставь как было.
  // На web обычно это не критично, но не будем ломать DOM:
  x16();

  switch (xu.xv) {
    case xf.xh: x7("", x1i, false, x1o); break;  // maple
    case xf.xi: x7("", x1j, false, x1o); break;  // netcast
    case xf.xj: x7(x0, x1k, false, x1o); break;  // webos
    case xf.xm: x7("", x1l, false, x1o); break;  // tizen
    default:    x1o();
  }
}

// ==========================
// RUN ONCE — no double load
// ==========================
function onLoad() {
  if (window.__ott_loader_once) return;
  window.__ott_loader_once = true;

  x1s();
  x1u();

  window.onerror = function (error, file, line) {
    try {
      if (xu.xv !== xf.xj) x1v(error + "|" + file + "(" + line + ")");
    } catch (e) {}
  };

  x1h();
  x1b();
}

function onUnload() {
  try { if (window.x1f && window.x1f.onUnload) window.x1f.onUnload(); } catch (e) {}
}
function onShow() {
  try { if (window.x1f && window.x1f.onShow) window.x1f.onShow(); } catch (e) {}
}

// attach: если index.html вызывает onLoad() — ок. Если нет — подстрахуемся.
(function attachOnce() {
  if (window.__ott_attach_once) return;
  window.__ott_attach_once = true;

  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
})();
